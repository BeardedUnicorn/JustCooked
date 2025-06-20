#[cfg(test)]
mod e2e_tests {
    // Removed unused imports: Recipe, Ingredient, BatchImporter
    use crate::ingredient_parsing::get_ingredient_parser;
    use std::time::{Duration, Instant};


    /// End-to-end test for full recipe import workflow with Kalosm
    #[tokio::test]
    async fn test_full_recipe_import_workflow() {
        // Create a test recipe with ingredients
        let test_recipe_data = serde_json::json!({
            "name": "Test Chocolate Chip Cookies",
            "description": "Delicious homemade cookies",
            "prep_time": "PT15M",
            "cook_time": "PT12M",
            "total_time": "PT27M",
            "servings": 24,
            "ingredients": [
                "2 1/4 cups all-purpose flour",
                "1 teaspoon baking soda",
                "1 teaspoon salt",
                "1 cup butter, softened",
                "3/4 cup granulated sugar",
                "3/4 cup packed brown sugar",
                "2 large eggs",
                "2 teaspoons vanilla extract",
                "2 cups chocolate chips"
            ],
            "instructions": [
                "Preheat oven to 375°F",
                "Mix dry ingredients in a bowl",
                "Cream butter and sugars",
                "Add eggs and vanilla",
                "Combine wet and dry ingredients",
                "Stir in chocolate chips",
                "Drop onto baking sheets",
                "Bake 9-11 minutes"
            ],
            "source_url": "https://example.com/test-recipe"
        });

        let start_time = Instant::now();

        // Test ingredient parsing with Kalosm
        let parser = get_ingredient_parser();
        let ingredient_strings: Vec<String> = test_recipe_data["ingredients"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap().to_string())
            .collect();

        println!("Testing ingredient parsing for {} ingredients...", ingredient_strings.len());
        
        // Parse ingredients individually (since parse_ingredients_batch was removed)
        let mut parsed_ingredients = Vec::new();
        for ingredient_str in &ingredient_strings {
            if let Ok(Some(ingredient)) = parser.parse_ingredient(ingredient_str, None).await {
                parsed_ingredients.push(ingredient);
            }
        }
        println!("✓ Successfully parsed {}/{} ingredients",
            parsed_ingredients.len(), ingredient_strings.len());

        // Verify parsing quality
        assert!(!parsed_ingredients.is_empty(), "No ingredients were parsed successfully");
        
        let parsing_success_rate = parsed_ingredients.len() as f64 / ingredient_strings.len() as f64;
        println!("Ingredient parsing success rate: {:.1}%", parsing_success_rate * 100.0);
        
        // Should parse at least 70% of ingredients successfully
        assert!(parsing_success_rate >= 0.7, 
            "Parsing success rate too low: {:.1}%", parsing_success_rate * 100.0);

        // Test data consistency
        for ingredient in &parsed_ingredients {
            assert!(!ingredient.name.is_empty(), "Ingredient name should not be empty");
            if !ingredient.amount.is_empty() {
                let amount: f64 = ingredient.amount.parse().unwrap_or(0.0);
                assert!(amount > 0.0, "Ingredient amount should be positive");
            }
        }

        let total_time = start_time.elapsed();
        println!("Full recipe import workflow completed in {}ms", total_time.as_millis());
        
        // Performance target: should complete within 10 seconds
        assert!(total_time < Duration::from_secs(10), 
            "Recipe import took too long: {}ms", total_time.as_millis());

        println!("✓ End-to-end recipe import test passed");
    }

    /// Test batch import performance with multiple recipes
    #[tokio::test]
    async fn test_batch_import_performance() {
        let test_urls = vec![
            "https://example.com/recipe1",
            "https://example.com/recipe2", 
            "https://example.com/recipe3",
        ];

        // Note: This would normally test with real URLs, but for unit testing
        // we'll simulate the batch import process
        println!("Testing batch import performance simulation...");
        
        let start_time = Instant::now();
        
        // Simulate batch import processing
        let parser = get_ingredient_parser();
        let test_ingredients = vec![
            "2 cups flour".to_string(),
            "1 cup sugar".to_string(),
            "3 eggs".to_string(),
            "1/2 cup butter".to_string(),
            "1 tsp vanilla".to_string(),
        ];

        // Process multiple batches to simulate multiple recipes
        let mut total_processed = 0;
        for i in 0..test_urls.len() {
            let batch_start = Instant::now();
            
            // Parse ingredients individually
            let mut batch_ingredients = Vec::new();
            for ingredient_str in &test_ingredients {
                if let Ok(Some(ingredient)) = parser.parse_ingredient(ingredient_str, None).await {
                    batch_ingredients.push(ingredient);
                }
            }
            total_processed += batch_ingredients.len();
            println!("Batch {} processed {} ingredients in {}ms",
                i + 1, batch_ingredients.len(), batch_start.elapsed().as_millis());
            
            // Small delay between batches
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let total_time = start_time.elapsed();
        let avg_time_per_batch = total_time / test_urls.len() as u32;
        
        println!("Batch import performance results:");
        println!("  Total batches: {}", test_urls.len());
        println!("  Total ingredients processed: {}", total_processed);
        println!("  Total time: {}ms", total_time.as_millis());
        println!("  Average per batch: {}ms", avg_time_per_batch.as_millis());

        // Performance targets
        assert!(avg_time_per_batch < Duration::from_secs(5), 
            "Batch processing too slow: {}ms per batch", avg_time_per_batch.as_millis());
        assert!(total_processed > 0, "No ingredients were processed");

        println!("✓ Batch import performance test passed");
    }

    /// Test UI responsiveness during parsing (simulated)
    #[tokio::test]
    async fn test_ui_responsiveness_simulation() {
        let parser = get_ingredient_parser();
        
        // Simulate concurrent UI operations during parsing
        let parsing_task = async {
            let ingredients = vec![
                "2 cups flour".to_string(),
                "1 cup sugar".to_string(),
                "3 eggs".to_string(),
                "1/2 cup butter".to_string(),
                "1 tsp vanilla".to_string(),
                "1 cup milk".to_string(),
                "2 tsp baking powder".to_string(),
                "1/2 tsp salt".to_string(),
            ];

            // Parse ingredients individually
            let mut parsed_ingredients = Vec::new();
            for ingredient_str in &ingredients {
                if let Ok(Some(ingredient)) = parser.parse_ingredient(ingredient_str, None).await {
                    parsed_ingredients.push(ingredient);
                }
            }
            Ok::<Vec<crate::database::Ingredient>, String>(parsed_ingredients)
        };

        // Simulate UI operations
        let ui_simulation_task = async {
            for i in 0..10 {
                // Simulate UI updates every 100ms
                tokio::time::sleep(Duration::from_millis(100)).await;
                println!("UI update {}/10", i + 1);
            }
            Ok::<(), String>(())
        };

        let start_time = Instant::now();
        
        // Run both tasks concurrently
        let (parsing_result, ui_result) = tokio::join!(parsing_task, ui_simulation_task);
        
        let total_time = start_time.elapsed();

        match parsing_result {
            Ok(ingredients) => {
                println!("✓ Parsing completed with {} ingredients", ingredients.len());
            }
            Err(e) => {
                println!("✗ Parsing failed: {}", e);
            }
        }

        match ui_result {
            Ok(_) => {
                println!("✓ UI simulation completed");
            }
            Err(e) => {
                println!("✗ UI simulation failed: {}", e);
            }
        }

        println!("Concurrent operations completed in {}ms", total_time.as_millis());
        
        // UI should remain responsive (total time shouldn't be much longer than parsing alone)
        assert!(total_time < Duration::from_secs(5), 
            "Operations took too long, UI may be unresponsive: {}ms", total_time.as_millis());

        println!("✓ UI responsiveness test passed");
    }

    /// Test data consistency and accuracy
    #[tokio::test]
    async fn test_data_consistency_and_accuracy() {
        let parser = get_ingredient_parser();
        
        // Test ingredients with known expected characteristics
        let test_cases = vec![
            ("2 cups all-purpose flour", "flour", 2.0, "cup"),
            ("1 tablespoon olive oil", "oil", 1.0, "tbsp"),
            ("3 large eggs", "eggs", 3.0, ""),
            ("1/2 cup sugar", "sugar", 0.5, "cup"),
            ("1 teaspoon vanilla extract", "vanilla", 1.0, "tsp"),
        ];

        let mut consistency_score = 0;
        let total_tests = test_cases.len();

        for (ingredient_text, expected_name_part, expected_amount, expected_unit) in test_cases {
            match parser.parse_ingredient(ingredient_text, None).await {
                Ok(Some(ingredient)) => {
                    let mut test_passed = true;
                    
                    // Check name consistency
                    if !ingredient.name.to_lowercase().contains(&expected_name_part.to_lowercase()) {
                        println!("✗ Name inconsistency for '{}': expected to contain '{}', got '{}'", 
                            ingredient_text, expected_name_part, ingredient.name);
                        test_passed = false;
                    }
                    
                    // Check amount accuracy
                    if !ingredient.amount.is_empty() {
                        let actual_amount: f64 = ingredient.amount.parse().unwrap_or(0.0);
                        if (actual_amount - expected_amount).abs() > 0.1 {
                            println!("✗ Amount inaccuracy for '{}': expected {}, got {}",
                                ingredient_text, expected_amount, actual_amount);
                            test_passed = false;
                        }
                    } else if expected_amount > 0.0 {
                        println!("✗ Missing amount for '{}': expected {}",
                            ingredient_text, expected_amount);
                        test_passed = false;
                    }
                    
                    // Check unit consistency (if expected)
                    if !expected_unit.is_empty() {
                        if !ingredient.unit.is_empty() {
                            let actual_unit = &ingredient.unit;
                            if !actual_unit.to_lowercase().contains(&expected_unit.to_lowercase()) {
                                println!("✗ Unit inconsistency for '{}': expected '{}', got '{}'",
                                    ingredient_text, expected_unit, actual_unit);
                                test_passed = false;
                            }
                        } else {
                            println!("✗ Missing unit for '{}': expected '{}'",
                                ingredient_text, expected_unit);
                            test_passed = false;
                        }
                    }
                    
                    if test_passed {
                        consistency_score += 1;
                        println!("✓ Data consistent for: '{}'", ingredient_text);
                    }
                }
                Ok(None) => {
                    println!("✗ No result for: '{}'", ingredient_text);
                }
                Err(e) => {
                    println!("✗ Error parsing '{}': {}", ingredient_text, e);
                }
            }
        }

        let consistency_rate = consistency_score as f64 / total_tests as f64;
        println!("Data consistency and accuracy results:");
        println!("  Consistent results: {}/{}", consistency_score, total_tests);
        println!("  Consistency rate: {:.1}%", consistency_rate * 100.0);

        // Should achieve at least 80% consistency
        assert!(consistency_rate >= 0.8, 
            "Data consistency too low: {:.1}% (expected >= 80%)", consistency_rate * 100.0);

        println!("✓ Data consistency and accuracy test passed");
    }
}
