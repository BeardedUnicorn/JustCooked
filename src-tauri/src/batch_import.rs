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
use uuid;
use tracing::{info, error, warn, instrument};

// Removed unused import: use crate::recipe_import::import_recipe_from_url;


// Threading configuration constants
const RECIPE_IMPORT_CONCURRENT_THREADS: usize = 5; // Concurrent threads for recipe imports
const CATEGORY_SCRAPING_CONCURRENT_THREADS: usize = 3; // Concurrent threads for category scraping

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

        if !start_url.host_str().unwrap_or("").contains("allrecipes.com") {
            return Err("Only AllRecipes.com URLs are supported for batch import".to_string());
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

// Removed BatchImporterTask implementation - using standalone functions instead

/// Standalone function for concurrent category processing (avoids lifetime issues in async tasks)
async fn extract_recipe_urls_from_page_concurrent(client: &reqwest::Client, page_url: &str) -> Result<Vec<String>, String> {
    // Add timeout wrapper for the entire operation
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

/// Standalone function to extract recipe URLs from HTML (avoids lifetime issues in async tasks)
fn extract_recipe_urls_from_html_standalone(html: &str, base_url: &str) -> Result<Vec<String>, String> {
    let document = Html::parse_document(html);
    let mut recipe_urls = Vec::new();

    // AllRecipes-specific selectors for recipe links
    let recipe_selectors = [
        "a[href*='/recipe/'][href*='/']", // Must be a proper recipe path
        ".recipe-card a[href*='/recipe/']",
        ".recipe-link[href*='/recipe/']",
        ".card-recipe a[href*='/recipe/']",
        ".recipe-item a[href*='/recipe/']",
        ".recipe-title a[href*='/recipe/']",
        ".recipe-summary a[href*='/recipe/']",
        ".recipe-grid a[href*='/recipe/']",
        ".recipe-list a[href*='/recipe/']",
        ".recipe-collection a[href*='/recipe/']",
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
            let path = parsed.path();

            // Must be AllRecipes and contain /recipe/
            if !host.contains("allrecipes.com") || !path.contains("/recipe/") {
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
    }
    false
}



































#[cfg(test)]
mod tests;


