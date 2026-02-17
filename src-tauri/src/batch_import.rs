#![allow(non_snake_case)]

use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tokio::task::JoinSet;
use tokio::sync::Semaphore;
use url::Url;
use uuid;
use tracing::{debug, info, error, warn, instrument};

// Removed unused import: use crate::recipe_import::import_recipe_from_url;


// Threading configuration constants
const RECIPE_IMPORT_CONCURRENT_THREADS: usize = 5; // Concurrent threads for recipe imports
const CATEGORY_SCRAPING_CONCURRENT_THREADS: usize = 3; // Concurrent threads for category scraping

fn host_matches_domain(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{}", domain))
}

fn is_supported_batch_site(host: &str) -> bool {
    host_matches_domain(host, "allrecipes.com")
        || host_matches_domain(host, "americastestkitchen.com")
        || host_matches_domain(host, "seriouseats.com")
        || host_matches_domain(host, "bonappetit.com")
}

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
pub struct BatchImportPreflightResponse {
    pub start_url: String,
    pub estimated_categories: u32,
    pub estimated_recipes: u32,
    pub estimated_duplicates: u32,
    pub estimated_new_recipes: u32,
    pub estimated_eta_min_minutes: u32,
    pub estimated_eta_max_minutes: u32,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReImportRequest {
    pub max_recipes: Option<u32>,
    pub recipe_ids: Option<Vec<String>>, // Optional: specific recipes to re-import
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
#[serde(rename_all = "camelCase")]
pub enum BatchImportStatus {
    Idle,
    Starting,
    CrawlingCategories,
    ExtractingRecipes,
    FilteringExisting,
    ImportingRecipes,
    ReImportingRecipes, // New status for re-import operations
    Completed,
    Cancelled,
    Error,
}

#[derive(Debug, Clone)]
pub struct CategoryInfo {
    pub url: String,
}

#[derive(Debug)]
pub struct BatchImporter {
    progress: Arc<Mutex<BatchImportProgress>>,
    client: reqwest::Client,
    cancelled: Arc<Mutex<bool>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    imported_recipe_ids: Arc<Mutex<Vec<String>>>,
    rate_limiter: Arc<Semaphore>,
}



impl BatchImporter {
    pub fn new() -> Self {
        let mut default_headers = reqwest::header::HeaderMap::new();
        default_headers.insert(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
                .parse().unwrap(),
        );
        default_headers.insert(
            reqwest::header::ACCEPT_LANGUAGE,
            "en-US,en;q=0.9".parse().unwrap(),
        );
        default_headers.insert(
            "Sec-CH-UA".parse::<reqwest::header::HeaderName>().unwrap(),
            r#""Google Chrome";v="120", "Chromium";v="120", "Not-A.Brand";v="99""#.parse().unwrap(),
        );
        default_headers.insert(
            "Sec-CH-UA-Mobile".parse::<reqwest::header::HeaderName>().unwrap(),
            "?0".parse().unwrap(),
        );
        default_headers.insert(
            "Sec-CH-UA-Platform".parse::<reqwest::header::HeaderName>().unwrap(),
            r#""Windows""#.parse().unwrap(),
        );
        default_headers.insert(
            "Sec-Fetch-Dest".parse::<reqwest::header::HeaderName>().unwrap(),
            "document".parse().unwrap(),
        );
        default_headers.insert(
            "Sec-Fetch-Mode".parse::<reqwest::header::HeaderName>().unwrap(),
            "navigate".parse().unwrap(),
        );
        default_headers.insert(
            "Sec-Fetch-Site".parse::<reqwest::header::HeaderName>().unwrap(),
            "none".parse().unwrap(),
        );
        default_headers.insert(
            "Sec-Fetch-User".parse::<reqwest::header::HeaderName>().unwrap(),
            "?1".parse().unwrap(),
        );
        default_headers.insert(
            "Upgrade-Insecure-Requests".parse::<reqwest::header::HeaderName>().unwrap(),
            "1".parse().unwrap(),
        );
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .default_headers(default_headers)
            .gzip(true)
            .brotli(true)
            .deflate(true)
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
            rate_limiter: Arc::new(Semaphore::new(RECIPE_IMPORT_CONCURRENT_THREADS)), // Allow 5 concurrent imports
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


    // Helper method to create a lightweight clone for task execution


    #[instrument(skip_all, fields(start_url = %request.start_url, max_recipes = ?request.max_recipes))]
    pub async fn start_batch_import(&self, app: tauri::AppHandle, request: BatchImportRequest) -> Result<BatchImportResult, String> {
        let start_time = Instant::now();

        info!("=== STARTING BATCH IMPORT ===");
        info!("Starting batch import from URL: {}", request.start_url);
        if let Some(max) = request.max_recipes {
            info!("Max recipes limit set to: {}", max);
        }
        info!("Existing URLs to skip: {}", request.existing_urls.as_ref().map_or(0, |urls| urls.len()));

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

        let host = start_url.host_str().unwrap_or("").to_ascii_lowercase();
        if !is_supported_batch_site(&host) {
            return Err("Only AllRecipes.com, America's Test Kitchen, Serious Eats, and Bon Appétit URLs are supported for batch import".to_string());
        }

        // Step 1: Crawl categories
        info!("Step 1: Crawling categories from {}", request.start_url);
        self.update_status(BatchImportStatus::CrawlingCategories);
        let categories = match self.crawl_categories(&request.start_url).await {
            Ok(cats) => {
                info!("Successfully found {} categories", cats.len());
                cats
            },
            Err(e) => {
                error!("Failed to crawl categories: {}", e);
                self.update_status(BatchImportStatus::Error);
                return Err(format!("Failed to crawl categories: {}", e));
            }
        };
        let categories = self.apply_max_depth_limit(categories, request.max_depth, &request.start_url);
        {
            let mut progress = self.progress.lock().unwrap();
            progress.total_categories = categories.len() as u32;
        }
        info!(
            "Category count after max_depth {:?} filter: {}",
            request.max_depth,
            categories.len()
        );

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 2: Extract recipe URLs from all categories
        info!("Step 2: Extracting recipe URLs from {} categories", categories.len());
        self.update_status(BatchImportStatus::ExtractingRecipes);
        let recipe_urls = match self.extract_all_recipe_urls(&categories).await {
            Ok(urls) => {
                info!("Successfully extracted {} recipe URLs", urls.len());
                urls
            },
            Err(e) => {
                error!("Failed to extract recipe URLs: {}", e);
                self.update_status(BatchImportStatus::Error);
                return Err(format!("Failed to extract recipe URLs: {}", e));
            }
        };

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 3: Filter out existing URLs
        info!("Step 3: Filtering existing URLs");
        self.update_status(BatchImportStatus::FilteringExisting);
        let (filtered_urls, skipped_count) = self.filter_existing_urls(recipe_urls, &request.existing_urls);
        info!("Filtered URLs: {} new, {} skipped (already exist)", filtered_urls.len(), skipped_count);

        // Apply max_recipes limit if specified (for testing purposes only)
        let final_urls = if let Some(max) = request.max_recipes {
            let original_count = filtered_urls.len();
            let limited = filtered_urls.into_iter().take(max as usize).collect::<Vec<_>>();
            info!("Applied max_recipes limit: {} URLs (limited from {})", limited.len(), original_count);
            limited
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
        info!("=== STEP 4: IMPORTING RECIPES ===");
        info!("Starting import of {} recipes", final_urls.len());
        self.update_status(BatchImportStatus::ImportingRecipes);

        // Import recipes and check if cancelled during import
        self.import_recipes(app, final_urls).await;

        // Check if import was cancelled
        if self.is_cancelled() {
            info!("Batch import was cancelled during recipe import phase");
            return Ok(self.build_result(start_time));
        }

        // Mark as completed and build final result
        self.update_status(BatchImportStatus::Completed);
        let result = self.build_result(start_time);

        info!("=== BATCH IMPORT COMPLETED ===");
        info!("Final results: {} successful, {} failed, {} skipped in {}s",
              result.successful_imports, result.failed_imports, result.skipped_recipes, result.duration);
        info!("Imported recipe IDs: {:?}", result.imported_recipe_ids);

        Ok(result)
    }

    #[instrument(skip_all, fields(start_url = %request.start_url, max_recipes = ?request.max_recipes))]
    pub async fn preview_batch_import(&self, request: BatchImportRequest) -> Result<BatchImportPreflightResponse, String> {
        let start_url = Url::parse(&request.start_url)
            .map_err(|_| "Invalid start URL".to_string())?;

        let host = start_url.host_str().unwrap_or("").to_ascii_lowercase();
        if !is_supported_batch_site(&host) {
            return Err("Only AllRecipes.com, America's Test Kitchen, Serious Eats, and Bon Appétit URLs are supported for batch import".to_string());
        }

        let categories = self.crawl_categories(&request.start_url).await?;
        let categories = self.apply_max_depth_limit(categories, request.max_depth, &request.start_url);

        let recipe_urls = self.extract_all_recipe_urls(&categories).await?;
        let estimated_recipes = recipe_urls.len() as u32;

        let (filtered_urls, estimated_duplicates) = self.filter_existing_urls(recipe_urls, &request.existing_urls);
        let filtered_count = filtered_urls.len() as u32;

        let estimated_new_recipes = if let Some(max) = request.max_recipes {
            filtered_count.min(max)
        } else {
            filtered_count
        };

        let (estimated_eta_min_minutes, estimated_eta_max_minutes) =
            Self::estimate_eta_range_minutes(estimated_new_recipes);

        let mut warnings: Vec<String> = Vec::new();
        if estimated_new_recipes == 0 {
            warnings.push("No new recipes were detected for this URL after duplicate filtering.".to_string());
        }
        if estimated_recipes > 200 {
            warnings.push("This import is large and may run for a while.".to_string());
        }
        if categories.len() > 50 {
            warnings.push("A high number of categories were discovered and will increase runtime.".to_string());
        }
        if let Some(max) = request.max_recipes {
            if filtered_count > max {
                warnings.push(format!("Max recipes limit will cap this import at {} recipes.", max));
            }
        }

        Ok(BatchImportPreflightResponse {
            start_url: request.start_url,
            estimated_categories: categories.len() as u32,
            estimated_recipes,
            estimated_duplicates,
            estimated_new_recipes,
            estimated_eta_min_minutes,
            estimated_eta_max_minutes,
            warnings,
        })
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

    fn apply_max_depth_limit(
        &self,
        categories: Vec<CategoryInfo>,
        max_depth: Option<u32>,
        start_url: &str,
    ) -> Vec<CategoryInfo> {
        match max_depth {
            // Current crawler only discovers one level of categories from `start_url`.
            // `max_depth = 0` means "only the starting category".
            Some(0) => {
                let mut start_only: Vec<CategoryInfo> = categories
                    .into_iter()
                    .filter(|category| category.url == start_url)
                    .collect();

                if start_only.is_empty() {
                    start_only.push(CategoryInfo {
                        url: start_url.to_string(),
                    });
                }

                start_only
            }
            _ => categories,
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
                let host = host.to_ascii_lowercase();
                let path = parsed.path();

                if host_matches_domain(&host, "allrecipes.com") {
                    return path.contains("/recipes/") &&
                           !path.contains("/recipe/"); // Exclude individual recipes
                }

                if host_matches_domain(&host, "americastestkitchen.com") {
                    // Must contain /recipes/ but must not be an individual recipe
                    // ATK individual recipes match /recipes/{numeric_id}-{slug}
                    if !path.contains("/recipes/") {
                        return false;
                    }
                    let atk_recipe_pattern = regex::Regex::new(r"/recipes/\d+-[a-zA-Z]").unwrap();
                    return !atk_recipe_pattern.is_match(path);
                }

                if host_matches_domain(&host, "seriouseats.com") {
                    // Serious Eats uses a single listing page as the entry point
                    // (e.g. /all-recipes-5117985). No sub-category crawling is needed —
                    // pagination is handled inside extract_seriouseats_recipe_urls_with_pagination.
                    return false;
                }

                if host_matches_domain(&host, "bonappetit.com") {
                    // Bon Appétit uses a single listing page (/recipes) as the entry point.
                    // No sub-category crawling needed — pagination is handled inside
                    // extract_bonappetit_recipe_urls_with_pagination.
                    return false;
                }
            }
        }
        false
    }

    async fn extract_all_recipe_urls(&self, categories: &[CategoryInfo]) -> Result<Vec<String>, String> {
        let all_recipe_urls = Arc::new(Mutex::new(HashSet::new()));
        let failed_categories = Arc::new(Mutex::new(0usize));
        const MAX_FAILED_CATEGORIES: usize = 10; // Circuit breaker threshold

        info!("Starting concurrent category processing with {} threads", CATEGORY_SCRAPING_CONCURRENT_THREADS);

        // Create a semaphore to limit concurrent category processing
        let category_semaphore = Arc::new(Semaphore::new(CATEGORY_SCRAPING_CONCURRENT_THREADS));
        let mut join_set = JoinSet::new();

        // Process categories concurrently
        for (index, category) in categories.iter().enumerate() {
            if self.is_cancelled() {
                break;
            }

            // Check circuit breaker before spawning new tasks
            {
                let failed_count = *failed_categories.lock().unwrap();
                if failed_count >= MAX_FAILED_CATEGORIES {
                    warn!("Too many category failures ({}), stopping category processing", failed_count);
                    break;
                }
            }

            // Clone necessary data for the async task
            let category_url = category.url.clone();
            let all_recipe_urls_clone = Arc::clone(&all_recipe_urls);
            let failed_categories_clone = Arc::clone(&failed_categories);
            let progress_clone = Arc::clone(&self.progress);
            let cancelled_clone = Arc::clone(&self.cancelled);
            let semaphore_clone = Arc::clone(&category_semaphore);
            let client_clone = self.client.clone();

            // Spawn concurrent task for category processing
            join_set.spawn(async move {
                // Acquire semaphore permit for rate limiting
                let _permit = semaphore_clone.acquire().await.unwrap();

                // Check for cancellation before processing
                if *cancelled_clone.lock().unwrap() {
                    return;
                }

                // Update progress with current category
                {
                    let mut progress = progress_clone.lock().unwrap();
                    progress.current_url = Some(category_url.clone());
                    progress.processed_categories = (index + 1) as u32;
                }

                // Extract recipe URLs from this category page
                match extract_recipe_urls_from_page_concurrent(&client_clone, &category_url).await {
                    Ok(urls) => {
                        // Add URLs to the shared collection
                        {
                            let mut all_urls = all_recipe_urls_clone.lock().unwrap();
                            for url in urls {
                                all_urls.insert(url);
                            }
                        }
                        // Reset failure count on success (per-thread, but that's okay for circuit breaker)
                        // Note: We don't reset the global counter here to maintain circuit breaker behavior
                    }
                    Err(e) => {
                        // Increment failure count
                        let current_failures = {
                            let mut failed_count = failed_categories_clone.lock().unwrap();
                            *failed_count += 1;
                            *failed_count
                        };

                        // Add error to progress (this requires accessing the main importer's progress)
                        // We'll handle this through the main thread after joining
                        error!("Failed to extract recipes from category {} (failure #{}/{}): {}",
                               category_url, current_failures, MAX_FAILED_CATEGORIES, e);

                        // Add longer delay after failures
                        sleep(Duration::from_millis(2000)).await;
                        return;
                    }
                }

                // Add delay between requests to be respectful
                sleep(Duration::from_millis(1000)).await;
            });

            // Limit the number of concurrent category processing tasks
            if join_set.len() >= CATEGORY_SCRAPING_CONCURRENT_THREADS {
                // Wait for at least one task to complete before spawning more
                if let Some(result) = join_set.join_next().await {
                    if let Err(e) = result {
                        error!("Category processing task failed: {}", e);
                    }
                }
            }
        }

        // Wait for all remaining tasks to complete
        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                error!("Category processing task failed: {}", e);
            }
        }

        // Extract final results
        let final_urls = {
            let urls = all_recipe_urls.lock().unwrap();
            urls.iter().cloned().collect::<Vec<String>>()
        };

        let final_failed_count = *failed_categories.lock().unwrap();
        if final_failed_count > 0 {
            warn!("Category processing completed with {} failed categories", final_failed_count);
        }

        info!("Concurrent category processing completed. Extracted {} unique recipe URLs", final_urls.len());
        Ok(final_urls)
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

    fn estimate_eta_range_minutes(estimated_new_recipes: u32) -> (u32, u32) {
        if estimated_new_recipes == 0 {
            return (0, 0);
        }

        // Rough estimate: 3-5 seconds per recipe with a 1 minute crawl/setup floor.
        let min_seconds = estimated_new_recipes * 3 + 60;
        let max_seconds = estimated_new_recipes * 5 + 60;
        let min_minutes = ((min_seconds as f64) / 60.0).ceil() as u32;
        let max_minutes = ((max_seconds as f64) / 60.0).ceil() as u32;
        (min_minutes, max_minutes)
    }

    async fn import_recipes(&self, app: tauri::AppHandle, recipe_urls: Vec<String>) {
        info!("=== IMPORT_RECIPES CALLED ===");
        info!("Number of URLs to import: {}", recipe_urls.len());

        // Check for cancellation before starting
        if self.is_cancelled() {
            warn!("Import cancelled before starting recipe import");
            return;
        }

        // Validate that we have URLs to import
        if recipe_urls.is_empty() {
            warn!("No recipe URLs provided for import");
            return;
        }

        // Test database connection to ensure it's working
        info!("Testing database connection...");
        match crate::database::Database::new(&app).await {
            Ok(_) => {
                info!("Database connection test successful");
            },
            Err(e) => {
                error!("Failed to test database connection: {}", e);
                self.add_error(
                    "database".to_string(),
                    format!("Failed to test database connection: {}", e),
                    "DatabaseError".to_string(),
                );
                return;
            }
        }

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
            let app_clone = app.clone();
            let progress_clone = Arc::clone(&self.progress);
            let cancelled_clone = Arc::clone(&self.cancelled);
            let imported_ids_clone = Arc::clone(&self.imported_recipe_ids);
            let rate_limiter_clone = Arc::clone(&self.rate_limiter);
            let _processed_counter_clone = Arc::clone(&processed_counter);
            // Clone start_time for this task
            let start_time_clone = Arc::clone(&self.start_time);

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

                // Import the recipe using the existing import functionality
                match crate::recipe_import::import_recipe_from_url(&url_clone).await {
                    Ok(imported_recipe) => {
                        info!("Successfully imported recipe: {} from {}", imported_recipe.name, url_clone);

                        // Convert imported recipe to database format and save it
                        let recipe_id = uuid::Uuid::new_v4().to_string();
                        let save_result = {
                            // Convert to frontend format first (with ingredient parsing)
                            let frontend_recipe = crate::conversions::convert_imported_recipe_to_frontend_async(imported_recipe.clone()).await;

                            // Override the generated ID to use our own
                            let mut frontend_recipe = frontend_recipe;
                            frontend_recipe.id = recipe_id.clone();

                            // Convert to database format
                            let db_recipe = crate::conversions::convert_frontend_to_db_recipe(frontend_recipe);

                            // Save to database
                            match crate::database::Database::new(&app_clone).await {
                                Ok(db) => {
                                    match db.save_recipe(&db_recipe).await {
                                        Ok(_) => {
                                            info!("Successfully saved recipe '{}' to database with ID: {}", imported_recipe.name, recipe_id);

                                            // Capture raw ingredients for analysis
                                            if let Err(e) = crate::conversions::capture_raw_ingredients(&db, &imported_recipe, Some(&recipe_id)).await {
                                                error!("Failed to capture raw ingredients for recipe '{}': {}", imported_recipe.name, e);
                                                // Don't fail the entire import for raw ingredient capture failure
                                            }

                                            Ok(())
                                        },
                                        Err(e) => {
                                            error!("Failed to save recipe '{}' to database: {}", imported_recipe.name, e);
                                            Err(format!("Database save error: {}", e))
                                        }
                                    }
                                },
                                Err(e) => {
                                    error!("Failed to create database connection for recipe '{}': {}", imported_recipe.name, e);
                                    Err(format!("Database connection error: {}", e))
                                }
                            }
                        };

                        match save_result {
                            Ok(_) => {
                                // Update progress with success
                                {
                                    let mut progress = progress_clone.lock().unwrap();
                                    progress.successful_imports += 1;
                                    progress.processed_recipes += 1;

                                    // Update estimated time remaining
                                    if progress.processed_recipes > 0 {
                                        if let Some(start_instant) = *start_time_clone.lock().unwrap() {
                                            let elapsed = start_instant.elapsed().as_secs() as f64;
                                            let rate = progress.processed_recipes as f64 / elapsed;
                                            let remaining = progress.total_recipes - progress.processed_recipes;
                                            progress.estimated_time_remaining = Some((remaining as f64 / rate) as u32);
                                        }
                                    }
                                }

                                // Store the imported recipe ID
                                {
                                    let mut imported_ids = imported_ids_clone.lock().unwrap();
                                    imported_ids.push(recipe_id);
                                }
                            },
                            Err(save_error) => {
                                error!("Failed to save imported recipe '{}' from {}: {}", imported_recipe.name, url_clone, save_error);

                                // Update progress with failure (treat as import failure)
                                {
                                    let mut progress = progress_clone.lock().unwrap();
                                    progress.failed_imports += 1;
                                    progress.processed_recipes += 1;
                                    progress.errors.push(crate::batch_import::BatchImportError {
                                        url: url_clone.clone(),
                                        message: save_error,
                                        timestamp: chrono::Utc::now().to_rfc3339(),
                                        error_type: "DatabaseError".to_string(),
                                    });

                                    // Update estimated time remaining
                                    if progress.processed_recipes > 0 {
                                        if let Some(start_instant) = *start_time_clone.lock().unwrap() {
                                            let elapsed = start_instant.elapsed().as_secs() as f64;
                                            let rate = progress.processed_recipes as f64 / elapsed;
                                            let remaining = progress.total_recipes - progress.processed_recipes;
                                            progress.estimated_time_remaining = Some((remaining as f64 / rate) as u32);
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Err(e) => {
                        error!("Failed to import recipe from {}: {}", url_clone, e);

                        // Update progress with failure
                        {
                            let mut progress = progress_clone.lock().unwrap();
                            progress.failed_imports += 1;
                            progress.processed_recipes += 1;
                            progress.errors.push(BatchImportError {
                                url: url_clone.clone(),
                                message: e.message.clone(),
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                error_type: e.error_type.clone(),
                            });

                            // Update estimated time remaining
                            if progress.processed_recipes > 0 {
                                if let Some(start_instant) = *start_time_clone.lock().unwrap() {
                                    let elapsed = start_instant.elapsed().as_secs() as f64;
                                    let rate = progress.processed_recipes as f64 / elapsed;
                                    let remaining = progress.total_recipes - progress.processed_recipes;
                                    progress.estimated_time_remaining = Some((remaining as f64 / rate) as u32);
                                }
                            }
                        }
                    }
                }

                // Clear current URL
                {
                    let mut progress = progress_clone.lock().unwrap();
                    progress.current_url = None;
                }
            });

            // Limit the number of concurrent tasks to prevent overwhelming the system
            if join_set.len() >= RECIPE_IMPORT_CONCURRENT_THREADS {
                // Wait for at least one task to complete before spawning more
                if let Some(result) = join_set.join_next().await {
                    if let Err(e) = result {
                        eprintln!("Task failed: {}", e);
                    }
                }
            }
        }

        // Wait for all remaining tasks to complete
        info!("Waiting for all remaining import tasks to complete...");
        let mut completed_tasks = 0;
        while let Some(result) = join_set.join_next().await {
            completed_tasks += 1;
            if let Err(e) = result {
                error!("Import task failed: {}", e);
            }

            // Check for cancellation
            if self.is_cancelled() {
                warn!("Import cancelled, aborting remaining tasks...");
                join_set.abort_all();
                break;
            }
        }

        // Final progress update and summary
        {
            let mut progress = self.progress.lock().unwrap();
            progress.current_url = None;
            progress.estimated_time_remaining = Some(0);

            info!("=== IMPORT_RECIPES COMPLETED ===");
            info!("Total tasks completed: {}", completed_tasks);
            info!("Final import stats: {} successful, {} failed, {} processed",
                  progress.successful_imports, progress.failed_imports, progress.processed_recipes);
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

// Re-import functionality for existing recipes
#[derive(Debug)]
pub struct ReImporter {
    progress: Arc<Mutex<BatchImportProgress>>,
    cancelled: Arc<Mutex<bool>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    imported_recipe_ids: Arc<Mutex<Vec<String>>>,
    rate_limiter: Arc<Semaphore>,
}

impl ReImporter {
    pub fn new() -> Self {
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
            cancelled: Arc::new(Mutex::new(false)),
            start_time: Arc::new(Mutex::new(None)),
            imported_recipe_ids: Arc::new(Mutex::new(Vec::new())),
            rate_limiter: Arc::new(Semaphore::new(RECIPE_IMPORT_CONCURRENT_THREADS)),
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

    #[instrument(skip_all, fields(max_recipes = ?request.max_recipes))]
    pub async fn start_re_import(&self, app: tauri::AppHandle, request: ReImportRequest) -> Result<BatchImportResult, String> {
        let start_time = Instant::now();

        info!("=== STARTING RE-IMPORT OF EXISTING RECIPES ===");
        if let Some(max) = request.max_recipes {
            info!("Max recipes limit set to: {}", max);
        }

        // Store start time
        {
            let mut start_time_guard = self.start_time.lock().unwrap();
            *start_time_guard = Some(start_time);
        }

        self.update_status(BatchImportStatus::Starting);

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 1: Get all recipes with source URLs from database
        info!("=== STEP 1: RETRIEVING EXISTING RECIPES ===");
        let database = match crate::database::Database::new(&app).await {
            Ok(db) => db,
            Err(e) => {
                error!("Failed to connect to database: {}", e);
                self.add_error(
                    "database".to_string(),
                    format!("Failed to connect to database: {}", e),
                    "DatabaseError".to_string(),
                );
                self.update_status(BatchImportStatus::Error);
                return Ok(self.build_result(start_time));
            }
        };

        let recipes_to_reimport = match database.get_recipes_with_source_urls().await {
            Ok(recipes) => recipes,
            Err(e) => {
                error!("Failed to retrieve recipes with source URLs: {}", e);
                self.add_error(
                    "database".to_string(),
                    format!("Failed to retrieve recipes: {}", e),
                    "DatabaseError".to_string(),
                );
                self.update_status(BatchImportStatus::Error);
                return Ok(self.build_result(start_time));
            }
        };

        info!("Found {} recipes with source URLs for re-import", recipes_to_reimport.len());

        if recipes_to_reimport.is_empty() {
            info!("No recipes with source URLs found, completing re-import");
            self.update_status(BatchImportStatus::Completed);
            return Ok(self.build_result(start_time));
        }

        // Filter by specific recipe IDs if provided
        let final_recipes = if let Some(recipe_ids) = &request.recipe_ids {
            let recipe_id_set: std::collections::HashSet<&String> = recipe_ids.iter().collect();
            recipes_to_reimport.into_iter()
                .filter(|recipe| recipe_id_set.contains(&recipe.id))
                .collect()
        } else {
            recipes_to_reimport
        };

        // Apply max_recipes limit if specified
        let limited_recipes = if let Some(max) = request.max_recipes {
            let original_count = final_recipes.len();
            let limited = final_recipes.into_iter().take(max as usize).collect::<Vec<_>>();
            info!("Applied max_recipes limit: {} recipes (limited from {})", limited.len(), original_count);
            limited
        } else {
            final_recipes
        };

        // Update progress with total count
        {
            let mut progress = self.progress.lock().unwrap();
            progress.total_recipes = limited_recipes.len() as u32;
        }

        if self.is_cancelled() {
            return Ok(self.build_result(start_time));
        }

        // Step 2: Re-import recipes
        info!("=== STEP 2: RE-IMPORTING RECIPES ===");
        info!("Starting re-import of {} recipes", limited_recipes.len());
        self.update_status(BatchImportStatus::ReImportingRecipes);

        self.re_import_recipes(app, limited_recipes).await;

        // Check if re-import was cancelled
        if self.is_cancelled() {
            info!("Re-import was cancelled during processing");
            return Ok(self.build_result(start_time));
        }

        // Complete the re-import
        info!("=== RE-IMPORT COMPLETED ===");
        self.update_status(BatchImportStatus::Completed);

        let result = self.build_result(start_time);
        info!("Re-import finished: {} successful, {} failed, {} total processed",
              result.successful_imports, result.failed_imports, result.total_processed);

        Ok(result)
    }

    async fn re_import_recipes(&self, app: tauri::AppHandle, recipes: Vec<crate::database::Recipe>) {
        if recipes.is_empty() {
            info!("No recipes to re-import");
            return;
        }

        info!("Starting concurrent re-import of {} recipes with {} threads",
              recipes.len(), RECIPE_IMPORT_CONCURRENT_THREADS);

        // Test database connection to ensure it's working
        info!("Testing database connection...");
        match crate::database::Database::new(&app).await {
            Ok(_) => {
                info!("Database connection test successful");
            },
            Err(e) => {
                error!("Failed to test database connection: {}", e);
                self.add_error(
                    "database".to_string(),
                    format!("Failed to test database connection: {}", e),
                    "DatabaseError".to_string(),
                );
                return;
            }
        }

        // Create a JoinSet to manage concurrent tasks
        let mut join_set = JoinSet::new();

        // Create a counter for processed recipes (thread-safe)
        let processed_counter = Arc::new(Mutex::new(0u32));

        // Process recipes concurrently with rate limiting
        for recipe in recipes.into_iter() {
            if self.is_cancelled() {
                break;
            }

            // Clone necessary data for the task
            let recipe_clone = recipe.clone();
            let progress_clone = self.progress.clone();
            let cancelled_clone = self.cancelled.clone();
            let rate_limiter_clone = self.rate_limiter.clone();
            let processed_counter_clone = processed_counter.clone();
            let imported_ids_clone = self.imported_recipe_ids.clone();

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
                    progress.current_url = Some(recipe_clone.source_url.clone());
                }

                // Add delay to respect rate limits (distributed across threads)
                sleep(Duration::from_millis(1000)).await;

                // Re-import the recipe using the existing import functionality
                match crate::recipe_import::import_recipe_from_url(&recipe_clone.source_url).await {
                    Ok(imported_recipe) => {
                        info!("Successfully re-imported recipe: {} from {}", imported_recipe.name, recipe_clone.source_url);

                        // Update progress counters
                        {
                            let mut progress = progress_clone.lock().unwrap();
                            progress.successful_imports += 1;
                            progress.processed_recipes += 1;
                        }

                        // Store the imported recipe ID
                        {
                            let mut imported_ids = imported_ids_clone.lock().unwrap();
                            imported_ids.push(recipe_clone.id.clone());
                        }
                    },
                    Err(e) => {
                        error!("Failed to re-import recipe from {}: {}", recipe_clone.source_url, e);

                        // Update progress counters
                        {
                            let mut progress = progress_clone.lock().unwrap();
                            progress.failed_imports += 1;
                            progress.processed_recipes += 1;
                            progress.errors.push(BatchImportError {
                                url: recipe_clone.source_url.clone(),
                                message: e.to_string(),
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                error_type: "ReImportError".to_string(),
                            });
                        }
                    }
                }

                // Update processed counter
                {
                    let mut counter = processed_counter_clone.lock().unwrap();
                    *counter += 1;
                }
            });

            // Limit the number of concurrent tasks to prevent overwhelming the system
            if join_set.len() >= RECIPE_IMPORT_CONCURRENT_THREADS {
                // Wait for at least one task to complete before spawning more
                if let Some(result) = join_set.join_next().await {
                    if let Err(e) = result {
                        error!("Re-import task failed: {}", e);
                    }
                }
            }
        }

        // Wait for all remaining tasks to complete
        info!("Waiting for all re-import tasks to complete...");
        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                error!("Re-import task failed: {}", e);
            }
        }

        info!("All re-import tasks completed");
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

// Removed BatchImporterTask implementation - using standalone functions instead

/// Standalone function for concurrent category processing (avoids lifetime issues in async tasks)
pub async fn extract_recipe_urls_from_page_concurrent(client: &reqwest::Client, page_url: &str) -> Result<Vec<String>, String> {
    // America's Test Kitchen uses JavaScript-driven "Load More" pagination.
    // We simulate clicking "Load More" repeatedly by fetching ?page=N until no new URLs appear.
    // Serious Eats (Dotdash Meredith platform) also uses ?page=N pagination.
    if let Ok(parsed) = url::Url::parse(page_url) {
        let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
        let path = parsed.path().to_ascii_lowercase();
        // Some tests and non-production hosts proxy an ATK listing path without the ATK host.
        // Treat `/recipes/all` as an ATK-style listing route so pagination behavior is preserved.
        let looks_like_atk_listing = path == "/recipes/all" || path.starts_with("/recipes/all/");

        if host_matches_domain(&host, "americastestkitchen.com") || looks_like_atk_listing {
            return extract_atk_recipe_urls_with_pagination(client, page_url).await;
        }
        if host_matches_domain(&host, "seriouseats.com") {
            return extract_seriouseats_recipe_urls_with_pagination(client, page_url).await;
        }
        if host_matches_domain(&host, "bonappetit.com") {
            return extract_bonappetit_recipe_urls_with_pagination(client, page_url).await;
        }
    }

    // All other sites: single-page fetch with timeout
    let timeout_duration = Duration::from_secs(45); // Slightly longer than client timeout
    let result = tokio::time::timeout(timeout_duration, async {
        let response = client.get(page_url).send().await
            .map_err(|e| format!("Failed to fetch page: {}", e))?;

        let html = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        extract_recipe_urls_from_html_standalone(&html, page_url)
    }).await;

    match result {
        Ok(inner_result) => inner_result,
        Err(_) => Err(format!("Timeout while extracting recipe URLs from page: {}", page_url)),
    }
}

/// Fetches all ATK recipe URLs from a listing page by simulating repeated
/// "Load More" clicks — implemented as sequential `?page=N` requests until
/// no new recipe URLs are found or the page signals there are no more results.
async fn extract_atk_recipe_urls_with_pagination(
    client: &reqwest::Client,
    start_url: &str,
) -> Result<Vec<String>, String> {
    let mut all_urls: HashSet<String> = HashSet::new();
    let mut page: u32 = 1;

    // Hard safety cap — ATK has ~2 000 recipes; 100 pages × 24/page = 2 400
    const MAX_PAGES: u32 = 200;
    // Per-page request timeout (separate from the overall client timeout)
    const PAGE_TIMEOUT_SECS: u64 = 45;

    info!("ATK pagination: starting from {} (max {} pages)", start_url, MAX_PAGES);

    loop {
        if page > MAX_PAGES {
            warn!("ATK pagination: hit safety cap of {} pages, stopping", MAX_PAGES);
            break;
        }

        let page_url = build_atk_page_url(start_url, page);
        info!("ATK pagination: fetching page {} → {}", page, page_url);

        // Fetch the page with its own timeout
        let fetch_result = tokio::time::timeout(Duration::from_secs(PAGE_TIMEOUT_SECS), async {
            let response = client
                .get(&page_url)
                .send()
                .await
                .map_err(|e| format!("Request failed for ATK page {}: {}", page, e))?;

            let status = response.status();
            info!("ATK pagination: page {} — HTTP {}", page, status);

            if !status.is_success() {
                return Err(format!(
                    "HTTP {} for ATK page {} ({})",
                    status,
                    page,
                    page_url
                ));
            }

            response
                .text()
                .await
                .map_err(|e| format!("Failed to read body for ATK page {}: {}", page, e))
        })
        .await;

        let html = match fetch_result {
            Ok(Ok(h)) => h,
            Ok(Err(e)) => {
                warn!("ATK pagination: page {} error — {}", page, e);
                break;
            }
            Err(_) => {
                warn!("ATK pagination: page {} timed out after {}s", page, PAGE_TIMEOUT_SECS);
                break;
            }
        };

        debug!("ATK pagination: page {} — fetched {} bytes of HTML", page, html.len());

        // On the first page, log a snippet of the response so we can diagnose
        // what ATK is actually returning (helpful for debugging bot-detection issues).
        if page == 1 {
            // Use chars() to avoid slicing in the middle of a multi-byte UTF-8 sequence.
            let snippet: String = html.chars().take(800).collect();
            info!(
                "ATK pagination: first 800 chars of page 1 HTML:\n{}",
                snippet
            );

            // Log whether __NEXT_DATA__ is present and its content
            if let Some(next_data_offset) = html.find("__NEXT_DATA__") {
                // Slice from the tag onwards (safe: find() returns a char-boundary offset for ASCII)
                let preview: String = html[next_data_offset..].chars().take(3000).collect();
                info!(
                    "ATK pagination: __NEXT_DATA__ found at byte offset {}. Preview:\n{}",
                    next_data_offset,
                    preview
                );
            } else {
                info!(
                    "ATK pagination: NO __NEXT_DATA__ found in page 1 HTML \
                     — page may be a bot-detection wall or login redirect. \
                     Check the HTML snippet above."
                );
            }
        }

        // Count total <a> tags in the HTML for diagnostic logging
        {
            let diag_doc = Html::parse_document(&html);
            let all_a = Selector::parse("a").map(|s| diag_doc.select(&s).count()).unwrap_or(0);
            let recipe_a = Selector::parse("a[href*='/recipes/']")
                .map(|s| diag_doc.select(&s).count())
                .unwrap_or(0);
            info!(
                "ATK pagination: page {} — {} total <a> tags, {} with href containing '/recipes/'",
                page, all_a, recipe_a
            );
        }

        // Parse recipe URLs from this page via CSS selectors
        let css_urls = match extract_recipe_urls_from_html_standalone(&html, &page_url) {
            Ok(urls) => urls,
            Err(e) => {
                warn!("ATK pagination: HTML extraction failed on page {}: {}", page, e);
                break;
            }
        };
        info!(
            "ATK pagination: page {} — CSS extraction returned {} valid recipe URLs",
            page,
            css_urls.len()
        );

        // If CSS extraction found nothing, fall back to __NEXT_DATA__ JSON parsing.
        // ATK renders recipe cards via React client-side, so reqwest (no JS) may get
        // HTML with no <a href="/recipes/..."> tags. The recipe data is embedded in
        // the <script id="__NEXT_DATA__"> tag as Next.js server-side props.
        let page_urls = if css_urls.is_empty() {
            info!(
                "ATK pagination: page {} — no <a> recipe links found via CSS; \
                 trying __NEXT_DATA__ JSON fallback",
                page
            );
            let next_data_urls = extract_atk_urls_from_next_data(&html, &page_url);
            if next_data_urls.is_empty() {
                info!(
                    "ATK pagination: page {} — __NEXT_DATA__ fallback also found 0 URLs; stopping",
                    page
                );
                break;
            }
            info!(
                "ATK pagination: page {} — __NEXT_DATA__ fallback found {} recipe URLs",
                page,
                next_data_urls.len()
            );
            next_data_urls
        } else {
            css_urls
        };

        let before = all_urls.len();
        for url in &page_urls {
            all_urls.insert(url.clone());
        }
        let new_count = all_urls.len() - before;
        info!(
            "ATK pagination: page {} — {} links found, {} new (running total: {})",
            page,
            page_urls.len(),
            new_count,
            all_urls.len()
        );

        // If every URL on this page was already collected, we've looped back to the start —
        // the site is no longer returning new content, so stop.
        if new_count == 0 {
            info!("ATK pagination: page {} had no new URLs, stopping", page);
            break;
        }

        // Check whether the page signals that more results are available.
        // We use two signals:
        //   1. A "Load More" / "Next page" element is present in the HTML.
        //   2. The __NEXT_DATA__ props include a totalCount that we haven't reached yet.
        // Either signal being true means we should keep going.
        let has_more = atk_page_has_more(&html) || {
            // Fallback: if the page returned a full batch, assume there's another page.
            // ATK typically shows 24 items per page.
            page_urls.len() >= 20
        };

        if !has_more {
            info!("ATK pagination: no 'Load More' signal on page {}, stopping", page);
            break;
        }

        page += 1;
        // Be respectful to ATK's servers — 1.5 s between pages.
        sleep(Duration::from_millis(1500)).await;
    }

    info!(
        "ATK pagination complete: {} unique recipe URLs collected over {} page(s)",
        all_urls.len(),
        page
    );
    Ok(all_urls.into_iter().collect())
}

/// Fetches all Serious Eats recipe URLs from a listing page using `?page=N` pagination.
///
/// Serious Eats runs on the Dotdash Meredith platform (acquired 2021) and is
/// server-side rendered, so every page of results is available via plain HTTP.
/// Recipe cards use the `.mntl-card-list-items` / `.mntl-document-card` CSS classes.
/// Pagination works identically to ATK — append `?page=N` and stop when a page
/// returns no new URLs.
async fn extract_seriouseats_recipe_urls_with_pagination(
    client: &reqwest::Client,
    start_url: &str,
) -> Result<Vec<String>, String> {
    let mut all_urls: HashSet<String> = HashSet::new();
    let mut page: u32 = 1;

    // Serious Eats has ~10 000+ recipes; cap well above that to be safe.
    const MAX_PAGES: u32 = 400;
    const PAGE_TIMEOUT_SECS: u64 = 45;

    info!("Serious Eats pagination: starting from {} (max {} pages)", start_url, MAX_PAGES);

    loop {
        if page > MAX_PAGES {
            warn!("Serious Eats pagination: hit safety cap of {} pages, stopping", MAX_PAGES);
            break;
        }

        // build_atk_page_url is generic — it just adds/replaces ?page=N.
        let page_url = build_atk_page_url(start_url, page);
        info!("Serious Eats pagination: fetching page {} → {}", page, page_url);

        let fetch_result = tokio::time::timeout(Duration::from_secs(PAGE_TIMEOUT_SECS), async {
            let response = client
                .get(&page_url)
                .send()
                .await
                .map_err(|e| format!("Request failed for SE page {}: {}", page, e))?;

            let status = response.status();
            info!("Serious Eats pagination: page {} — HTTP {}", page, status);

            if !status.is_success() {
                return Err(format!(
                    "HTTP {} for Serious Eats page {} ({})",
                    status, page, page_url
                ));
            }

            response
                .text()
                .await
                .map_err(|e| format!("Failed to read body for SE page {}: {}", page, e))
        })
        .await;

        let html = match fetch_result {
            Ok(Ok(h)) => h,
            Ok(Err(e)) => {
                warn!("Serious Eats pagination: page {} error — {}", page, e);
                break;
            }
            Err(_) => {
                warn!(
                    "Serious Eats pagination: page {} timed out after {}s",
                    page, PAGE_TIMEOUT_SECS
                );
                break;
            }
        };

        debug!(
            "Serious Eats pagination: page {} — fetched {} bytes of HTML",
            page,
            html.len()
        );

        // On page 1 log a diagnostic snippet to aid debugging.
        if page == 1 {
            let snippet: String = html.chars().take(800).collect();
            info!(
                "Serious Eats pagination: first 800 chars of page 1 HTML:\n{}",
                snippet
            );
        }

        // Diagnostic: count recipe card anchors before filtering.
        {
            let diag_doc = Html::parse_document(&html);
            let card_count = Selector::parse("a.mntl-card-list-items")
                .map(|s| diag_doc.select(&s).count())
                .unwrap_or(0);
            let doc_card_count = Selector::parse("a.mntl-document-card")
                .map(|s| diag_doc.select(&s).count())
                .unwrap_or(0);
            info!(
                "Serious Eats pagination: page {} — {} .mntl-card-list-items, {} .mntl-document-card links",
                page, card_count, doc_card_count
            );
        }

        // Extract validated recipe URLs from this page's HTML.
        let page_urls = match extract_recipe_urls_from_html_standalone(&html, &page_url) {
            Ok(urls) => urls,
            Err(e) => {
                warn!(
                    "Serious Eats pagination: HTML extraction failed on page {}: {}",
                    page, e
                );
                break;
            }
        };

        info!(
            "Serious Eats pagination: page {} — CSS extraction returned {} valid recipe URLs",
            page,
            page_urls.len()
        );

        // No URLs found → we've gone past the last page of results.
        if page_urls.is_empty() {
            info!(
                "Serious Eats pagination: page {} found 0 recipe URLs, stopping",
                page
            );
            break;
        }

        let before = all_urls.len();
        for url in &page_urls {
            all_urls.insert(url.clone());
        }
        let new_count = all_urls.len() - before;

        info!(
            "Serious Eats pagination: page {} — {} links found, {} new (running total: {})",
            page,
            page_urls.len(),
            new_count,
            all_urls.len()
        );

        // No new URLs → we've wrapped around to content already seen.
        if new_count == 0 {
            info!(
                "Serious Eats pagination: page {} had no new URLs, stopping",
                page
            );
            break;
        }

        page += 1;
        // Be respectful to Serious Eats' servers.
        sleep(Duration::from_millis(1500)).await;
    }

    info!(
        "Serious Eats pagination complete: {} unique recipe URLs collected over {} page(s)",
        all_urls.len(),
        page
    );
    Ok(all_urls.into_iter().collect())
}

/// Fetches all Bon Appétit recipe URLs from a listing page using `?page=N` pagination.
///
/// Bon Appétit runs on Condé Nast's Next.js-based CMS. The listing page at
/// `/recipes` is server-side rendered with Next.js, so recipe links may be
/// present directly in the HTML. A `__NEXT_DATA__` JSON blob is always embedded
/// as a fallback (same strategy used for ATK).
///
/// Individual recipe URLs follow the pattern `bonappetit.com/recipe/{slug}`
/// (singular "recipe", no numeric ID).
async fn extract_bonappetit_recipe_urls_with_pagination(
    client: &reqwest::Client,
    start_url: &str,
) -> Result<Vec<String>, String> {
    let mut all_urls: HashSet<String> = HashSet::new();
    let mut page: u32 = 1;

    // Bon Appétit has thousands of recipes; a large but finite cap.
    const MAX_PAGES: u32 = 500;
    const PAGE_TIMEOUT_SECS: u64 = 45;

    info!("Bon Appétit pagination: starting from {} (max {} pages)", start_url, MAX_PAGES);

    loop {
        if page > MAX_PAGES {
            warn!("Bon Appétit pagination: hit safety cap of {} pages, stopping", MAX_PAGES);
            break;
        }

        // Reuse the generic ?page=N builder.
        let page_url = build_atk_page_url(start_url, page);
        info!("Bon Appétit pagination: fetching page {} → {}", page, page_url);

        let fetch_result = tokio::time::timeout(Duration::from_secs(PAGE_TIMEOUT_SECS), async {
            let response = client
                .get(&page_url)
                .send()
                .await
                .map_err(|e| format!("Request failed for BA page {}: {}", page, e))?;

            let status = response.status();
            info!("Bon Appétit pagination: page {} — HTTP {}", page, status);

            if !status.is_success() {
                return Err(format!(
                    "HTTP {} for Bon Appétit page {} ({})",
                    status, page, page_url
                ));
            }

            response
                .text()
                .await
                .map_err(|e| format!("Failed to read body for BA page {}: {}", page, e))
        })
        .await;

        let html = match fetch_result {
            Ok(Ok(h)) => h,
            Ok(Err(e)) => {
                warn!("Bon Appétit pagination: page {} error — {}", page, e);
                break;
            }
            Err(_) => {
                warn!(
                    "Bon Appétit pagination: page {} timed out after {}s",
                    page, PAGE_TIMEOUT_SECS
                );
                break;
            }
        };

        debug!(
            "Bon Appétit pagination: page {} — fetched {} bytes of HTML",
            page,
            html.len()
        );

        // On page 1 log a diagnostic snippet and check for __NEXT_DATA__.
        if page == 1 {
            let snippet: String = html.chars().take(800).collect();
            info!(
                "Bon Appétit pagination: first 800 chars of page 1 HTML:\n{}",
                snippet
            );
            if let Some(nd_offset) = html.find("__NEXT_DATA__") {
                let preview: String = html[nd_offset..].chars().take(3000).collect();
                info!(
                    "Bon Appétit pagination: __NEXT_DATA__ found at byte {}. Preview:\n{}",
                    nd_offset, preview
                );
            } else {
                info!(
                    "Bon Appétit pagination: NO __NEXT_DATA__ in page 1 — \
                     page may be blocked or redirected. Check HTML snippet above."
                );
            }
        }

        // Diagnostic: count direct recipe links in the DOM.
        {
            let diag_doc = Html::parse_document(&html);
            let direct_links = Selector::parse("a[href*='/recipe/']")
                .map(|s| diag_doc.select(&s).count())
                .unwrap_or(0);
            info!(
                "Bon Appétit pagination: page {} — {} <a href*='/recipe/'> tags in DOM",
                page, direct_links
            );
        }

        // Try CSS extraction first (works when Next.js SSR includes recipe links).
        let css_urls = match extract_recipe_urls_from_html_standalone(&html, &page_url) {
            Ok(urls) => urls,
            Err(e) => {
                warn!(
                    "Bon Appétit pagination: CSS extraction failed on page {}: {}",
                    page, e
                );
                Vec::new()
            }
        };

        info!(
            "Bon Appétit pagination: page {} — CSS extraction returned {} valid recipe URLs",
            page,
            css_urls.len()
        );

        // Fall back to __NEXT_DATA__ JSON if CSS found nothing.
        let page_urls = if css_urls.is_empty() {
            info!(
                "Bon Appétit pagination: page {} — no CSS links found; \
                 trying __NEXT_DATA__ JSON fallback",
                page
            );
            let next_data_urls = extract_bonappetit_urls_from_next_data(&html, &page_url);
            if next_data_urls.is_empty() {
                info!(
                    "Bon Appétit pagination: page {} — __NEXT_DATA__ fallback also found 0 URLs; stopping",
                    page
                );
                break;
            }
            info!(
                "Bon Appétit pagination: page {} — __NEXT_DATA__ fallback found {} recipe URLs",
                page,
                next_data_urls.len()
            );
            next_data_urls
        } else {
            css_urls
        };

        let before = all_urls.len();
        for url in &page_urls {
            all_urls.insert(url.clone());
        }
        let new_count = all_urls.len() - before;

        info!(
            "Bon Appétit pagination: page {} — {} links found, {} new (running total: {})",
            page,
            page_urls.len(),
            new_count,
            all_urls.len()
        );

        // No new URLs → we've wrapped around to already-seen content.
        if new_count == 0 {
            info!("Bon Appétit pagination: page {} had no new URLs, stopping", page);
            break;
        }

        // Keep going if the page returned a reasonable batch size.
        let has_more = page_urls.len() >= 10;
        if !has_more {
            info!(
                "Bon Appétit pagination: page {} returned only {} URLs (< 10), stopping",
                page,
                page_urls.len()
            );
            break;
        }

        page += 1;
        // Respectful delay between requests.
        sleep(Duration::from_millis(1500)).await;
    }

    info!(
        "Bon Appétit pagination complete: {} unique recipe URLs collected over {} page(s)",
        all_urls.len(),
        page
    );
    Ok(all_urls.into_iter().collect())
}

/// Extract Bon Appétit recipe URLs from the `__NEXT_DATA__` JSON embedded by Next.js.
///
/// Bon Appétit is built on Condé Nast's Next.js CMS. When the page is rendered
/// server-side, it embeds initial props (including recipe slugs) inside a
/// `<script id="__NEXT_DATA__">` tag. This function recursively walks the JSON
/// and collects every string that matches the BA recipe path pattern `/recipe/`.
pub(crate) fn extract_bonappetit_urls_from_next_data(html: &str, base_url: &str) -> Vec<String> {
    let document = Html::parse_document(html);

    let script_sel = match Selector::parse("script#__NEXT_DATA__") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let script = match document.select(&script_sel).next() {
        Some(s) => s,
        None => {
            debug!("BA __NEXT_DATA__: no <script id=\"__NEXT_DATA__\"> found");
            return Vec::new();
        }
    };

    let raw = script.inner_html();
    debug!("BA __NEXT_DATA__: found JSON blob ({} chars)", raw.len());

    let json: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(j) => j,
        Err(e) => {
            warn!("BA __NEXT_DATA__: failed to parse JSON: {}", e);
            return Vec::new();
        }
    };

    // BA individual recipe paths: /recipe/{slug}  (no numeric prefix, unlike ATK)
    let ba_recipe_pattern = match regex::Regex::new(r"^/recipe/[a-zA-Z0-9]") {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let mut found_paths: Vec<String> = Vec::new();
    collect_atk_recipe_paths(&json, &ba_recipe_pattern, &mut found_paths);

    debug!(
        "BA __NEXT_DATA__: recursive scan found {} candidate paths",
        found_paths.len()
    );

    // Resolve to absolute URLs using the base origin.
    let base_origin = if let Ok(parsed) = url::Url::parse(base_url) {
        format!(
            "{}://{}",
            parsed.scheme(),
            parsed.host_str().unwrap_or("www.bonappetit.com")
        )
    } else {
        "https://www.bonappetit.com".to_string()
    };

    let mut result: Vec<String> = found_paths
        .into_iter()
        .map(|path| {
            if path.starts_with("http://") || path.starts_with("https://") {
                path
            } else {
                format!("{}{}", base_origin, path)
            }
        })
        .filter(|url| is_valid_recipe_url_standalone(url))
        .collect();

    // Deduplicate while preserving order.
    let mut seen = HashSet::new();
    result.retain(|url| seen.insert(url.clone()));

    info!(
        "BA __NEXT_DATA__: extracted {} valid, unique recipe URLs",
        result.len()
    );
    result
}

/// Build the URL for ATK page N, adding or replacing the `page` query parameter.
pub fn build_atk_page_url(base_url: &str, page: u32) -> String {
    if page == 1 {
        return base_url.to_string();
    }

    if let Ok(mut parsed) = url::Url::parse(base_url) {
        // Rebuild query string, removing any existing `page` param
        let existing: Vec<(String, String)> = parsed
            .query_pairs()
            .filter(|(k, _)| k != "page")
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        let mut new_pairs = existing;
        new_pairs.push(("page".to_string(), page.to_string()));

        let query = new_pairs
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&");

        parsed.set_query(Some(&query));
        return parsed.to_string();
    }

    // Fallback: simple string append
    let base = base_url.trim_end_matches('/');
    if base.contains('?') {
        format!("{}&page={}", base, page)
    } else {
        format!("{}?page={}", base, page)
    }
}

/// Detect whether an ATK page still has more results to load.
///
/// We check:
///  1. Explicit "Load More" / "Next page" HTML elements.
///  2. `__NEXT_DATA__` JSON for a `totalCount` / `hasNextPage` field.
pub fn atk_page_has_more(html: &str) -> bool {
    let document = Html::parse_document(html);

    // --- 1. DOM-based signals ---
    // Button / link text: "Load More", "Show More", "More Recipes"
    for selector_str in &["button", "a", "[role='button']"] {
        if let Ok(sel) = Selector::parse(selector_str) {
            for el in document.select(&sel) {
                let text = el.text().collect::<String>().to_lowercase();
                if text.contains("load more")
                    || text.contains("show more")
                    || text.contains("more recipes")
                    || text.contains("next page")
                {
                    return true;
                }
            }
        }
    }

    // Common CSS-class / attribute signals for a "Load More" button
    let dom_selectors = [
        "button[data-testid*='load-more']",
        "button[data-testid*='LoadMore']",
        "[class*='load-more']",
        "[class*='LoadMore']",
        "[data-load-more]",
        "a[rel='next']",
        "link[rel='next']",
        "[aria-label='Next page']",
        "[aria-label='Load more']",
        ".pagination__next:not([disabled]):not([aria-disabled='true'])",
    ];
    for selector_str in &dom_selectors {
        if let Ok(sel) = Selector::parse(selector_str) {
            if document.select(&sel).next().is_some() {
                return true;
            }
        }
    }

    // --- 2. __NEXT_DATA__ JSON ---
    // ATK is built with Next.js; the server embeds initial props in a script tag.
    // We look for `hasNextPage`, `totalCount`/`total` vs items seen, etc.
    if let Ok(script_sel) = Selector::parse("script#__NEXT_DATA__") {
        if let Some(script) = document.select(&script_sel).next() {
            let raw = script.inner_html();
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                // Traverse into props.pageProps (common Next.js shape).
                // Use an owned Null as the fallback to avoid temporary-lifetime issues.
                let null_value = serde_json::Value::Null;
                let page_props = json
                    .pointer("/props/pageProps")
                    .unwrap_or(&null_value);

                // hasNextPage flag
                if let Some(hnp) = page_props.pointer("/pagination/hasNextPage")
                    .or_else(|| page_props.pointer("/hasNextPage"))
                    .or_else(|| page_props.pointer("/meta/hasNextPage"))
                {
                    if hnp.as_bool() == Some(true) {
                        return true;
                    }
                    if hnp.as_bool() == Some(false) {
                        return false;
                    }
                }

                // totalCount vs items loaded so far
                let total = page_props
                    .pointer("/pagination/totalCount")
                    .or_else(|| page_props.pointer("/totalCount"))
                    .or_else(|| page_props.pointer("/meta/totalCount"))
                    .or_else(|| page_props.pointer("/total"))
                    .and_then(|v| v.as_u64());

                let loaded = page_props
                    .pointer("/pagination/loadedCount")
                    .or_else(|| page_props.pointer("/recipes"))
                    .and_then(|v| {
                        if let Some(arr) = v.as_array() {
                            Some(arr.len() as u64)
                        } else {
                            v.as_u64()
                        }
                    });

                if let (Some(total), Some(loaded)) = (total, loaded) {
                    return loaded < total;
                }
            }
        }
    }

    // Default: conservatively say there might be more
    // (the caller will stop naturally when no new URLs appear).
    false
}

/// Extract ATK recipe URLs from the `__NEXT_DATA__` JSON embedded by Next.js.
///
/// ATK renders recipe cards client-side with React, so a plain HTTP fetch (no
/// JavaScript) returns HTML that contains no `<a href="/recipes/...">` links.
/// However, Next.js embeds the server-side props — including the full list of
/// recipes for the current page — inside a `<script id="__NEXT_DATA__">` tag.
/// This function parses that JSON and recursively extracts every string that
/// looks like an ATK recipe path (`/recipes/{id}-{slug}`).
pub(crate) fn extract_atk_urls_from_next_data(html: &str, base_url: &str) -> Vec<String> {
    let document = Html::parse_document(html);

    let script_sel = match Selector::parse("script#__NEXT_DATA__") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let script = match document.select(&script_sel).next() {
        Some(s) => s,
        None => {
            debug!("ATK __NEXT_DATA__: no <script id=\"__NEXT_DATA__\"> tag found in HTML");
            return Vec::new();
        }
    };

    let raw = script.inner_html();
    debug!("ATK __NEXT_DATA__: found JSON blob ({} chars)", raw.len());

    let json: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(j) => j,
        Err(e) => {
            warn!("ATK __NEXT_DATA__: failed to parse JSON: {}", e);
            return Vec::new();
        }
    };

    // Recursively walk the entire JSON tree and collect every string that
    // matches the ATK individual-recipe path pattern.
    let atk_recipe_pattern = match regex::Regex::new(r"^/recipes/\d+-[a-zA-Z]") {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let mut found_paths: Vec<String> = Vec::new();
    collect_atk_recipe_paths(&json, &atk_recipe_pattern, &mut found_paths);

    debug!(
        "ATK __NEXT_DATA__: recursive scan found {} candidate paths",
        found_paths.len()
    );

    // Resolve to absolute URLs
    let base_origin = if let Ok(parsed) = url::Url::parse(base_url) {
        format!(
            "{}://{}",
            parsed.scheme(),
            parsed.host_str().unwrap_or("www.americastestkitchen.com")
        )
    } else {
        "https://www.americastestkitchen.com".to_string()
    };

    let mut result: Vec<String> = found_paths
        .into_iter()
        .map(|path| {
            if path.starts_with("http://") || path.starts_with("https://") {
                path
            } else {
                format!("{}{}", base_origin, path)
            }
        })
        .filter(|url| is_valid_recipe_url_standalone(url))
        .collect();

    // Deduplicate while preserving order
    let mut seen = HashSet::new();
    result.retain(|url| seen.insert(url.clone()));

    info!(
        "ATK __NEXT_DATA__: extracted {} valid, unique recipe URLs",
        result.len()
    );
    result
}

/// Recursively walk a `serde_json::Value` tree and collect every `String`
/// value that matches `pattern` into `found`.
fn collect_atk_recipe_paths(
    value: &serde_json::Value,
    pattern: &regex::Regex,
    found: &mut Vec<String>,
) {
    match value {
        serde_json::Value::String(s) => {
            if pattern.is_match(s) {
                found.push(s.clone());
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_atk_recipe_paths(item, pattern, found);
            }
        }
        serde_json::Value::Object(obj) => {
            for (_, v) in obj {
                collect_atk_recipe_paths(v, pattern, found);
            }
        }
        _ => {}
    }
}

/// Standalone function to extract recipe URLs from HTML (avoids lifetime issues in async tasks)
fn extract_recipe_urls_from_html_standalone(html: &str, base_url: &str) -> Result<Vec<String>, String> {
    let document = Html::parse_document(html);
    let mut recipe_urls = Vec::new();

    // Recipe link selectors for AllRecipes, America's Test Kitchen, and Serious Eats
    let recipe_selectors = [
        // AllRecipes: individual recipe path /recipe/{id}/{name}
        "a[href*='/recipe/'][href*='/']",
        ".recipe-card a[href*='/recipe/']",
        ".recipe-link[href*='/recipe/']",
        ".card-recipe a[href*='/recipe/']",
        ".recipe-item a[href*='/recipe/']",
        ".recipe-title a[href*='/recipe/']",
        ".recipe-summary a[href*='/recipe/']",
        ".recipe-grid a[href*='/recipe/']",
        ".recipe-list a[href*='/recipe/']",
        ".recipe-collection a[href*='/recipe/']",
        // America's Test Kitchen: recipe path /recipes/{id}-{slug}
        "a[href*='/recipes/']",
        // Serious Eats (Dotdash Meredith platform): recipe cards
        "a.mntl-card-list-items[href]",
        "a.mntl-document-card[href]",
        ".mntl-card-list-items a[href]",
        // Bon Appétit (Condé Nast / Next.js CMS): recipe card links
        // The CMS uses BEM-style or CSS-module class names; target by data-testid and href pattern.
        "a[href^='/recipe/'][href]",
        "[data-testid='SummaryItemHed'] a[href]",
        "[class*='SummaryItemHedLink'] a[href]",
        "a[class*='SummaryItemHedLink'][href]",
    ];

    for selector_str in &recipe_selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            for element in document.select(&selector) {
                if let Some(href) = element.value().attr("href") {
                    match resolve_url_standalone(base_url, href) {
                        Ok(full_url) => {
                            // Filter for valid recipe URLs
                            if is_valid_recipe_url_standalone(&full_url) {
                                recipe_urls.push(full_url);
                            }
                        }
                        Err(e) => {
                            // Log error but continue processing
                            eprintln!("Warning: Failed to resolve recipe URL '{}': {}", href, e);
                        }
                    }
                }
            }
        }
    }

    // Remove duplicates while preserving order
    let mut seen = HashSet::new();
    recipe_urls.retain(|url| seen.insert(url.clone()));

    Ok(recipe_urls)
}

/// Standalone function to resolve URLs (avoids lifetime issues in async tasks)
pub fn resolve_url_standalone(base: &str, href: &str) -> Result<String, String> {
    let base_url = Url::parse(base).map_err(|e| format!("Invalid base URL: {}", e))?;
    let resolved = base_url.join(href).map_err(|e| format!("Failed to join URLs: {}", e))?;
    Ok(resolved.to_string())
}

/// Standalone function to validate recipe URLs (avoids lifetime issues in async tasks)
pub fn is_valid_recipe_url_standalone(url: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            let host = host.to_ascii_lowercase();
            let path = parsed.path();

            // --- AllRecipes validation ---
            if host_matches_domain(&host, "allrecipes.com") {
                if !path.contains("/recipe/") {
                    return false;
                }

                // Skip URLs that contain "main" as they often cause hanging issues
                if path.to_lowercase().contains("main") || url.to_lowercase().contains("main") {
                    return false;
                }

                // Must have a recipe name after the ID (not just /recipe/123 or /recipe/123/)
                // Pattern: /recipe/{numeric_id}/{recipe_name}
                let recipe_pattern = regex::Regex::new(r"/recipe/\d+/[a-zA-Z]").unwrap();
                if !recipe_pattern.is_match(path) {
                    return false;
                }

                // Skip common non-recipe paths
                let invalid_paths = [
                    "/recipe/search/",
                    "/recipe/category/",
                    "/recipe/collection/",
                    "/recipe/reviews/",
                    "/recipe/photos/",
                    "/recipe/print/",
                    "/recipe/save/",
                    "/recipe/share/",
                ];

                for invalid_path in &invalid_paths {
                    if path.contains(invalid_path) {
                        return false;
                    }
                }

                return true;
            }

            // --- America's Test Kitchen validation ---
            // ATK recipe URLs: /recipes/{numeric_id}-{slug}
            // e.g. /recipes/12345-perfect-chocolate-chip-cookies
            if host_matches_domain(&host, "americastestkitchen.com") {
                let atk_recipe_pattern = regex::Regex::new(r"^/recipes/\d+-[a-zA-Z]").unwrap();
                if !atk_recipe_pattern.is_match(path) {
                    return false;
                }

                // Skip non-recipe ATK paths
                let invalid_paths = [
                    "/recipes/browse/",
                    "/recipes/all",
                    "/recipes/search",
                    "/recipes/collections/",
                ];

                for invalid_path in &invalid_paths {
                    if path.starts_with(invalid_path) {
                        return false;
                    }
                }

                return true;
            }

            // --- Serious Eats validation ---
            // New Dotdash Meredith format: seriouseats.com/{recipe-slug}
            //   • Root-level path (single segment), typically contains "-recipe"
            //   • May also have a numeric Dotdash ID suffix: /best-pizza-recipe-8374532
            //   • "-recipe" (singular) distinguishes recipes from category/listing pages
            //     which use "-recipes" (plural), e.g. /all-recipes-5117985
            // Old Serious Eats format: seriouseats.com/recipes/YYYY/MM/slug.html
            if host_matches_domain(&host, "seriouseats.com") {
                // Old format: /recipes/{year}/... — accept these
                if path.starts_with("/recipes/") {
                    // Exclude bare listing paths like /recipes/ or /recipes/search
                    let old_format_pattern =
                        regex::Regex::new(r"^/recipes/\d{4}/").unwrap();
                    if old_format_pattern.is_match(path) {
                        return true;
                    }
                    return false;
                }

                // New root-level format: a single path segment with no sub-path
                // The segment must contain "-recipe" (singular) to be a recipe URL.
                // Category/listing pages use "-recipes" (plural) or lack "recipe" entirely.
                let segments: Vec<&str> = path
                    .trim_start_matches('/')
                    .trim_end_matches('/')
                    .split('/')
                    .collect();

                if segments.len() != 1 {
                    // Multi-segment paths are sub-pages (articles, equipment, etc.)
                    return false;
                }

                let slug = segments[0];

                // Must contain "-recipe" as a word boundary (not "-recipes")
                // This accepts: "best-pizza-recipe", "best-pizza-recipe-12345678"
                // This rejects: "all-recipes-5117985", "chicken-recipes-5117980"
                if !slug.contains("-recipe") {
                    return false;
                }
                // Reject the "-recipes" plural form that slips through "-recipe" substring
                // (e.g. "best-recipes-2024" contains "-recipe" as a prefix of "-recipes")
                // We need to confirm the slug has "-recipe" NOT immediately followed by 's'.
                if let Some(pos) = slug.find("-recipe") {
                    let after = &slug[pos + 7..]; // skip past "-recipe" (7 chars)
                    if after.starts_with('s') {
                        // "-recipes..." → category page, reject
                        return false;
                    }
                }

                // Reject known non-recipe path prefixes
                let non_recipe_slugs = [
                    "about",
                    "the-food-lab-",    // technique/article series hub page
                    "style-guide",
                    "features-",
                    "news-",
                    "guides-",
                ];
                for prefix in &non_recipe_slugs {
                    if slug.starts_with(prefix) {
                        return false;
                    }
                }

                return true;
            }

            // --- Bon Appétit validation ---
            // Individual recipe URLs: bonappetit.com/recipe/{slug}
            //   • Singular "recipe" (not "recipes")
            //   • Root-level two-segment path: /recipe/{slug}
            //   • No numeric IDs — just a plain slug
            // Non-recipe paths to exclude:
            //   • /recipes  — the listing page itself
            //   • /recipes/* — category listing sub-pages
            //   • /story/*  — editorial articles
            //   • /gallery/* — photo galleries
            if host_matches_domain(&host, "bonappetit.com") {
                // Must start with /recipe/ (singular)
                if !path.starts_with("/recipe/") {
                    return false;
                }

                // Must have a non-trivial slug after /recipe/
                let slug = path.trim_start_matches("/recipe/").trim_end_matches('/');
                if slug.is_empty() || slug.len() < 3 {
                    return false;
                }

                // Slug must not contain path separators (would be a sub-page, not a recipe)
                if slug.contains('/') {
                    return false;
                }

                return true;
            }
        }
    }
    false
}



































#[cfg(test)]
mod tests;
