#![allow(non_snake_case)]

use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tokio::task::JoinSet;
use tokio::sync::Semaphore;
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
    rate_limiter: Arc<Semaphore>,
}

// Lightweight struct for task execution
#[derive(Clone)]
struct BatchImporterTask {
    progress: Arc<Mutex<BatchImportProgress>>,
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
            rate_limiter: Arc::new(Semaphore::new(3)), // Allow 3 concurrent imports
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

                // Cap the estimate at a reasonable maximum (24 hours)
                return Some(estimated_remaining.min(86400));
            } else if total > 0 && processed == 0 && elapsed > 5 {
                // Only provide initial estimate after some time has passed (5 seconds)
                // This prevents showing estimates immediately when no progress has been made
                return Some(total * 4);
            }
        }

        None
    }

    fn update_progress_with_estimation(&self) {
        let estimated_time = self.calculate_estimated_time_remaining();
        let mut progress = self.progress.lock().unwrap();
        progress.estimated_time_remaining = estimated_time;
    }

    // Helper method to create a lightweight clone for task execution
    fn clone_for_task(&self) -> BatchImporterTask {
        BatchImporterTask {
            progress: Arc::clone(&self.progress),
        }
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

        // Apply max_recipes limit if specified (for testing purposes only)
        let final_urls = if let Some(max) = request.max_recipes {
            filtered_urls.into_iter().take(max as usize).collect()
        } else {
            filtered_urls
        };

        // Update counts
        {
            let mut progress = self.progress.lock().unwrap();
            progress.total_recipes = final_urls.len() as u32;
            progress.skipped_recipes = skipped_count;
            // Don't set initial time estimate here - let it be calculated dynamically
        }

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 4: Import recipes
        self.update_status(BatchImportStatus::ImportingRecipes);
        self.import_recipes(app, final_urls).await;

        self.update_status(BatchImportStatus::Completed);
        Ok(self.build_result(start_time))
    }

    async fn crawl_categories(&self, start_url: &str) -> Result<Vec<CategoryInfo>, String> {
        // Add timeout wrapper for category crawling
        let timeout_duration = Duration::from_secs(60); // Longer timeout for category discovery

        let result = tokio::time::timeout(timeout_duration, async {
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

            // Extract subcategory links with improved selectors
            let category_selectors = [
                "a[href*='/recipes/'][href*='/']", // Must be a proper category path
                ".category-link[href*='/recipes/']",
                ".subcategory-link[href*='/recipes/']",
                "nav a[href*='/recipes/']",
                ".recipe-category a[href*='/recipes/']",
                ".category-nav a[href*='/recipes/']",
                ".menu a[href*='/recipes/']",
                ".navigation a[href*='/recipes/']",
            ];

            for selector_str in &category_selectors {
                if let Ok(selector) = Selector::parse(selector_str) {
                    for element in document.select(&selector) {
                        if let Some(href) = element.value().attr("href") {
                            match self.resolve_url(start_url, href) {
                                Ok(full_url) => {
                                    // Filter for valid category URLs
                                    if self.is_valid_category_url(&full_url) {
                                        categories.push(CategoryInfo {
                                            url: full_url,
                                        });
                                    }
                                }
                                Err(e) => {
                                    // Log error but continue processing
                                    eprintln!("Warning: Failed to resolve category URL '{}': {}", href, e);
                                }
                            }
                        }
                    }
                }
            }

            // Remove duplicates
            categories.sort_by(|a, b| a.url.cmp(&b.url));
            categories.dedup_by(|a, b| a.url == b.url);

            // Limit the number of categories to prevent excessive crawling
            const MAX_CATEGORIES: usize = 150;
            if categories.len() > MAX_CATEGORIES {
                eprintln!("Warning: Found {} categories, limiting to {} to prevent excessive crawling",
                         categories.len(), MAX_CATEGORIES);
                categories.truncate(MAX_CATEGORIES);
            }

            Ok::<Vec<CategoryInfo>, String>(categories)
        }).await;

        match result {
            Ok(inner_result) => {
                let categories = inner_result?;
                {
                    let mut progress = self.progress.lock().unwrap();
                    progress.total_categories = categories.len() as u32;
                }
                Ok(categories)
            }
            Err(_) => Err(format!("Timeout while crawling categories from: {}", start_url)),
        }
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
        let mut failed_categories = 0;
        const MAX_FAILED_CATEGORIES: usize = 10; // Circuit breaker threshold

        for (index, category) in categories.iter().enumerate() {
            if self.is_cancelled() {
                break;
            }

            // Circuit breaker: if too many categories fail, stop processing
            if failed_categories >= MAX_FAILED_CATEGORIES {
                eprintln!("Warning: Too many category failures ({}), stopping category processing", failed_categories);
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
                    // Reset failure count on success
                    failed_categories = 0;
                }
                Err(e) => {
                    failed_categories += 1;
                    self.add_error(
                        category.url.clone(),
                        format!("Failed to extract recipes (failure #{}/{}): {}", failed_categories, MAX_FAILED_CATEGORIES, e),
                        "ExtractionError".to_string(),
                    );

                    // Add longer delay after failures
                    sleep(Duration::from_millis(2000)).await;
                    continue;
                }
            }

            // Add delay between requests to be respectful
            sleep(Duration::from_millis(1000)).await;
        }

        Ok(all_recipe_urls.into_iter().collect())
    }

    async fn extract_recipe_urls_from_page(&self, page_url: &str) -> Result<Vec<String>, String> {
        // Add timeout wrapper for the entire operation
        let timeout_duration = Duration::from_secs(45); // Slightly longer than client timeout

        let result = tokio::time::timeout(timeout_duration, async {
            let response = self.client.get(page_url).send().await
                .map_err(|e| format!("Failed to fetch page: {}", e))?;

            let html = response.text().await
                .map_err(|e| format!("Failed to read response: {}", e))?;

            self.extract_recipe_urls_from_html(&html, page_url)
        }).await;

        match result {
            Ok(inner_result) => inner_result,
            Err(_) => Err(format!("Timeout while extracting recipe URLs from page: {}", page_url)),
        }
    }

    fn extract_recipe_urls_from_html(&self, html: &str, page_url: &str) -> Result<Vec<String>, String> {
        let document = Html::parse_document(html);
        let mut recipe_urls = Vec::new();

        // Check for infinite scroll indicators that might cause hanging
        if self.has_infinite_scroll_indicators(&document) {
            // Log warning but continue with available content
            eprintln!("Warning: Page {} appears to have infinite scroll, extracting available recipes only", page_url);
        }

        // AllRecipes recipe link selectors - more specific to avoid false positives
        let recipe_selectors = [
            "a[href*='/recipe/'][href*='-']", // Must contain recipe ID and name
            ".recipe-card a[href*='/recipe/']",
            ".card-recipe a[href*='/recipe/']",
            ".recipe-link[href*='/recipe/']",
            "article a[href*='/recipe/']", // Common article-based layouts
            ".recipe-summary a[href*='/recipe/']",
        ];

        for selector_str in &recipe_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                for element in document.select(&selector) {
                    if let Some(href) = element.value().attr("href") {
                        match self.resolve_url(page_url, href) {
                            Ok(full_url) => {
                                if self.is_valid_recipe_url(&full_url) {
                                    recipe_urls.push(full_url);
                                }
                            }
                            Err(e) => {
                                // Log error but continue processing other URLs
                                eprintln!("Warning: Failed to resolve URL '{}' from page '{}': {}", href, page_url, e);
                            }
                        }
                    }
                }
            }
        }

        // Remove duplicates
        recipe_urls.sort();
        recipe_urls.dedup();

        // Limit the number of URLs per page to prevent excessive processing
        const MAX_RECIPES_PER_PAGE: usize = 100;
        if recipe_urls.len() > MAX_RECIPES_PER_PAGE {
            eprintln!("Warning: Found {} recipe URLs on page {}, limiting to {}",
                     recipe_urls.len(), page_url, MAX_RECIPES_PER_PAGE);
            recipe_urls.truncate(MAX_RECIPES_PER_PAGE);
        }

        Ok(recipe_urls)
    }

    fn has_infinite_scroll_indicators(&self, document: &Html) -> bool {
        let infinite_scroll_selectors = [
            ".load-more",
            ".infinite-scroll",
            "#load-more-trigger",
            "[data-infinite-scroll]",
            "[data-load-more]",
            ".pagination-infinite",
            ".endless-scroll",
        ];

        for selector_str in &infinite_scroll_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                if document.select(&selector).next().is_some() {
                    return true;
                }
            }
        }

        // Check for JavaScript-based infinite scroll indicators
        let script_selector = Selector::parse("script").unwrap();
        for script in document.select(&script_selector) {
            let script_content = script.text().collect::<Vec<_>>().join("").to_lowercase();
            if script_content.contains("infinite") && script_content.contains("scroll") {
                return true;
            }
            if script_content.contains("load") && script_content.contains("more") {
                return true;
            }
        }

        false
    }

    fn is_valid_recipe_url(&self, url: &str) -> bool {
        if let Ok(parsed) = Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                let path = parsed.path();

                // Must be AllRecipes and contain /recipe/
                if !host.contains("allrecipes.com") || !path.contains("/recipe/") {
                    return false;
                }

                // Skip URLs that contain "main" as they often cause hanging issues
                if path.to_lowercase().contains("main") || url.to_lowercase().contains("main") {
                    eprintln!("Skipping URL with 'main' to prevent hanging: {}", url);
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

                    // Additional validation: ensure the recipe ID is numeric
                    if let Some(recipe_id) = path_segments.get(1) {
                        if recipe_id.chars().all(|c| c.is_ascii_digit()) {
                            // URL like /recipe/123/recipe-name - valid
                            return true;
                        } else {
                            // URL like /recipe/non-numeric/... - potentially problematic
                            eprintln!("Skipping URL with non-numeric recipe ID: {}", url);
                            return false;
                        }
                    }
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

        // Initialize database connection
        let db = match crate::database::Database::new(&app).await {
            Ok(database) => Arc::new(database),
            Err(e) => {
                self.add_error(
                    "database".to_string(),
                    format!("Failed to initialize database: {}", e),
                    "DatabaseError".to_string(),
                );
                return;
            }
        };

        // Create a JoinSet to manage concurrent tasks
        let mut join_set = JoinSet::new();

        // Create a counter for processed recipes (thread-safe)
        let processed_counter = Arc::new(Mutex::new(0u32));

        // Process recipes concurrently with rate limiting
        for url in recipe_urls.into_iter() {
            if self.is_cancelled() {
                break;
            }

            // Clone necessary data for the task
            let url_clone = url.clone();
            let db_clone = Arc::clone(&db);
            let progress_clone = Arc::clone(&self.progress);
            let cancelled_clone = Arc::clone(&self.cancelled);
            let imported_ids_clone = Arc::clone(&self.imported_recipe_ids);
            let rate_limiter_clone = Arc::clone(&self.rate_limiter);
            let processed_counter_clone = Arc::clone(&processed_counter);
            let self_clone = self.clone_for_task();

            // Spawn a concurrent task for this recipe
            join_set.spawn(async move {
                // Acquire semaphore permit for rate limiting
                let _permit = rate_limiter_clone.acquire().await.unwrap();

                // Check for cancellation before processing
                if *cancelled_clone.lock().unwrap() {
                    return;
                }

                // Update current URL BEFORE processing
                {
                    let mut progress = progress_clone.lock().unwrap();
                    progress.current_url = Some(url_clone.clone());
                }

                // Add delay to respect rate limits (distributed across threads)
                sleep(Duration::from_millis(1000)).await;

                // Import the recipe
                match import_recipe_from_url(&url_clone).await {
                    Ok(imported_recipe) => {
                        // Convert imported recipe to database recipe
                        let db_recipe = self_clone.convert_imported_to_db_recipe(imported_recipe.clone());

                        // Save recipe to database
                        match db_clone.save_recipe(&db_recipe).await {
                            Ok(_) => {
                                // Capture raw ingredients for analysis (don't fail import if this fails)
                                if let Err(e) = self_clone.capture_raw_ingredients_batch(&db_clone, &imported_recipe, Some(&db_recipe.id)).await {
                                    eprintln!("Warning: Failed to capture raw ingredients for {}: {}", url_clone, e);
                                }

                                // Track the imported recipe ID
                                {
                                    let mut imported_ids = imported_ids_clone.lock().unwrap();
                                    imported_ids.push(db_recipe.id.clone());
                                }

                                let mut progress = progress_clone.lock().unwrap();
                                progress.successful_imports += 1;
                            }
                            Err(save_error) => {
                                let mut progress = progress_clone.lock().unwrap();
                                progress.failed_imports += 1;

                                self_clone.add_error(
                                    url_clone.clone(),
                                    format!("Failed to save recipe in transaction: {}", save_error),
                                    "SaveError".to_string(),
                                );
                            }
                        }
                    }
                    Err(e) => {
                        let mut progress = progress_clone.lock().unwrap();
                        progress.failed_imports += 1;

                        self_clone.add_error(
                            url_clone.clone(),
                            e.message.clone(),
                            e.error_type.clone(),
                        );
                    }
                }

                // Update processed count AFTER processing
                {
                    let mut counter = processed_counter_clone.lock().unwrap();
                    *counter += 1;
                    let processed_count = *counter;

                    let mut progress = progress_clone.lock().unwrap();
                    progress.processed_recipes = processed_count;
                }

                // Update estimated time remaining after processing
                self_clone.update_progress_with_estimation();
            });

            // Limit the number of concurrent tasks to prevent overwhelming the system
            if join_set.len() >= 3 {
                // Wait for at least one task to complete before spawning more
                if let Some(result) = join_set.join_next().await {
                    if let Err(e) = result {
                        eprintln!("Task failed: {}", e);
                    }
                }
            }
        }

        // Wait for all remaining tasks to complete
        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                eprintln!("Task failed: {}", e);
            }

            // Check for cancellation
            if self.is_cancelled() {
                // Abort remaining tasks
                join_set.abort_all();
                break;
            }
        }

        // Final progress update
        {
            let mut progress = self.progress.lock().unwrap();
            progress.current_url = None;
            progress.estimated_time_remaining = Some(0);
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

impl BatchImporterTask {
    fn add_error(&self, url: String, message: String, error_type: String) {
        let mut progress = self.progress.lock().unwrap();
        progress.errors.push(BatchImportError {
            url,
            message,
            timestamp: chrono::Utc::now().to_rfc3339(),
            error_type,
        });
    }

    fn convert_imported_to_db_recipe(&self, imported: crate::recipe_import::ImportedRecipe) -> crate::database::Recipe {
        use chrono::Utc;

        let recipe_id = uuid::Uuid::new_v4().to_string();
        let current_time = Utc::now();

        // Parse ingredients from strings to structured format
        let ingredients = imported.ingredients.iter().filter_map(|ingredient_str| {
            // Check if ingredient has section information (format: [Section Name] ingredient text)
            let (section, ingredient_text) = if let Some(captures) = regex::Regex::new(r"^\[([^\]]+)\]\s*(.+)$").unwrap().captures(ingredient_str) {
                (Some(captures[1].to_string()), captures[2].to_string())
            } else {
                (None, ingredient_str.clone())
            };

            // Parse ingredient using improved logic
            parse_ingredient_string_for_db(&ingredient_text, section)
        }).collect();

        // Parse tags from keywords
        let tags: Vec<String> = if imported.keywords.is_empty() {
            Vec::new()
        } else {
            imported.keywords.split(',').map(|s| s.trim().to_string()).collect()
        };

        crate::database::Recipe {
            id: recipe_id,
            title: imported.name,
            description: imported.description,
            image: imported.image,
            source_url: imported.source_url,
            prep_time: imported.prep_time,
            cook_time: imported.cook_time,
            total_time: imported.total_time,
            servings: imported.servings as i32,
            ingredients,
            instructions: imported.instructions,
            tags,
            date_added: current_time,
            date_modified: current_time,
            rating: None,
            difficulty: None,
            is_favorite: Some(false),
            personal_notes: None,
            collections: Vec::new(),
            nutritional_info: None,
        }
    }

    fn update_progress_with_estimation(&self) {
        // For task-level progress updates, we'll implement a simplified version
        // The main BatchImporter will handle the full estimation logic
    }

    async fn capture_raw_ingredients_batch(
        &self,
        db: &crate::database::Database,
        imported_recipe: &crate::recipe_import::ImportedRecipe,
        recipe_id: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let now = chrono::Utc::now();
        let mut raw_ingredients = Vec::new();

        for raw_text in &imported_recipe.ingredients {
            let raw_ingredient = crate::database::RawIngredient {
                id: uuid::Uuid::new_v4().to_string(),
                raw_text: raw_text.clone(),
                source_url: imported_recipe.source_url.clone(),
                recipe_id: recipe_id.map(|id| id.to_string()),
                recipe_title: Some(imported_recipe.name.clone()),
                date_captured: now,
            };
            raw_ingredients.push(raw_ingredient);
        }

        if !raw_ingredients.is_empty() {
            db.save_raw_ingredients_batch(&raw_ingredients).await?;
        }

        Ok(())
    }
}

/// Parse ingredient string into database format with improved logic
fn parse_ingredient_string_for_db(ingredient_text: &str, section: Option<String>) -> Option<crate::database::Ingredient> {
    let trimmed = ingredient_text.trim();

    // Skip empty or invalid ingredients
    if trimmed.is_empty() || !is_valid_ingredient_name(trimmed) {
        return None;
    }

    // Try to parse amount, unit, and name using regex patterns
    let patterns = [
        // Pattern 1: "2 cups all-purpose flour"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|jar|jars|bottle|bottles)\s+(.+)$",
        // Pattern 2: "2 large eggs"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(large|medium|small|whole|fresh|dried)\s+(.+)$",
        // Pattern 3: "1/2 onion, diced"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(.+?)(?:,\s*(.+))?$",
    ];

    for pattern in &patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            if let Some(captures) = regex.captures(trimmed) {
                let amount_str = captures.get(1)?.as_str();
                let amount = parse_fraction_to_decimal(amount_str);

                let (unit, name) = if captures.len() > 3 {
                    // Pattern with unit
                    let unit = captures.get(2)?.as_str().to_string();
                    let name = captures.get(3)?.as_str().to_string();
                    (normalize_unit(&unit), clean_ingredient_name(&name))
                } else {
                    // Pattern without explicit unit
                    let name = captures.get(2)?.as_str().to_string();
                    let cleaned_name = clean_ingredient_name(&name);
                    let unit = if should_use_empty_unit(&cleaned_name) { "".to_string() } else { "unit".to_string() };
                    (unit, cleaned_name)
                };

                if !name.is_empty() && is_valid_ingredient_name(&name) {
                    return Some(crate::database::Ingredient {
                        name,
                        amount: amount.to_string(),
                        unit,
                        category: None,
                        section,
                    });
                }
            }
        }
    }

    // Fallback: treat as ingredient name with amount 1
    let cleaned_name = clean_ingredient_name(trimmed);
    if !cleaned_name.is_empty() && is_valid_ingredient_name(&cleaned_name) {
        let unit = if should_use_empty_unit(&cleaned_name) { "".to_string() } else { "unit".to_string() };
        Some(crate::database::Ingredient {
            name: cleaned_name,
            amount: "1".to_string(),
            unit,
            category: None,
            section,
        })
    } else {
        None
    }
}

/// Parse fraction strings to decimal (reused from main.rs)
fn parse_fraction_to_decimal(amount_str: &str) -> f64 {
    let trimmed = amount_str.trim();

    // Handle mixed numbers like "1 1/2"
    if let Some(space_pos) = trimmed.find(' ') {
        let whole_part = &trimmed[..space_pos];
        let fraction_part = &trimmed[space_pos + 1..];

        let whole = whole_part.parse::<f64>().unwrap_or(0.0);
        let fraction = parse_simple_fraction(fraction_part);
        return whole + fraction;
    }

    // Handle simple fractions like "1/2"
    if trimmed.contains('/') {
        return parse_simple_fraction(trimmed);
    }

    // Handle unicode fractions
    match trimmed {
        "¼" => 0.25,
        "½" => 0.5,
        "¾" => 0.75,
        "⅓" => 0.333,
        "⅔" => 0.667,
        "⅛" => 0.125,
        "⅜" => 0.375,
        "⅝" => 0.625,
        "⅞" => 0.875,
        _ => trimmed.parse::<f64>().unwrap_or(1.0)
    }
}

/// Parse simple fractions like "1/2" (reused from main.rs)
fn parse_simple_fraction(fraction_str: &str) -> f64 {
    if let Some(slash_pos) = fraction_str.find('/') {
        let numerator = fraction_str[..slash_pos].parse::<f64>().unwrap_or(1.0);
        let denominator = fraction_str[slash_pos + 1..].parse::<f64>().unwrap_or(1.0);
        if denominator != 0.0 {
            return numerator / denominator;
        }
    }
    1.0
}

/// Normalize unit names to standard forms (reused from main.rs)
fn normalize_unit(unit: &str) -> String {
    match unit.to_lowercase().as_str() {
        "cup" | "cups" | "c" => "cup".to_string(),
        "tablespoon" | "tablespoons" | "tbsp" | "tbs" => "tbsp".to_string(),
        "teaspoon" | "teaspoons" | "tsp" => "tsp".to_string(),
        "pound" | "pounds" | "lb" => "lb".to_string(),
        "ounce" | "ounces" | "oz" => "oz".to_string(),
        "gram" | "grams" | "g" => "g".to_string(),
        "kilogram" | "kilograms" | "kg" => "kg".to_string(),
        "liter" | "liters" | "l" => "liter".to_string(),
        "milliliter" | "milliliters" | "ml" => "ml".to_string(),
        "pint" | "pints" | "pt" => "pint".to_string(),
        "quart" | "quarts" | "qt" => "quart".to_string(),
        "gallon" | "gallons" | "gal" => "gallon".to_string(),
        "clove" | "cloves" => "clove".to_string(),
        "slice" | "slices" => "slice".to_string(),
        "piece" | "pieces" => "piece".to_string(),
        "can" | "cans" => "can".to_string(),
        "package" | "packages" => "package".to_string(),
        "jar" | "jars" => "jar".to_string(),
        "bottle" | "bottles" => "bottle".to_string(),
        _ => unit.to_string(),
    }
}

/// Clean ingredient name by removing preparation instructions (reused from main.rs)
fn clean_ingredient_name(name: &str) -> String {
    let mut cleaned = name.trim().to_string();

    // Remove preparation instructions after commas
    if let Some(comma_pos) = cleaned.find(',') {
        cleaned = cleaned[..comma_pos].trim().to_string();
    }

    // Remove "to taste" and similar phrases
    cleaned = regex::Regex::new(r"\s*,?\s*(to\s+taste|or\s+to\s+taste|as\s+needed|or\s+as\s+needed|divided)$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    // Remove parenthetical content
    cleaned = regex::Regex::new(r"\s*\([^)]*\)\s*")
        .unwrap()
        .replace_all(&cleaned, " ")
        .to_string();

    // Clean up whitespace
    cleaned = regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string();

    cleaned
}

/// Check if ingredient should use empty unit (for count-based items) (reused from main.rs)
fn should_use_empty_unit(name: &str) -> bool {
    let lower_name = name.to_lowercase();
    let count_based = [
        "egg", "eggs", "onion", "onions", "apple", "apples", "banana", "bananas",
        "lemon", "lemons", "lime", "limes", "orange", "oranges", "potato", "potatoes",
        "tomato", "tomatoes", "carrot", "carrots", "clove", "cloves"
    ];

    count_based.iter().any(|&item| lower_name.contains(item))
}

/// Validate that an ingredient name is reasonable (reused from recipe_import.rs)
fn is_valid_ingredient_name(name: &str) -> bool {
    let trimmed = name.trim();

    // Must have some content
    if trimmed.is_empty() {
        return false;
    }

    // Must contain at least one letter
    if !trimmed.chars().any(|c| c.is_alphabetic()) {
        return false;
    }

    // Reject obviously invalid names
    let invalid_names = [
        "chopped", "sliced", "diced", "minced", "beaten", "melted", "softened",
        "divided", "taste", "needed", "desired", "optional", "garnish",
        "spray", "leaf", "leaves", "caps", "whites", "yolks", "cubed",
        "halved", "quartered", "peeled", "seeded", "trimmed",
        "or more to taste", "or as needed", "to taste", "as needed"
    ];

    let lower_name = trimmed.to_lowercase();
    if invalid_names.iter().any(|&invalid| lower_name == invalid) {
        return false;
    }

    true
}

#[cfg(test)]
mod tests;
