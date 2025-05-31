// Test module declarations
pub mod integration_tests;
pub mod property_tests;
pub mod test_utils;

// Re-export commonly used test utilities
pub use test_utils::*;

#[cfg(test)]
mod test_runner {
    
    /// Comprehensive test suite runner that validates all core functionality
    #[tokio::test]
    async fn run_comprehensive_test_suite() {
        println!("🧪 Running comprehensive test suite for JustCooked Recipe Application");
        
        // Test 1: Recipe Import Module
        println!("📋 Testing Recipe Import Module...");
        test_recipe_import_comprehensive().await;
        
        // Test 2: Image Storage Module  
        println!("🖼️  Testing Image Storage Module...");
        test_image_storage_comprehensive().await;
        
        // Test 3: Integration Tests
        println!("🔗 Testing Integration Scenarios...");
        test_integration_comprehensive().await;
        
        // Test 4: Error Handling
        println!("⚠️  Testing Error Handling...");
        test_error_handling_comprehensive().await;
        
        println!("✅ All comprehensive tests passed!");
    }
    
    async fn test_recipe_import_comprehensive() {
        use url::Url;

        // Test URL validation with all supported sites
        let test_urls = crate::test_utils::create_test_urls();
        for (url_str, expected) in test_urls {
            if let Ok(url) = Url::parse(url_str) {
                assert_eq!(JustCooked::recipe_import::is_supported_url(&url), expected,
                          "URL validation failed for: {}", url_str);
            }
        }

        // Test JSON-LD parsing with sample data
        let sample_json = crate::test_utils::create_sample_recipe_json();
        let result = JustCooked::recipe_import::parse_json_ld_recipe(&sample_json, "https://example.com");
        assert!(result.is_ok(), "JSON-LD parsing failed");
        
        let recipe = result.unwrap();
        assert!(crate::test_utils::validate_recipe_completeness(&recipe), "Recipe is incomplete");
        assert_eq!(recipe.name, "Classic Chocolate Chip Cookies");
        assert_eq!(recipe.servings, 24);
        assert_eq!(recipe.ingredients.len(), 9);
        assert_eq!(recipe.instructions.len(), 9);

        // Test HTML parsing
        let sample_html = crate::test_utils::create_sample_recipe_html(&sample_json);
        let html_result = JustCooked::recipe_import::extract_recipe_data(&sample_html, "https://www.allrecipes.com/recipe/123");
        assert!(html_result.is_ok(), "HTML parsing failed");

        // Test HTML fallback
        let minimal_html = crate::test_utils::create_minimal_recipe_html();
        let fallback_result = JustCooked::recipe_import::extract_recipe_data(&minimal_html, "https://www.foodnetwork.com/recipe/456");
        assert!(fallback_result.is_ok(), "HTML fallback parsing failed");
        
        println!("  ✅ Recipe import tests passed");
    }
    
    async fn test_image_storage_comprehensive() {
        use tempfile::TempDir;

        // Test image URL validation
        let image_test_cases = crate::test_utils::create_image_url_test_cases();
        for (url, expected) in image_test_cases {
            assert_eq!(JustCooked::image_storage::is_valid_image_url(url), expected,
                      "Image URL validation failed for: {}", url);
        }

        // Test app data directory
        let app_dir_result = JustCooked::image_storage::get_app_data_dir();
        assert!(app_dir_result.is_ok(), "Failed to get app data directory");

        // Test file operations
        let temp_dir = TempDir::new().unwrap();
        let test_image_path = crate::test_utils::create_test_image_file(&temp_dir, "test.jpg").await;

        // Test reading image as base64
        let base64_result = JustCooked::image_storage::get_local_image_as_base64(
            test_image_path.to_str().unwrap()
        ).await;
        assert!(base64_result.is_ok(), "Failed to read image as base64");

        let data_url = base64_result.unwrap();
        assert!(data_url.starts_with("data:image/jpeg;base64,"), "Invalid data URL format");

        // Test image deletion
        let delete_result = JustCooked::image_storage::delete_stored_image(
            test_image_path.to_str().unwrap()
        ).await;
        assert!(delete_result.is_ok(), "Failed to delete image");
        assert!(!test_image_path.exists(), "Image file still exists after deletion");
        
        println!("  ✅ Image storage tests passed");
    }
    
    async fn test_integration_comprehensive() {
        use JustCooked::{recipe_import, image_storage};

        // Test complete recipe import workflow
        let sample_json = crate::test_utils::create_sample_recipe_json();
        let sample_html = crate::test_utils::create_sample_recipe_html(&sample_json);
        
        // Parse recipe from HTML
        let recipe_result = recipe_import::extract_recipe_data(
            &sample_html, 
            "https://www.allrecipes.com/recipe/123"
        );
        assert!(recipe_result.is_ok(), "Integration: Recipe parsing failed");
        
        let recipe = recipe_result.unwrap();
        
        // Validate recipe data integrity
        assert!(!recipe.name.is_empty(), "Integration: Recipe name is empty");
        assert!(!recipe.image.is_empty(), "Integration: Recipe image is empty");
        assert!(!recipe.ingredients.is_empty(), "Integration: No ingredients found");
        assert!(!recipe.instructions.is_empty(), "Integration: No instructions found");
        
        // Test image URL validation for recipe image
        assert!(image_storage::is_valid_image_url(&recipe.image), 
               "Integration: Recipe image URL is invalid");
        
        println!("  ✅ Integration tests passed");
    }
    
    async fn test_error_handling_comprehensive() {
        use JustCooked::{recipe_import, image_storage};
        use scraper::Html;
        
        // Test recipe import error cases
        let error_cases = crate::test_utils::create_error_test_cases();
        for (case_name, html_content) in error_cases {
            let document = Html::parse_document(html_content);
            let result = recipe_import::extract_from_json_ld(&document, "https://example.com");
            
            match case_name {
                "invalid_json" | "missing_type" | "wrong_type" | "empty_json" => {
                    assert!(result.is_err(), "Expected error for case: {}", case_name);
                }
                _ => {
                    // Some cases might still succeed with fallback parsing
                }
            }
        }
        
        // Test image storage error cases
        let invalid_image_result = image_storage::get_local_image_as_base64("/nonexistent/file.jpg").await;
        assert!(invalid_image_result.is_err(), "Expected error for nonexistent file");
        
        let error = invalid_image_result.unwrap_err();
        assert_eq!(error.error_type, "FileNotFound");
        
        // Test invalid URL handling
        let invalid_url_result = image_storage::download_and_store_image(
            "not-a-url", 
            std::path::Path::new("/tmp")
        ).await;
        assert!(invalid_url_result.is_err(), "Expected error for invalid URL");
        
        println!("  ✅ Error handling tests passed");
    }
}

#[cfg(test)]
mod performance_tests {
    use std::time::Instant;
    
    #[tokio::test]
    async fn test_recipe_parsing_performance() {
        let sample_json = crate::test_utils::create_sample_recipe_json();
        let sample_html = crate::test_utils::create_sample_recipe_html(&sample_json);
        
        let start = Instant::now();
        
        // Parse 100 recipes to test performance
        for _ in 0..100 {
            let result = JustCooked::recipe_import::extract_recipe_data(
                &sample_html, 
                "https://www.allrecipes.com/recipe/123"
            );
            assert!(result.is_ok());
        }
        
        let duration = start.elapsed();
        println!("Parsed 100 recipes in: {:?}", duration);
        
        // Should be able to parse at least 10 recipes per second
        assert!(duration.as_millis() < 10000, "Recipe parsing is too slow");
    }
    
    #[tokio::test]
    async fn test_large_recipe_handling() {
        use serde_json::json;
        
        // Create a recipe with many ingredients and instructions
        let large_ingredients: Vec<String> = (0..100)
            .map(|i| format!("{} cups ingredient {}", i + 1, i + 1))
            .collect();
        
        let large_instructions: Vec<String> = (0..50)
            .map(|i| format!("Step {}: Do something with ingredient {}", i + 1, i + 1))
            .collect();
        
        let large_recipe_json = json!({
            "@type": "Recipe",
            "name": "Large Recipe Test",
            "description": "A recipe with many ingredients and instructions",
            "recipeIngredient": large_ingredients,
            "recipeInstructions": large_instructions.iter().map(|text| json!({
                "@type": "HowToStep",
                "text": text
            })).collect::<Vec<_>>()
        });
        
        let start = Instant::now();
        let result = JustCooked::recipe_import::parse_json_ld_recipe(
            &large_recipe_json, 
            "https://example.com"
        );
        let duration = start.elapsed();
        
        assert!(result.is_ok(), "Failed to parse large recipe");
        let recipe = result.unwrap();
        assert_eq!(recipe.ingredients.len(), 100);
        assert_eq!(recipe.instructions.len(), 50);
        
        println!("Parsed large recipe in: {:?}", duration);
        assert!(duration.as_millis() < 100, "Large recipe parsing is too slow");
    }
}

#[cfg(test)]
mod edge_case_tests {
    
    #[test]
    fn test_unicode_handling() {
        use JustCooked::recipe_import;
        use serde_json::json;
        
        // Test recipe with unicode characters
        let unicode_recipe = json!({
            "@type": "Recipe",
            "name": "Crème Brûlée with Café",
            "description": "A delicious French dessert with café notes",
            "recipeIngredient": [
                "2 cups crème fraîche",
                "½ cup café espresso",
                "¼ cup sucré"
            ],
            "recipeInstructions": [
                "Mélanger the crème with café",
                "Chauffer until très hot"
            ]
        });
        
        let result = recipe_import::parse_json_ld_recipe(&unicode_recipe, "https://example.com");
        assert!(result.is_ok());
        
        let recipe = result.unwrap();
        assert_eq!(recipe.name, "Crème Brûlée with Café");
        assert!(recipe.ingredients[0].contains("crème fraîche"));
        assert!(recipe.instructions[0].contains("Mélanger"));
    }
    
    #[test]
    fn test_empty_and_null_values() {
        use JustCooked::recipe_import;
        use serde_json::json;
        
        // Test recipe with empty and null values
        let sparse_recipe = json!({
            "@type": "Recipe",
            "name": "",
            "description": null,
            "recipeIngredient": [],
            "recipeInstructions": null,
            "recipeYield": null
        });
        
        let result = recipe_import::parse_json_ld_recipe(&sparse_recipe, "https://example.com");
        assert!(result.is_ok());
        
        let recipe = result.unwrap();
        assert_eq!(recipe.name, ""); // Empty name should be preserved
        assert_eq!(recipe.description, "");
        assert_eq!(recipe.ingredients.len(), 0);
        assert_eq!(recipe.instructions.len(), 0);
        assert_eq!(recipe.servings, 0);
    }
}
