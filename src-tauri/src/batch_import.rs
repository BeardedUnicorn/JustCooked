#![allow(non_snake_case)]

use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use url::Url;

use crate::recipe_import::import_recipe_from_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportRequest {
    pub start_url: String,
    pub max_recipes: Option<u32>,
    pub max_depth: Option<u32>,
    pub existing_urls: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportProgress {
    pub status: BatchImportStatus,
    pub current_url: Option<String>,
    pub processed_recipes: u32,
    pub total_recipes: u32,
    pub processed_categories: u32,
    pub total_categories: u32,
    pub successful_imports: u32,
    pub failed_imports: u32,
    pub skipped_recipes: u32,
    pub errors: Vec<BatchImportError>,
    pub start_time: String,
    pub estimated_time_remaining: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportResult {
    pub success: bool,
    pub total_processed: u32,
    pub successful_imports: u32,
    pub failed_imports: u32,
    pub skipped_recipes: u32,
    pub errors: Vec<BatchImportError>,
    pub imported_recipe_ids: Vec<String>,
    pub duration: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportError {
    pub url: String,
    pub message: String,
    pub timestamp: String,
    pub error_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BatchImportStatus {
    Idle,
    Starting,
    CrawlingCategories,
    ExtractingRecipes,
    FilteringExisting,
    ImportingRecipes,
    Completed,
    Cancelled,
    Error,
}

#[derive(Debug, Clone)]
pub struct CategoryInfo {
    pub url: String,
}

pub struct BatchImporter {
    progress: Arc<Mutex<BatchImportProgress>>,
    client: reqwest::Client,
    cancelled: Arc<Mutex<bool>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    imported_recipe_ids: Arc<Mutex<Vec<String>>>,
}

impl BatchImporter {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();

        let progress = BatchImportProgress {
            status: BatchImportStatus::Idle,
            current_url: None,
            processed_recipes: 0,
            total_recipes: 0,
            processed_categories: 0,
            total_categories: 0,
            successful_imports: 0,
            failed_imports: 0,
            skipped_recipes: 0,
            errors: Vec::new(),
            start_time: chrono::Utc::now().to_rfc3339(),
            estimated_time_remaining: None,
        };

        Self {
            progress: Arc::new(Mutex::new(progress)),
            client,
            cancelled: Arc::new(Mutex::new(false)),
            start_time: Arc::new(Mutex::new(None)),
            imported_recipe_ids: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn get_progress(&self) -> BatchImportProgress {
        self.progress.lock().unwrap().clone()
    }

    pub fn cancel(&self) {
        *self.cancelled.lock().unwrap() = true;
        let mut progress = self.progress.lock().unwrap();
        progress.status = BatchImportStatus::Cancelled;
    }

    fn is_cancelled(&self) -> bool {
        *self.cancelled.lock().unwrap()
    }

    fn update_status(&self, status: BatchImportStatus) {
        let mut progress = self.progress.lock().unwrap();
        progress.status = status;
    }

    fn add_error(&self, url: String, message: String, error_type: String) {
        let mut progress = self.progress.lock().unwrap();
        progress.errors.push(BatchImportError {
            url,
            message,
            timestamp: chrono::Utc::now().to_rfc3339(),
            error_type,
        });
    }

    fn calculate_estimated_time_remaining(&self) -> Option<u32> {
        let progress = self.progress.lock().unwrap();
        let start_time = self.start_time.lock().unwrap();

        if let Some(start) = *start_time {
            let elapsed = start.elapsed().as_secs() as u32;
            let processed = progress.processed_recipes;
            let total = progress.total_recipes;

            if processed > 0 && total > processed {
                let avg_time_per_recipe = elapsed as f64 / processed as f64;
                let remaining_recipes = total - processed;
                let estimated_remaining = (remaining_recipes as f64 * avg_time_per_recipe) as u32;
                return Some(estimated_remaining);
            }
        }

        None
    }

    fn update_progress_with_estimation(&self) {
        let estimated_time = self.calculate_estimated_time_remaining();
        let mut progress = self.progress.lock().unwrap();
        progress.estimated_time_remaining = estimated_time;
    }

    pub async fn start_batch_import(&self, app: tauri::AppHandle, request: BatchImportRequest) -> Result<BatchImportResult, String> {
        let start_time = Instant::now();

        // Reset state
        *self.cancelled.lock().unwrap() = false;
        *self.start_time.lock().unwrap() = Some(start_time);
        {
            let mut progress = self.progress.lock().unwrap();
            progress.status = BatchImportStatus::Starting;
            progress.start_time = chrono::Utc::now().to_rfc3339();
            progress.errors.clear();
            progress.processed_recipes = 0;
            progress.successful_imports = 0;
            progress.failed_imports = 0;
            progress.skipped_recipes = 0;
            progress.estimated_time_remaining = None;
        }

        // Validate start URL
        let start_url = match Url::parse(&request.start_url) {
            Ok(url) => url,
            Err(_) => return Err("Invalid start URL".to_string()),
        };

        if !start_url.host_str().unwrap_or("").contains("allrecipes.com") {
            return Err("Only AllRecipes.com URLs are supported for batch import".to_string());
        }

        // Step 1: Crawl categories
        self.update_status(BatchImportStatus::CrawlingCategories);
        let categories = match self.crawl_categories(&request.start_url).await {
            Ok(cats) => cats,
            Err(e) => {
                self.update_status(BatchImportStatus::Error);
                return Err(format!("Failed to crawl categories: {}", e));
            }
        };

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 2: Extract recipe URLs from all categories
        self.update_status(BatchImportStatus::ExtractingRecipes);
        let recipe_urls = match self.extract_all_recipe_urls(&categories).await {
            Ok(urls) => urls,
            Err(e) => {
                self.update_status(BatchImportStatus::Error);
                return Err(format!("Failed to extract recipe URLs: {}", e));
            }
        };

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 3: Filter out existing URLs
        self.update_status(BatchImportStatus::FilteringExisting);
        let (filtered_urls, skipped_count) = self.filter_existing_urls(recipe_urls, &request.existing_urls);

        // Apply max_recipes limit if specified
        let limited_urls = if let Some(max) = request.max_recipes {
            filtered_urls.into_iter().take(max as usize).collect()
        } else {
            filtered_urls
        };

        // Update counts
        {
            let mut progress = self.progress.lock().unwrap();
            progress.total_recipes = limited_urls.len() as u32;
            progress.skipped_recipes = skipped_count;
        }

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 4: Import recipes
        self.update_status(BatchImportStatus::ImportingRecipes);
        self.import_recipes(app, limited_urls).await;

        self.update_status(BatchImportStatus::Completed);
        Ok(self.build_result(start_time))
    }

    async fn crawl_categories(&self, start_url: &str) -> Result<Vec<CategoryInfo>, String> {
        let response = self.client.get(start_url).send().await
            .map_err(|e| format!("Failed to fetch start URL: {}", e))?;

        let html = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        let document = Html::parse_document(&html);
        let mut categories = Vec::new();

        // Add the starting category itself
        categories.push(CategoryInfo {
            url: start_url.to_string(),
        });

        // Extract subcategory links
        // AllRecipes typically has category links in navigation or sidebar
        let category_selectors = [
            "a[href*='/recipes/']",
            ".category-link",
            ".subcategory-link",
            "nav a[href*='/recipes/']",
        ];

        for selector_str in &category_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                for element in document.select(&selector) {
                    if let Some(href) = element.value().attr("href") {
                        let full_url = self.resolve_url(start_url, href)?;

                        // Filter for valid category URLs
                        if self.is_valid_category_url(&full_url) {
                            categories.push(CategoryInfo {
                                url: full_url,
                            });
                        }
                    }
                }
            }
        }

        // Remove duplicates
        categories.sort_by(|a, b| a.url.cmp(&b.url));
        categories.dedup_by(|a, b| a.url == b.url);

        {
            let mut progress = self.progress.lock().unwrap();
            progress.total_categories = categories.len() as u32;
        }

        Ok(categories)
    }

    fn resolve_url(&self, base: &str, href: &str) -> Result<String, String> {
        let base_url = Url::parse(base).map_err(|_| "Invalid base URL")?;
        let resolved = base_url.join(href).map_err(|_| "Failed to resolve URL")?;
        Ok(resolved.to_string())
    }

    fn is_valid_category_url(&self, url: &str) -> bool {
        if let Ok(parsed) = Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                return host.contains("allrecipes.com") && 
                       parsed.path().contains("/recipes/") &&
                       !parsed.path().contains("/recipe/"); // Exclude individual recipes
            }
        }
        false
    }

    async fn extract_all_recipe_urls(&self, categories: &[CategoryInfo]) -> Result<Vec<String>, String> {
        let mut all_recipe_urls = HashSet::new();

        for (index, category) in categories.iter().enumerate() {
            if self.is_cancelled() {
                break;
            }

            {
                let mut progress = self.progress.lock().unwrap();
                progress.current_url = Some(category.url.clone());
                progress.processed_categories = (index + 1) as u32;
            }

            match self.extract_recipe_urls_from_page(&category.url).await {
                Ok(urls) => {
                    for url in urls {
                        all_recipe_urls.insert(url);
                    }
                }
                Err(e) => {
                    self.add_error(
                        category.url.clone(),
                        format!("Failed to extract recipes: {}", e),
                        "ExtractionError".to_string(),
                    );
                }
            }

            // Add delay between requests to be respectful
            sleep(Duration::from_millis(1000)).await;
        }

        Ok(all_recipe_urls.into_iter().collect())
    }

    async fn extract_recipe_urls_from_page(&self, page_url: &str) -> Result<Vec<String>, String> {
        let response = self.client.get(page_url).send().await
            .map_err(|e| format!("Failed to fetch page: {}", e))?;

        let html = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        let document = Html::parse_document(&html);
        let mut recipe_urls = Vec::new();

        // AllRecipes recipe link selectors
        let recipe_selectors = [
            "a[href*='/recipe/']",
            ".recipe-card a",
            ".card-recipe a",
            ".recipe-link",
        ];

        for selector_str in &recipe_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                for element in document.select(&selector) {
                    if let Some(href) = element.value().attr("href") {
                        let full_url = self.resolve_url(page_url, href)?;

                        if self.is_valid_recipe_url(&full_url) {
                            recipe_urls.push(full_url);
                        }
                    }
                }
            }
        }

        // Remove duplicates
        recipe_urls.sort();
        recipe_urls.dedup();

        Ok(recipe_urls)
    }

    fn is_valid_recipe_url(&self, url: &str) -> bool {
        if let Ok(parsed) = Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                let path = parsed.path();

                // Must be AllRecipes and contain /recipe/
                if !host.contains("allrecipes.com") || !path.contains("/recipe/") {
                    return false;
                }

                // Skip URLs that start with a number (non-recipe content)
                // Only check if there's a meaningful path segment after /recipe/
                let path_segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
                if path_segments.len() >= 3 && path_segments[0] == "recipe" {
                    // Check if the ID segment (second element) is followed by a name
                    if path_segments.len() == 2 {
                        // URL like /recipe/123/ - invalid
                        return false;
                    }
                    // URL like /recipe/123/recipe-name - valid
                    return true;
                } else if path_segments.len() == 2 && path_segments[0] == "recipe" {
                    // URL like /recipe/123 - invalid
                    return false;
                }

                return true;
            }
        }
        false
    }

    fn filter_existing_urls(&self, recipe_urls: Vec<String>, existing_urls: &Option<Vec<String>>) -> (Vec<String>, u32) {
        if let Some(existing) = existing_urls {
            let existing_set: HashSet<&String> = existing.iter().collect();
            let mut filtered = Vec::new();
            let mut skipped_count = 0;

            for url in recipe_urls {
                if existing_set.contains(&url) {
                    skipped_count += 1;
                } else {
                    filtered.push(url);
                }
            }

            (filtered, skipped_count)
        } else {
            // No existing URLs provided, return all URLs with 0 skipped
            (recipe_urls, 0)
        }
    }

    async fn import_recipes(&self, app: tauri::AppHandle, recipe_urls: Vec<String>) {
        // Check for cancellation before starting
        if self.is_cancelled() {
            return;
        }

        for (index, url) in recipe_urls.iter().enumerate() {
            if self.is_cancelled() {
                break;
            }

            // Update current URL BEFORE processing
            {
                let mut progress = self.progress.lock().unwrap();
                progress.current_url = Some(url.clone());
            }

            match import_recipe_from_url(url).await {
                Ok(recipe) => {
                    // Call the save function directly
                    match crate::save_imported_recipe(app.clone(), recipe).await {
                        Ok(recipe_id) => {
                            // Track the imported recipe ID
                            {
                                let mut imported_ids = self.imported_recipe_ids.lock().unwrap();
                                imported_ids.push(recipe_id);
                            }
                            
                            let mut progress = self.progress.lock().unwrap();
                            progress.successful_imports += 1;
                        }
                        Err(save_error) => {
                            let mut progress = self.progress.lock().unwrap();
                            progress.failed_imports += 1;

                            self.add_error(
                                url.clone(),
                                format!("Failed to save recipe: {}", save_error),
                                "SaveError".to_string(),
                            );
                        }
                    }
                }
                Err(e) => {
                    let mut progress = self.progress.lock().unwrap();
                    progress.failed_imports += 1;

                    self.add_error(
                        url.clone(),
                        e.message.clone(),
                        e.error_type.clone(),
                    );
                }
            }

            // Update processed count AFTER processing
            {
                let mut progress = self.progress.lock().unwrap();
                progress.processed_recipes = (index + 1) as u32;
            }

            // Update estimated time remaining after processing
            self.update_progress_with_estimation();

            // Add delay between imports to be respectful
            sleep(Duration::from_millis(2000)).await;
        }

        // Final progress update
        {
            let mut progress = self.progress.lock().unwrap();
            progress.current_url = None;
            progress.estimated_time_remaining = Some(0);
            // Don't override processed_count if we were cancelled early
        }
    }

    fn build_result(&self, start_time: Instant) -> BatchImportResult {
        let progress = self.progress.lock().unwrap();
        let imported_ids = self.imported_recipe_ids.lock().unwrap();
        BatchImportResult {
            success: matches!(progress.status, BatchImportStatus::Completed),
            total_processed: progress.processed_recipes,
            successful_imports: progress.successful_imports,
            failed_imports: progress.failed_imports,
            skipped_recipes: progress.skipped_recipes,
            errors: progress.errors.clone(),
            imported_recipe_ids: imported_ids.clone(),
            duration: start_time.elapsed().as_secs() as u32,
        }
    }
}

#[cfg(test)]
mod tests;
