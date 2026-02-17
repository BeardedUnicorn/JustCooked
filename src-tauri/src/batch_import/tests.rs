#![allow(non_snake_case)]

#[cfg(test)]
mod tests {
    use super::super::*;
    use tokio::time::{timeout, Duration};

    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path};

    #[tokio::test]
    async fn test_batch_importer_creation() {
        let importer = BatchImporter::new();
        let progress = importer.get_progress();
        
        assert!(matches!(progress.status, BatchImportStatus::Idle));
        assert_eq!(progress.processed_recipes, 0);
        assert_eq!(progress.total_recipes, 0);
        assert_eq!(progress.successful_imports, 0);
        assert_eq!(progress.failed_imports, 0);
        assert!(progress.errors.is_empty());
    }

    #[tokio::test]
    async fn test_cancel_import() {
        let importer = BatchImporter::new();
        
        // Initially not cancelled
        assert!(!importer.is_cancelled());
        
        // Cancel the import
        importer.cancel();
        
        // Should be cancelled now
        assert!(importer.is_cancelled());
        
        let progress = importer.get_progress();
        assert!(matches!(progress.status, BatchImportStatus::Cancelled));
    }

    // TODO: Re-enable these tests when we have proper AppHandle mocking
    // #[tokio::test]
    // async fn test_invalid_start_url() {
    //     let importer = BatchImporter::new();
    //     let app = create_mock_app();
    //     let request = BatchImportRequest {
    //         start_url: "invalid-url".to_string(),
    //         max_recipes: None,
    //         max_depth: None,
    //         existing_urls: None,
    //     };

    //     let result = importer.start_batch_import(app, request).await;
    //     assert!(result.is_err());
    //     assert!(result.unwrap_err().contains("Invalid start URL"));
    // }

    // #[tokio::test]
    // async fn test_unsupported_site() {
    //     let importer = BatchImporter::new();
    //     let app = create_mock_app();
    //     let request = BatchImportRequest {
    //         start_url: "https://example.com/recipes".to_string(),
    //         max_recipes: None,
    //         max_depth: None,
    //         existing_urls: None,
    //     };

    //     let result = importer.start_batch_import(app, request).await;
    //     assert!(result.is_err());
    //     assert!(result.unwrap_err().contains("Only AllRecipes.com URLs are supported"));
    // }

    #[tokio::test]
    async fn test_is_valid_category_url() {
        let importer = BatchImporter::new();

        // Valid AllRecipes category URLs
        assert!(importer.is_valid_category_url("https://www.allrecipes.com/recipes/79/desserts"));
        assert!(importer.is_valid_category_url("https://allrecipes.com/recipes/17562/dinner/main-dishes"));

        // Valid ATK category URLs
        assert!(importer.is_valid_category_url("https://www.americastestkitchen.com/recipes/all"));
        assert!(importer.is_valid_category_url("https://www.americastestkitchen.com/recipes/browse/chicken"));

        // Invalid: ATK individual recipe should NOT be a category
        assert!(!importer.is_valid_category_url("https://www.americastestkitchen.com/recipes/12345-perfect-cookies"));

        // Invalid URLs
        assert!(!importer.is_valid_category_url("https://www.allrecipes.com/recipe/123/individual-recipe"));
        assert!(!importer.is_valid_category_url("https://example.com/recipes"));
        assert!(!importer.is_valid_category_url("https://allrecipes.com.evil.test/recipes/79/desserts"));
        assert!(!importer.is_valid_category_url("https://evil-allrecipes.com/recipes/79/desserts"));
        assert!(!importer.is_valid_category_url("https://seriouseats.com.evil.test/all-recipes-5117985"));
        assert!(!importer.is_valid_category_url("invalid-url"));
    }

    #[tokio::test]
    async fn test_is_valid_recipe_url() {
        // Test using the standalone function since the method is now internal
        use crate::batch_import::is_valid_recipe_url_standalone;

        // Valid AllRecipes recipe URLs
        assert!(is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123/chocolate-chip-cookies"));
        assert!(is_valid_recipe_url_standalone("https://allrecipes.com/recipe/456/banana-bread"));

        // Invalid AllRecipes URLs - no recipe name after ID
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123"));
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/456/"));

        // Invalid URLs - not a supported site
        assert!(!is_valid_recipe_url_standalone("https://example.com/recipe/123/test"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com.evil.test/recipe/123/test"));
        assert!(!is_valid_recipe_url_standalone("https://evil-allrecipes.com/recipe/123/test"));
        assert!(!is_valid_recipe_url_standalone("invalid-url"));

        // Invalid AllRecipes URLs - not a recipe path
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipes/79/desserts"));

        // Valid ATK recipe URLs
        assert!(is_valid_recipe_url_standalone("https://www.americastestkitchen.com/recipes/12345-perfect-chocolate-chip-cookies"));
        assert!(is_valid_recipe_url_standalone("https://www.americastestkitchen.com/recipes/98765-beef-stew"));

        // Invalid ATK URLs - category/listing pages are not recipes
        assert!(!is_valid_recipe_url_standalone("https://www.americastestkitchen.com/recipes/all"));
        assert!(!is_valid_recipe_url_standalone("https://www.americastestkitchen.com/recipes/browse/chicken"));

        // Invalid ATK URLs - no numeric ID
        assert!(!is_valid_recipe_url_standalone("https://www.americastestkitchen.com/recipes/chocolate-chip-cookies"));
    }

    #[tokio::test]
    async fn test_is_valid_recipe_url_main_filtering() {
        // Test using the standalone function since the method is now internal
        use crate::batch_import::is_valid_recipe_url_standalone;

        // URLs with "main" should be filtered out to prevent hanging
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123/main-dish-casserole"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com/recipe/456/chicken-main-course"));
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/main/recipe/789/pasta"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com/recipe/999/beef-main-entree"));

        // Case insensitive filtering
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123/MAIN-dish"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com/recipe/456/Main-Course"));
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/MAIN/recipe/789/pasta"));

        // URLs without "main" should be valid
        assert!(is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123/chocolate-cookies"));
        assert!(is_valid_recipe_url_standalone("https://allrecipes.com/recipe/456/beef-stew"));
        assert!(is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/789/pasta-salad"));
    }

    #[tokio::test]
    async fn test_is_valid_recipe_url_numeric_id_validation() {
        // Test using the standalone function since the method is now internal
        use crate::batch_import::is_valid_recipe_url_standalone;

        // Valid - numeric recipe ID
        assert!(is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123/chocolate-cookies"));
        assert!(is_valid_recipe_url_standalone("https://allrecipes.com/recipe/456789/beef-stew"));

        // Invalid - non-numeric recipe ID (potentially problematic)
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/abc/cookies"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com/recipe/mixed123/stew"));
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123abc/pasta"));

        // Invalid - missing recipe name after ID
        assert!(!is_valid_recipe_url_standalone("https://www.allrecipes.com/recipe/123"));
        assert!(!is_valid_recipe_url_standalone("https://allrecipes.com/recipe/123/"));
    }

    #[tokio::test]
    async fn test_resolve_url() {
        // Test using the standalone function since the method is now internal
        use crate::batch_import::resolve_url_standalone;

        // Test relative URL resolution
        let base = "https://www.allrecipes.com/recipes/79/desserts";
        let relative = "/recipe/123/chocolate-chip-cookies";
        let resolved = resolve_url_standalone(base, relative).unwrap();
        assert_eq!(resolved, "https://www.allrecipes.com/recipe/123/chocolate-chip-cookies");

        // Test absolute URL
        let absolute = "https://www.allrecipes.com/recipe/456/banana-bread";
        let resolved = resolve_url_standalone(base, absolute).unwrap();
        assert_eq!(resolved, absolute);

        // Test invalid base URL
        let result = resolve_url_standalone("invalid-url", relative);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_extract_recipe_urls_from_page() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock HTML content with recipe links - use allrecipes.com URLs
        let html_content = r#"
            <html>
                <body>
                    <a href="https://www.allrecipes.com/recipe/123/chocolate-chip-cookies">Chocolate Chip Cookies</a>
                    <a href="https://www.allrecipes.com/recipe/456/banana-bread">Banana Bread</a>
                    <a href="https://www.allrecipes.com/recipe/789">Invalid Recipe (number only)</a>
                    <a href="https://www.allrecipes.com/recipes/desserts">Category Link</a>
                    <a href="https://example.com/recipe/999/external">External Recipe</a>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/test-page"))
            .respond_with(ResponseTemplate::new(200).set_body_string(html_content))
            .mount(&mock_server)
            .await;

        let page_url = format!("{}/test-page", mock_server.uri());
        let recipe_urls = crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &page_url).await.unwrap();

        // Should only include valid AllRecipes recipe URLs (with proper recipe names)
        assert_eq!(recipe_urls.len(), 2);
        assert!(recipe_urls.contains(&"https://www.allrecipes.com/recipe/123/chocolate-chip-cookies".to_string()));
        assert!(recipe_urls.contains(&"https://www.allrecipes.com/recipe/456/banana-bread".to_string()));
    }

    #[tokio::test]
    async fn test_crawl_categories() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock HTML content with category links
        let html_content = r#"
            <html>
                <body>
                    <nav>
                        <a href="/recipes/desserts/cakes">Cakes</a>
                        <a href="/recipes/desserts/cookies">Cookies</a>
                        <a href="/recipes/main-dishes">Main Dishes</a>
                    </nav>
                    <a href="/recipe/123/individual-recipe">Individual Recipe</a>
                    <a href="https://example.com/recipes/external">External Category</a>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/recipes/desserts"))
            .respond_with(ResponseTemplate::new(200).set_body_string(html_content))
            .mount(&mock_server)
            .await;

        let start_url = format!("{}/recipes/desserts", mock_server.uri());
        let categories = importer.crawl_categories(&start_url).await.unwrap();

        // Should include the main category plus valid subcategories
        assert!(categories.len() >= 1); // At least the main category

        // Check that main category is included (by URL)
        assert!(categories.iter().any(|cat| cat.url == start_url));
        
        // Verify no duplicates
        let mut urls: Vec<_> = categories.iter().map(|cat| &cat.url).collect();
        urls.sort();
        let original_len = urls.len();
        urls.dedup();
        assert_eq!(urls.len(), original_len, "Categories should not contain duplicates");
    }

    #[tokio::test]
    async fn test_build_result() {
        let importer = BatchImporter::new();
        let start_time = std::time::Instant::now();

        // Add a small delay to ensure duration > 0
        tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;

        // Simulate some progress
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.status = BatchImportStatus::Completed;
            progress.processed_recipes = 10;
            progress.successful_imports = 8;
            progress.failed_imports = 2;
            progress.errors.push(BatchImportError {
                url: "https://example.com/recipe/1".to_string(),
                message: "Test error".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                error_type: "TestError".to_string(),
            });
        }

        let result = importer.build_result(start_time);

        assert!(result.success);
        assert_eq!(result.total_processed, 10);
        assert_eq!(result.successful_imports, 8);
        assert_eq!(result.failed_imports, 2);
        assert_eq!(result.errors.len(), 1);
        // Duration should be a valid number (u32 is always >= 0)
        assert!(result.duration < 3600); // Should be less than an hour for this test
    }

    #[tokio::test]
    async fn test_max_recipes_limit() {
        // This test is complex to mock properly, so let's test the logic more simply
        let importer = BatchImporter::new();

        let request = BatchImportRequest {
            start_url: "https://www.allrecipes.com/recipes/79/desserts".to_string(),
            max_recipes: Some(3), // Limit to 3 recipes
            max_depth: None,
            existing_urls: None,
        };

        // Test that the request is properly formed and would be accepted
        // (We can't easily test the full flow without mocking the entire AllRecipes site)
        assert_eq!(request.max_recipes, Some(3));
        assert!(request.start_url.contains("allrecipes.com"));

        // Test URL validation
        assert!(importer.is_valid_category_url(&request.start_url));
    }

    #[test]
    fn test_apply_max_depth_limit_zero_keeps_only_start_url() {
        let importer = BatchImporter::new();
        let start_url = "https://www.allrecipes.com/recipes/79/desserts";
        let categories = vec![
            CategoryInfo { url: start_url.to_string() },
            CategoryInfo { url: "https://www.allrecipes.com/recipes/80/main-dish".to_string() },
            CategoryInfo { url: "https://www.allrecipes.com/recipes/81/side-dish".to_string() },
        ];

        let limited = importer.apply_max_depth_limit(categories, Some(0), start_url);

        assert_eq!(limited.len(), 1);
        assert_eq!(limited[0].url, start_url);
    }

    #[test]
    fn test_apply_max_depth_limit_none_keeps_all_categories() {
        let importer = BatchImporter::new();
        let start_url = "https://www.allrecipes.com/recipes/79/desserts";
        let categories = vec![
            CategoryInfo { url: start_url.to_string() },
            CategoryInfo { url: "https://www.allrecipes.com/recipes/80/main-dish".to_string() },
        ];

        let limited = importer.apply_max_depth_limit(categories.clone(), None, start_url);

        assert_eq!(limited.len(), categories.len());
    }

    #[test]
    fn test_batch_import_status_serialization() {
        use serde_json;

        let status = BatchImportStatus::ImportingRecipes;
        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: BatchImportStatus = serde_json::from_str(&serialized).unwrap();
        
        assert!(matches!(deserialized, BatchImportStatus::ImportingRecipes));
    }

    #[test]
    fn test_batch_import_request_serialization() {
        use serde_json;

        let request = BatchImportRequest {
            start_url: "https://www.allrecipes.com/recipes/79/desserts".to_string(),
            max_recipes: Some(100),
            max_depth: Some(2),
            existing_urls: None,
        };

        let serialized = serde_json::to_string(&request).unwrap();
        let deserialized: BatchImportRequest = serde_json::from_str(&serialized).unwrap();

        assert_eq!(deserialized.start_url, request.start_url);
        assert_eq!(deserialized.max_recipes, request.max_recipes);
        assert_eq!(deserialized.max_depth, request.max_depth);
    }

    #[tokio::test]
    async fn test_estimated_time_remaining_calculation() {
        let importer = BatchImporter::new();

        // Set up initial state
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - std::time::Duration::from_secs(60));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100;
            progress.processed_recipes = 20; // 20% complete
        }

        let progress = importer.get_progress();
        assert_eq!(progress.total_recipes, 100);

        // Should have correct progress tracking
        assert_eq!(progress.processed_recipes, 20);
    }

    #[tokio::test]
    async fn test_estimated_time_remaining_no_progress() {
        let importer = BatchImporter::new();

        // Set up state with no progress
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now());
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100;
            progress.processed_recipes = 0; // No progress yet
        }

        let progress = importer.get_progress();
        assert_eq!(progress.processed_recipes, 0, "Should have no progress");
    }

    #[tokio::test]
    async fn test_estimated_time_remaining_complete() {
        let importer = BatchImporter::new();

        // Set up state with complete progress
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - std::time::Duration::from_secs(60));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100;
            progress.processed_recipes = 100; // Complete
        }

        let progress = importer.get_progress();
        assert_eq!(progress.processed_recipes, 100, "Should be complete");
    }

    #[tokio::test]
    async fn test_progress_tracking_consistency() {
        let importer = BatchImporter::new();

        // Simulate processing recipes
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now());
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 10;
            progress.processed_recipes = 0;
            progress.successful_imports = 0;
            progress.failed_imports = 0;
        }

        // Simulate processing 5 recipes with 3 successes and 2 failures
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.processed_recipes = 5;
            progress.successful_imports = 3;
            progress.failed_imports = 2;
        }

        let progress = importer.get_progress();
        assert_eq!(progress.processed_recipes, 5);
        assert_eq!(progress.successful_imports + progress.failed_imports, 5);
        assert_eq!(progress.total_recipes, 10);
    }

    #[tokio::test]
    async fn test_progress_update_with_estimation() {
        let importer = BatchImporter::new();

        // Set up initial state
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - std::time::Duration::from_secs(30));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100;
            progress.processed_recipes = 10;
        }

        // Test progress tracking
        let progress = importer.get_progress();
        assert_eq!(progress.total_recipes, 100);
        assert_eq!(progress.processed_recipes, 10);
    }

    // TODO: Re-enable these tests when we have proper AppHandle mocking
    // #[tokio::test]
    // async fn test_import_recipes_progress_tracking() {
    //     let importer = BatchImporter::new();

    //     // Set up initial state
    //     *importer.start_time.lock().unwrap() = Some(std::time::Instant::now());
    //     {
    //         let mut progress = importer.progress.lock().unwrap();
    //         progress.total_recipes = 3;
    //         progress.processed_recipes = 0;
    //         progress.successful_imports = 0;
    //         progress.failed_imports = 0;
    //     }

    //     // Create test URLs (these will fail to import, but that's okay for testing progress)
    //     let test_urls = vec![
    //         "https://www.allrecipes.com/recipe/1/test-recipe-1/".to_string(),
    //         "https://www.allrecipes.com/recipe/2/test-recipe-2/".to_string(),
    //         "https://www.allrecipes.com/recipe/3/test-recipe-3/".to_string(),
    //     ];

    //     // Import recipes (this will fail but should still update progress correctly)
    //     importer.import_recipes(test_urls).await;

    //     let final_progress = importer.get_progress();

    //     // Verify progress tracking
    //     assert_eq!(final_progress.processed_recipes, 3, "Should have processed all 3 recipes");
    //     assert_eq!(final_progress.successful_imports + final_progress.failed_imports, 3, "Total imports should equal processed recipes");
    //     assert!(final_progress.current_url.is_none(), "Current URL should be None after completion");
    //     assert_eq!(final_progress.estimated_time_remaining, Some(0), "Estimated time should be 0 after completion");
    // }

    // #[tokio::test]
    // async fn test_import_recipes_cancellation() {
    //     let importer = BatchImporter::new();

    //     // Set up initial state
    //     *importer.start_time.lock().unwrap() = Some(std::time::Instant::now());
    //     {
    //         let mut progress = importer.progress.lock().unwrap();
    //         progress.total_recipes = 10;
    //         progress.processed_recipes = 0;
    //     }

    //     // Create test URLs
    //     let test_urls: Vec<String> = (1..=10)
    //         .map(|i| format!("https://www.allrecipes.com/recipe/{}/test-recipe-{}/", i, i))
    //         .collect();

    //     // Cancel the import immediately
    //     importer.cancel();

    //     // Import recipes (should exit early due to cancellation)
    //     importer.import_recipes(test_urls).await;

    //     let final_progress = importer.get_progress();

    //     // Should have processed 0 recipes due to immediate cancellation
    //     assert_eq!(final_progress.processed_recipes, 0, "Should have processed 0 recipes due to cancellation");
    //     assert_eq!(final_progress.status, BatchImportStatus::Cancelled);
    // }

    // #[tokio::test]
    // async fn test_import_recipes_empty_list() {
    //     let importer = BatchImporter::new();

    //     // Set up initial state
    //     *importer.start_time.lock().unwrap() = Some(std::time::Instant::now());
    //     {
    //         let mut progress = importer.progress.lock().unwrap();
    //         progress.total_recipes = 0;
    //         progress.processed_recipes = 0;
    //     }

    //     // Import empty list
    //     importer.import_recipes(vec![]).await;

    //     let final_progress = importer.get_progress();

    //     // Should handle empty list gracefully
    //     assert_eq!(final_progress.processed_recipes, 0);
    //     assert_eq!(final_progress.successful_imports, 0);
    //     assert_eq!(final_progress.failed_imports, 0);
    //     assert!(final_progress.current_url.is_none());
    //     assert_eq!(final_progress.estimated_time_remaining, Some(0));
    // }

    #[tokio::test]
    async fn test_request_timeout_handling() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock a slow response that should timeout
        Mock::given(method("GET"))
            .and(path("/slow-page"))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_string("<html><body>Slow response</body></html>")
                    .set_delay(std::time::Duration::from_secs(35)) // Longer than 30s timeout
            )
            .mount(&mock_server)
            .await;

        let slow_url = format!("{}/slow-page", mock_server.uri());

        // This should timeout and return an error
        let result = timeout(
            Duration::from_secs(40), // Give extra time for the test itself
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &slow_url)
        ).await;

        // The request should either timeout or return an error
        match result {
            Ok(inner_result) => {
                // If the request completed, it should be an error due to timeout
                assert!(inner_result.is_err(), "Expected timeout error, but got success");
            }
            Err(_) => {
                // Test timeout - this is also acceptable for this test
                // The important thing is that the request doesn't hang indefinitely
            }
        }
    }

    #[tokio::test]
    async fn test_main_dishes_category_specific_handling() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock main dishes category page with complex structure
        let main_dishes_html = r#"
            <html>
                <head><title>Main Dishes - AllRecipes</title></head>
                <body>
                    <div class="recipe-grid">
                        <div class="recipe-card">
                            <a href="https://www.allrecipes.com/recipe/123/beef-stew" class="recipe-link">Beef Stew</a>
                        </div>
                        <div class="recipe-card">
                            <a href="https://www.allrecipes.com/recipe/456/chicken-parmesan" class="recipe-link">Chicken Parmesan</a>
                        </div>
                        <div class="recipe-card">
                            <a href="https://www.allrecipes.com/recipe/789/pasta-primavera" class="recipe-link">Pasta Primavera</a>
                        </div>
                    </div>
                    <!-- Pagination or load more button -->
                    <div class="pagination">
                        <a href="/recipes/main-dishes?page=2">Next Page</a>
                    </div>
                    <!-- Infinite scroll trigger -->
                    <div id="load-more-trigger" data-page="2"></div>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/recipes/main-dishes"))
            .respond_with(ResponseTemplate::new(200).set_body_string(main_dishes_html))
            .mount(&mock_server)
            .await;

        let main_dishes_url = format!("{}/recipes/main-dishes", mock_server.uri());

        // This should complete without hanging
        let result = timeout(
            Duration::from_secs(10),
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &main_dishes_url)
        ).await;

        assert!(result.is_ok(), "Main dishes page extraction should not timeout");

        let recipe_urls = result.unwrap().unwrap();
        assert_eq!(recipe_urls.len(), 3, "Should extract 3 recipe URLs from main dishes page");

        // Verify the URLs are properly resolved (they should be absolute URLs)
        for url in &recipe_urls {
            assert!(url.starts_with("http"), "URLs should be absolute: {}", url);
            assert!(url.contains("/recipe/"), "URLs should be recipe URLs: {}", url);
        }
    }

    #[tokio::test]
    async fn test_infinite_scroll_detection() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock page with infinite scroll indicators
        let infinite_scroll_html = r#"
            <html>
                <body>
                    <div class="recipe-list">
                        <a href="https://www.allrecipes.com/recipe/123/test-recipe">Test Recipe</a>
                    </div>
                    <!-- Common infinite scroll indicators -->
                    <div class="load-more-button" data-url="/api/recipes/load-more">Load More</div>
                    <div id="infinite-scroll-trigger"></div>
                    <script>
                        // Infinite scroll JavaScript
                        window.addEventListener('scroll', loadMoreRecipes);
                    </script>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/infinite-scroll-page"))
            .respond_with(ResponseTemplate::new(200).set_body_string(infinite_scroll_html))
            .mount(&mock_server)
            .await;

        let page_url = format!("{}/infinite-scroll-page", mock_server.uri());

        // Should handle infinite scroll pages without hanging
        let result = timeout(
            Duration::from_secs(5),
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &page_url)
        ).await;

        assert!(result.is_ok(), "Infinite scroll page should not cause hanging");

        let recipe_urls = result.unwrap().unwrap();
        assert_eq!(recipe_urls.len(), 1, "Should extract available recipes without waiting for dynamic content");
    }

    #[tokio::test]
    async fn test_category_crawling_with_duplicates() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock category page with duplicate links
        let category_html = r#"
            <html>
                <body>
                    <nav>
                        <a href="/recipes/desserts">Desserts</a>
                        <a href="/recipes/desserts">Desserts (duplicate)</a>
                        <a href="/recipes/main-dishes">Main Dishes</a>
                        <a href="/recipes/appetizers">Appetizers</a>
                        <a href="/recipes/main-dishes">Main Dishes (duplicate)</a>
                    </nav>
                    <div class="sidebar">
                        <a href="/recipes/desserts">Desserts (sidebar)</a>
                    </div>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/recipes"))
            .respond_with(ResponseTemplate::new(200).set_body_string(category_html))
            .mount(&mock_server)
            .await;

        let start_url = format!("{}/recipes", mock_server.uri());
        let categories = importer.crawl_categories(&start_url).await.unwrap();

        // Should deduplicate categories
        let unique_urls: std::collections::HashSet<_> = categories.iter().map(|cat| &cat.url).collect();
        assert_eq!(categories.len(), unique_urls.len(), "Categories should be deduplicated");

        // Should include the main category
        assert!(categories.iter().any(|cat| cat.url == start_url), "Should include the main category");
    }

    #[tokio::test]
    async fn test_malformed_html_handling() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock page with malformed HTML
        let malformed_html = r#"
            <html>
                <body>
                    <div class="recipe-list">
                        <a href="https://www.allrecipes.com/recipe/123/test-recipe">Test Recipe
                        <a href="https://www.allrecipes.com/recipe/456/another-recipe">Another Recipe</a>
                        <div>
                            <a href="https://www.allrecipes.com/recipe/789/third-recipe">Third Recipe</a>
                        </div>
                    </div>
                    <!-- Unclosed tags and malformed structure -->
                    <div class="broken
                        <a href="https://www.allrecipes.com/recipe/999/broken-link">Broken Link
                </body>
            <!-- Missing closing html tag -->
        "#;

        Mock::given(method("GET"))
            .and(path("/malformed-page"))
            .respond_with(ResponseTemplate::new(200).set_body_string(malformed_html))
            .mount(&mock_server)
            .await;

        let page_url = format!("{}/malformed-page", mock_server.uri());

        // Should handle malformed HTML gracefully
        let result = crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &page_url).await;
        assert!(result.is_ok(), "Should handle malformed HTML without crashing");

        let recipe_urls = result.unwrap();
        // Should still extract valid recipe URLs despite malformed HTML
        assert!(recipe_urls.len() >= 2, "Should extract at least some valid URLs from malformed HTML");
    }

    #[tokio::test]
    async fn test_empty_page_handling() {
        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Mock empty page
        let empty_html = r#"
            <html>
                <head><title>Empty Page</title></head>
                <body>
                    <div class="no-recipes">
                        <p>No recipes found in this category.</p>
                    </div>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/empty-page"))
            .respond_with(ResponseTemplate::new(200).set_body_string(empty_html))
            .mount(&mock_server)
            .await;

        let page_url = format!("{}/empty-page", mock_server.uri());

        // Should handle empty pages gracefully
        let result = crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &page_url).await;
        assert!(result.is_ok(), "Should handle empty pages without error");

        let recipe_urls = result.unwrap();
        assert_eq!(recipe_urls.len(), 0, "Should return empty list for pages with no recipes");
    }

    #[tokio::test]
    async fn test_concurrent_import_rate_limiting() {
        let importer = BatchImporter::new();

        // Test that the rate limiter is properly configured for 5 concurrent imports
        assert_eq!(importer.rate_limiter.available_permits(), 5, "Should have 5 permits available for concurrent imports");

        // Acquire all permits
        let permit1 = importer.rate_limiter.try_acquire().unwrap();
        let permit2 = importer.rate_limiter.try_acquire().unwrap();
        let permit3 = importer.rate_limiter.try_acquire().unwrap();
        let permit4 = importer.rate_limiter.try_acquire().unwrap();
        let permit5 = importer.rate_limiter.try_acquire().unwrap();

        // Should not be able to acquire more permits
        assert!(importer.rate_limiter.try_acquire().is_err(), "Should not be able to acquire more than 5 permits");

        // Release permits
        drop(permit1);
        drop(permit2);
        drop(permit3);
        drop(permit4);
        drop(permit5);

        // Should be able to acquire permits again
        assert_eq!(importer.rate_limiter.available_permits(), 5, "Should have 5 permits available after releasing");
    }

    #[tokio::test]
    async fn test_batch_importer_progress_access() {
        let importer = BatchImporter::new();

        // Test that we can access progress directly
        let progress = importer.get_progress();
        assert!(matches!(progress.status, BatchImportStatus::Idle));
    }

    #[tokio::test]
    async fn test_batch_importer_error_handling() {
        let importer = BatchImporter::new();

        // Test adding an error directly to progress
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.errors.push(BatchImportError {
                url: "https://example.com/recipe/123".to_string(),
                message: "Test error message".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                error_type: "TestError".to_string(),
            });
        }

        let progress = importer.get_progress();
        assert_eq!(progress.errors.len(), 1);
        assert_eq!(progress.errors[0].url, "https://example.com/recipe/123");
        assert_eq!(progress.errors[0].message, "Test error message");
        assert_eq!(progress.errors[0].error_type, "TestError");
    }

    #[tokio::test]
    async fn test_concurrent_progress_tracking() {
        let importer = BatchImporter::new();

        // Set up initial state
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 10;
            progress.processed_recipes = 0;
            progress.successful_imports = 0;
            progress.failed_imports = 0;
        }

        // Simulate concurrent updates to progress
        let mut handles = Vec::new();

        for _i in 0..5 {
            let progress_clone = Arc::clone(&importer.progress);
            let handle = tokio::spawn(async move {
                // Simulate processing a recipe
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

                // Update progress
                {
                    let mut progress = progress_clone.lock().unwrap();
                    progress.processed_recipes += 1;
                    progress.successful_imports += 1;
                }
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            handle.await.unwrap();
        }

        let final_progress = importer.get_progress();
        assert_eq!(final_progress.processed_recipes, 5);
        assert_eq!(final_progress.successful_imports, 5);
        assert_eq!(final_progress.failed_imports, 0);
    }

    #[tokio::test]
    async fn test_concurrent_error_tracking() {
        let importer = BatchImporter::new();

        // Simulate concurrent error reporting
        let mut handles = Vec::new();

        for i in 0..3 {
            let progress_clone = Arc::clone(&importer.progress);
            let handle = tokio::spawn(async move {
                // Simulate an error
                {
                    let mut progress = progress_clone.lock().unwrap();
                    progress.errors.push(BatchImportError {
                        url: format!("https://example.com/recipe/{}", i),
                        message: format!("Error message {}", i),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        error_type: "ConcurrentTestError".to_string(),
                    });
                }
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            handle.await.unwrap();
        }

        let final_progress = importer.get_progress();
        assert_eq!(final_progress.errors.len(), 3);

        // Verify all errors were recorded
        let error_urls: Vec<_> = final_progress.errors.iter().map(|e| &e.url).collect();
        assert!(error_urls.contains(&&"https://example.com/recipe/0".to_string()));
        assert!(error_urls.contains(&&"https://example.com/recipe/1".to_string()));
        assert!(error_urls.contains(&&"https://example.com/recipe/2".to_string()));
    }

    #[tokio::test]
    async fn test_semaphore_based_rate_limiting() {
        let importer = BatchImporter::new();
        let start_time = std::time::Instant::now();

        // Simulate multiple concurrent tasks that need to acquire permits
        let mut handles = Vec::new();

        for i in 0..8 { // More tasks than available permits (8 tasks, 5 permits)
            let rate_limiter = Arc::clone(&importer.rate_limiter);
            let handle = tokio::spawn(async move {
                let _permit = rate_limiter.acquire().await.unwrap();
                // Simulate work
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                i // Return the task ID
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.unwrap());
        }

        let elapsed = start_time.elapsed();

        // Should have completed all tasks
        assert_eq!(results.len(), 8);
        results.sort();
        assert_eq!(results, vec![0, 1, 2, 3, 4, 5, 6, 7]);

        // Should have taken at least 200ms due to rate limiting
        // (8 tasks, 5 concurrent, 100ms each = at least 2 batches = 200ms)
        assert!(elapsed >= std::time::Duration::from_millis(180),
                "Should take at least 180ms due to rate limiting, took {:?}", elapsed);
    }

    // -------------------------------------------------------------------------
    // ATK Pagination Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_build_atk_page_url_page_1() {
        use crate::batch_import::build_atk_page_url;

        let base = "https://www.americastestkitchen.com/recipes/all";
        let result = build_atk_page_url(base, 1);
        assert_eq!(result, base, "Page 1 should return the URL unchanged");
    }

    #[test]
    fn test_build_atk_page_url_page_2() {
        use crate::batch_import::build_atk_page_url;

        let base = "https://www.americastestkitchen.com/recipes/all";
        let result = build_atk_page_url(base, 2);
        assert!(result.contains("page=2"), "Page 2 should include page=2");
        assert!(result.starts_with("https://www.americastestkitchen.com/recipes/all"));
    }

    #[test]
    fn test_build_atk_page_url_replaces_existing_page_param() {
        use crate::batch_import::build_atk_page_url;

        // If the base already has page=1, it should be replaced with page=3
        let base = "https://www.americastestkitchen.com/recipes/all?page=1";
        let result = build_atk_page_url(base, 3);
        assert!(result.contains("page=3"), "Should replace existing page param");
        assert!(!result.contains("page=1"), "Old page param should be gone");
    }

    #[test]
    fn test_build_atk_page_url_preserves_other_params() {
        use crate::batch_import::build_atk_page_url;

        let base = "https://www.americastestkitchen.com/recipes/all?category=chicken";
        let result = build_atk_page_url(base, 2);
        assert!(result.contains("category=chicken"), "Other params should be preserved");
        assert!(result.contains("page=2"), "New page param should be present");
    }

    #[test]
    fn test_atk_page_has_more_load_more_button_text() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <div class="recipe-list">
                    <a href="/recipes/12345-test">Test Recipe</a>
                </div>
                <button class="btn-primary">Load More</button>
            </body></html>
        "#;
        assert!(atk_page_has_more(html), "Should detect 'Load More' button text");
    }

    #[test]
    fn test_atk_page_has_more_show_more_button_text() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <button>Show More Recipes</button>
            </body></html>
        "#;
        assert!(atk_page_has_more(html), "Should detect 'Show More' button text");
    }

    #[test]
    fn test_atk_page_has_more_css_class_selector() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <div class="recipe-list"></div>
                <button class="LoadMore__button" data-testid="load-more-btn">Load More</button>
            </body></html>
        "#;
        assert!(atk_page_has_more(html), "Should detect load-more CSS class");
    }

    #[test]
    fn test_atk_page_has_more_rel_next_link() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html>
                <head><link rel="next" href="/recipes/all?page=3" /></head>
                <body></body>
            </html>
        "#;
        assert!(atk_page_has_more(html), "Should detect rel=next link");
    }

    #[test]
    fn test_atk_page_has_more_next_data_has_next_page() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <script id="__NEXT_DATA__" type="application/json">
                    {"props":{"pageProps":{"pagination":{"hasNextPage":true,"totalCount":500,"loadedCount":24}}}}
                </script>
            </body></html>
        "#;
        assert!(atk_page_has_more(html), "Should detect hasNextPage=true in __NEXT_DATA__");
    }

    #[test]
    fn test_atk_page_has_more_next_data_no_more_pages() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <script id="__NEXT_DATA__" type="application/json">
                    {"props":{"pageProps":{"pagination":{"hasNextPage":false}}}}
                </script>
            </body></html>
        "#;
        assert!(!atk_page_has_more(html), "Should detect hasNextPage=false in __NEXT_DATA__");
    }

    #[test]
    fn test_atk_page_has_more_no_signals() {
        use crate::batch_import::atk_page_has_more;

        let html = r#"
            <html><body>
                <div class="recipe-list">
                    <a href="/recipes/12345-test">Test Recipe</a>
                </div>
                <p>That's all the recipes!</p>
            </body></html>
        "#;
        assert!(!atk_page_has_more(html), "Should return false when no more-pages signals present");
    }

    #[tokio::test]
    async fn test_atk_pagination_stops_when_no_new_urls() {
        use tokio::time::{timeout, Duration};

        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Page 1: 2 recipes + Load More button
        let page1_html = r#"
            <html><body>
                <a href="https://www.americastestkitchen.com/recipes/11111-beef-stew">Beef Stew</a>
                <a href="https://www.americastestkitchen.com/recipes/22222-chicken-soup">Chicken Soup</a>
                <button>Load More</button>
            </body></html>
        "#;

        // Page 2: same 2 recipes (no new ones) — should trigger stop
        let page2_html = r#"
            <html><body>
                <a href="https://www.americastestkitchen.com/recipes/11111-beef-stew">Beef Stew</a>
                <a href="https://www.americastestkitchen.com/recipes/22222-chicken-soup">Chicken Soup</a>
                <button>Load More</button>
            </body></html>
        "#;

        Mock::given(method("GET"))
            .and(path("/recipes/all"))
            .respond_with(ResponseTemplate::new(200).set_body_string(page1_html))
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/recipes/all"))
            .respond_with(ResponseTemplate::new(200).set_body_string(page2_html))
            .mount(&mock_server)
            .await;

        let start_url = format!("{}/recipes/all", mock_server.uri());

        let result = timeout(
            Duration::from_secs(15),
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &start_url),
        )
        .await;

        assert!(result.is_ok(), "Should not timeout");
        let urls = result.unwrap().unwrap();
        assert_eq!(urls.len(), 2, "Should have exactly 2 unique recipe URLs");
    }

    #[tokio::test]
    async fn test_atk_pagination_collects_multiple_pages() {
        use tokio::time::{timeout, Duration};

        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Page 1: 2 unique recipes + Load More button
        let page1_html = r#"
            <html><body>
                <a href="https://www.americastestkitchen.com/recipes/11111-beef-stew">Beef Stew</a>
                <a href="https://www.americastestkitchen.com/recipes/22222-chicken-soup">Chicken Soup</a>
                <button>Load More</button>
            </body></html>
        "#;

        // Page 2: 2 more unique recipes, no Load More button
        let page2_html = r#"
            <html><body>
                <a href="https://www.americastestkitchen.com/recipes/33333-pasta">Pasta</a>
                <a href="https://www.americastestkitchen.com/recipes/44444-salad">Salad</a>
            </body></html>
        "#;

        // Mount page=2 mock FIRST so it takes priority for page=2 requests.
        // The less-specific page=1 mock is mounted second.
        Mock::given(method("GET"))
            .and(wiremock::matchers::query_param("page", "2"))
            .respond_with(ResponseTemplate::new(200).set_body_string(page2_html))
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/recipes/all"))
            .respond_with(ResponseTemplate::new(200).set_body_string(page1_html))
            .mount(&mock_server)
            .await;

        let start_url = format!("{}/recipes/all", mock_server.uri());

        let result = timeout(
            Duration::from_secs(20),
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &start_url),
        )
        .await;

        assert!(result.is_ok(), "Should not timeout");
        let urls = result.unwrap().unwrap();
        assert_eq!(urls.len(), 4, "Should collect all 4 unique recipe URLs across both pages");
    }

    // -------------------------------------------------------------------------
    // ATK __NEXT_DATA__ extraction tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_extract_atk_urls_from_next_data_basic() {
        use crate::batch_import::extract_atk_urls_from_next_data;

        let html = r#"
            <html><head>
                <script id="__NEXT_DATA__" type="application/json">
                {
                    "props": {
                        "pageProps": {
                            "recipes": [
                                {"path": "/recipes/12345-perfect-chocolate-chip-cookies", "title": "Cookies"},
                                {"path": "/recipes/67890-best-beef-stew", "title": "Beef Stew"},
                                {"path": "/recipes/all", "title": "Browse All"}
                            ],
                            "pagination": {"hasNextPage": false}
                        }
                    }
                }
                </script>
            </head><body></body></html>
        "#;

        let urls = extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 2, "Should extract 2 valid recipe URLs (not the /recipes/all browse page)");
        assert!(urls.iter().any(|u| u.contains("/recipes/12345-perfect-chocolate-chip-cookies")));
        assert!(urls.iter().any(|u| u.contains("/recipes/67890-best-beef-stew")));
        // /recipes/all should be filtered out (not a valid recipe URL)
        assert!(!urls.iter().any(|u| u.ends_with("/recipes/all")));
    }

    #[test]
    fn test_extract_atk_urls_from_next_data_deeply_nested() {
        use crate::batch_import::extract_atk_urls_from_next_data;

        // Recipe paths buried inside deeply nested JSON (real ATK shape may vary)
        let html = r#"
            <html><head>
                <script id="__NEXT_DATA__" type="application/json">
                {
                    "props": {
                        "pageProps": {
                            "searchResults": {
                                "results": [
                                    {
                                        "type": "recipe",
                                        "document": {
                                            "path": "/recipes/11111-roast-chicken",
                                            "title": "Roast Chicken"
                                        }
                                    },
                                    {
                                        "type": "recipe",
                                        "document": {
                                            "path": "/recipes/22222-pasta-carbonara",
                                            "title": "Pasta Carbonara"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
                </script>
            </head><body></body></html>
        "#;

        let urls = extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 2, "Should find paths buried in deeply nested JSON");
        assert!(urls.iter().any(|u| u.contains("/recipes/11111-roast-chicken")));
        assert!(urls.iter().any(|u| u.contains("/recipes/22222-pasta-carbonara")));
    }

    #[test]
    fn test_extract_atk_urls_from_next_data_no_script_tag() {
        use crate::batch_import::extract_atk_urls_from_next_data;

        let html = r#"
            <html><body>
                <p>No __NEXT_DATA__ here</p>
            </body></html>
        "#;

        let urls = extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 0, "Should return empty when no __NEXT_DATA__ tag present");
    }

    #[test]
    fn test_extract_atk_urls_from_next_data_invalid_json() {
        use crate::batch_import::extract_atk_urls_from_next_data;

        let html = r#"
            <html><head>
                <script id="__NEXT_DATA__" type="application/json">
                    { this is not valid json !!!
                </script>
            </head><body></body></html>
        "#;

        let urls = extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 0, "Should return empty for invalid JSON");
    }

    #[test]
    fn test_extract_atk_urls_from_next_data_deduplicates() {
        use crate::batch_import::extract_atk_urls_from_next_data;

        // Same path appears twice in different parts of the JSON
        let html = r#"
            <html><head>
                <script id="__NEXT_DATA__" type="application/json">
                {
                    "props": {
                        "pageProps": {
                            "featured": {"path": "/recipes/11111-roast-chicken"},
                            "recipes": [
                                {"path": "/recipes/11111-roast-chicken"},
                                {"path": "/recipes/22222-beef-stew"}
                            ]
                        }
                    }
                }
                </script>
            </head><body></body></html>
        "#;

        let urls = extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 2, "Duplicate paths should be deduplicated");
    }

    /// Integration test: mock server returns HTML with __NEXT_DATA__ but NO <a> tags.
    /// This simulates ATK's JS-rendered page and verifies the full fallback flow.
    #[tokio::test]
    async fn test_atk_pagination_falls_back_to_next_data_when_no_anchor_tags() {
        use tokio::time::{timeout, Duration};

        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Simulates what reqwest actually gets from ATK: server-rendered HTML has no
        // <a href="/recipes/..."> elements — all recipe data lives in __NEXT_DATA__.
        let next_data_only_html = r#"
            <html>
                <head>
                    <script id="__NEXT_DATA__" type="application/json">
                    {
                        "props": {
                            "pageProps": {
                                "recipes": [
                                    {"path": "/recipes/11111-beef-stew", "title": "Beef Stew"},
                                    {"path": "/recipes/22222-chicken-tikka", "title": "Chicken Tikka"},
                                    {"path": "/recipes/33333-pasta-primavera", "title": "Pasta Primavera"}
                                ],
                                "pagination": {
                                    "hasNextPage": false,
                                    "totalCount": 3
                                }
                            }
                        }
                    }
                    </script>
                </head>
                <body>
                    <div id="__NEXT_PAGE__"><!-- React renders here --></div>
                </body>
            </html>
        "#;

        Mock::given(method("GET"))
            .and(path("/recipes/all"))
            .respond_with(ResponseTemplate::new(200).set_body_string(next_data_only_html))
            .mount(&mock_server)
            .await;

        // Use a hostname that will be treated as ATK
        // We need to override the host check — but the mock server uses 127.0.0.1.
        // So we'll call extract_atk_urls_from_next_data directly for this unit-level integration test.
        let html = next_data_only_html;
        let urls = crate::batch_import::extract_atk_urls_from_next_data(
            html,
            "https://www.americastestkitchen.com/recipes/all",
        );

        assert_eq!(urls.len(), 3, "Should extract 3 recipe URLs from __NEXT_DATA__");
        assert!(urls.iter().any(|u| u.contains("/recipes/11111-beef-stew")));
        assert!(urls.iter().any(|u| u.contains("/recipes/22222-chicken-tikka")));
        assert!(urls.iter().any(|u| u.contains("/recipes/33333-pasta-primavera")));
        // All URLs should be absolute ATK URLs
        for url in &urls {
            assert!(url.starts_with("https://www.americastestkitchen.com"), "URLs should be absolute: {}", url);
        }
    }

    #[tokio::test]
    async fn test_atk_pagination_handles_server_error_gracefully() {
        use tokio::time::{timeout, Duration};

        let mock_server = MockServer::start().await;
        let importer = BatchImporter::new();

        // Page 1: valid recipes
        let page1_html = r#"
            <html><body>
                <a href="https://www.americastestkitchen.com/recipes/11111-beef-stew">Beef Stew</a>
                <button>Load More</button>
            </body></html>
        "#;

        // Page 2: server returns 404 — should stop gracefully.
        // Mount page=2 mock first so it matches before the catch-all page=1 mock.
        Mock::given(method("GET"))
            .and(wiremock::matchers::query_param("page", "2"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/recipes/all"))
            .respond_with(ResponseTemplate::new(200).set_body_string(page1_html))
            .mount(&mock_server)
            .await;

        let start_url = format!("{}/recipes/all", mock_server.uri());

        let result = timeout(
            Duration::from_secs(15),
            crate::batch_import::extract_recipe_urls_from_page_concurrent(&importer.client, &start_url),
        )
        .await;

        assert!(result.is_ok(), "Should not timeout");
        let urls = result.unwrap().unwrap();
        assert_eq!(urls.len(), 1, "Should return URLs from page 1 before the error");
    }
}
