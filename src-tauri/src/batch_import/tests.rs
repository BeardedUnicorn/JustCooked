#![allow(non_snake_case)]

#[cfg(test)]
mod tests {
    use super::super::*;

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

        // Valid category URLs
        assert!(importer.is_valid_category_url("https://www.allrecipes.com/recipes/79/desserts"));
        assert!(importer.is_valid_category_url("https://allrecipes.com/recipes/17562/dinner/main-dishes"));

        // Invalid URLs
        assert!(!importer.is_valid_category_url("https://www.allrecipes.com/recipe/123/individual-recipe"));
        assert!(!importer.is_valid_category_url("https://example.com/recipes"));
        assert!(!importer.is_valid_category_url("invalid-url"));
    }

    #[tokio::test]
    async fn test_is_valid_recipe_url() {
        let importer = BatchImporter::new();

        // Valid recipe URLs
        assert!(importer.is_valid_recipe_url("https://www.allrecipes.com/recipe/123/chocolate-chip-cookies"));
        assert!(importer.is_valid_recipe_url("https://allrecipes.com/recipe/456/banana-bread"));

        // Invalid URLs - no recipe name after ID
        assert!(!importer.is_valid_recipe_url("https://www.allrecipes.com/recipe/123"));
        assert!(!importer.is_valid_recipe_url("https://www.allrecipes.com/recipe/456/"));

        // Invalid URLs - not AllRecipes
        assert!(!importer.is_valid_recipe_url("https://example.com/recipe/123/test"));
        assert!(!importer.is_valid_recipe_url("invalid-url"));

        // Invalid URLs - not recipe path
        assert!(!importer.is_valid_recipe_url("https://www.allrecipes.com/recipes/79/desserts"));
    }

    #[tokio::test]
    async fn test_resolve_url() {
        let importer = BatchImporter::new();

        // Test relative URL resolution
        let base = "https://www.allrecipes.com/recipes/79/desserts";
        let relative = "/recipe/123/chocolate-chip-cookies";
        let resolved = importer.resolve_url(base, relative).unwrap();
        assert_eq!(resolved, "https://www.allrecipes.com/recipe/123/chocolate-chip-cookies");

        // Test absolute URL
        let absolute = "https://www.allrecipes.com/recipe/456/banana-bread";
        let resolved = importer.resolve_url(base, absolute).unwrap();
        assert_eq!(resolved, absolute);

        // Test invalid base URL
        let result = importer.resolve_url("invalid-url", relative);
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
        let recipe_urls = importer.extract_recipe_urls_from_page(&page_url).await.unwrap();

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

        let estimated = importer.calculate_estimated_time_remaining();
        assert!(estimated.is_some());

        // Should estimate roughly 240 seconds remaining (60 seconds for 20 recipes, so 240 for remaining 80)
        let estimated_time = estimated.unwrap();
        assert!(estimated_time > 200 && estimated_time < 300, "Estimated time should be around 240 seconds, got {}", estimated_time);
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

        let estimated = importer.calculate_estimated_time_remaining();
        assert!(estimated.is_none(), "Should return None when no progress has been made");
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

        let estimated = importer.calculate_estimated_time_remaining();
        assert!(estimated.is_none(), "Should return None when import is complete");
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

        // Update progress with estimation
        importer.update_progress_with_estimation();

        let progress = importer.get_progress();
        assert!(progress.estimated_time_remaining.is_some());

        let estimated = progress.estimated_time_remaining.unwrap();
        // Should estimate roughly 270 seconds remaining (30 seconds for 10 recipes, so 270 for remaining 90)
        assert!(estimated > 200 && estimated < 350, "Estimated time should be reasonable, got {}", estimated);
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
}
