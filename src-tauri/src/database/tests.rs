#[cfg(test)]
mod tests {
    use crate::database::{Database, Recipe, Ingredient, NutritionalInfo, IngredientDatabase};
    use chrono::Utc;
    use tempfile::TempDir;
    use sqlx::sqlite::SqlitePool;

    async fn create_test_database() -> (Database, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_recipes.db");
        
        // Create the database file before connecting
        std::fs::File::create(&db_path).unwrap();
        
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let db = Database::from_pool(pool);
        db.migrate().await.unwrap();

        (db, temp_dir)
    }

    fn create_test_recipe() -> Recipe {
        Recipe {
            id: "test-recipe-1".to_string(),
            title: "Test Recipe".to_string(),
            description: "A test recipe for unit testing".to_string(),
            image: "test-image.jpg".to_string(),
            source_url: "https://example.com/recipe".to_string(),
            prep_time: "10 minutes".to_string(),
            cook_time: "20 minutes".to_string(),
            total_time: "30 minutes".to_string(),
            servings: 4,
            ingredients: vec![
                Ingredient {
                    name: "Test Ingredient 1".to_string(),
                    amount: "1".to_string(),
                    unit: "cup".to_string(),
                    category: Some("vegetables".to_string()),
                    section: None,
                },
                Ingredient {
                    name: "Test Ingredient 2".to_string(),
                    amount: "2".to_string(),
                    unit: "tbsp".to_string(),
                    category: None,
                    section: None,
                },
            ],
            instructions: vec![
                "Step 1: Do something".to_string(),
                "Step 2: Do something else".to_string(),
            ],
            tags: vec!["test".to_string(), "unit-test".to_string()],
            date_added: Utc::now(),
            date_modified: Utc::now(),
            rating: Some(5),
            difficulty: Some("Easy".to_string()),
            is_favorite: Some(false), // Changed from true to false to avoid affecting favorite tests
            personal_notes: Some("This is a test recipe".to_string()),
            collections: vec!["test-collection".to_string()],
            nutritional_info: Some(NutritionalInfo {
                calories: Some(250.0),
                protein: Some(10.0),
                carbs: Some(30.0),
                fat: Some(8.0),
                fiber: Some(5.0),
                sugar: Some(12.0),
                sodium: Some(400.0),
            }),
        }
    }

    #[tokio::test]
    async fn test_save_and_get_recipe() {
        let (db, _temp_dir) = create_test_database().await;
        let recipe = create_test_recipe();

        // Save the recipe
        db.save_recipe(&recipe).await.unwrap();

        // Retrieve the recipe
        let retrieved = db.get_recipe_by_id(&recipe.id).await.unwrap();
        assert!(retrieved.is_some());

        let retrieved_recipe = retrieved.unwrap();
        assert_eq!(retrieved_recipe.id, recipe.id);
        assert_eq!(retrieved_recipe.title, recipe.title);
        assert_eq!(retrieved_recipe.description, recipe.description);
        assert_eq!(retrieved_recipe.servings, recipe.servings);
        assert_eq!(retrieved_recipe.ingredients.len(), recipe.ingredients.len());
        assert_eq!(retrieved_recipe.instructions.len(), recipe.instructions.len());
        assert_eq!(retrieved_recipe.tags, recipe.tags);
        assert_eq!(retrieved_recipe.rating, recipe.rating);
        assert_eq!(retrieved_recipe.is_favorite, recipe.is_favorite);
    }

    #[tokio::test]
    async fn test_get_nonexistent_recipe() {
        let (db, _temp_dir) = create_test_database().await;

        let result = db.get_recipe_by_id("nonexistent-id").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_all_recipes() {
        let (db, _temp_dir) = create_test_database().await;

        // Initially should be empty
        let recipes = db.get_all_recipes().await.unwrap();
        assert_eq!(recipes.len(), 0);

        // Add a recipe
        let recipe = create_test_recipe();
        db.save_recipe(&recipe).await.unwrap();

        // Should now have one recipe
        let recipes = db.get_all_recipes().await.unwrap();
        assert_eq!(recipes.len(), 1);
        assert_eq!(recipes[0].id, recipe.id);

        // Add another recipe
        let mut recipe2 = create_test_recipe();
        recipe2.id = "test-recipe-2".to_string();
        recipe2.title = "Second Test Recipe".to_string();
        recipe2.source_url = "https://example.com/recipe2".to_string();
        db.save_recipe(&recipe2).await.unwrap();

        // Should now have two recipes
        let recipes = db.get_all_recipes().await.unwrap();
        assert_eq!(recipes.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_recipe() {
        let (db, _temp_dir) = create_test_database().await;
        let recipe = create_test_recipe();

        // Save the recipe
        db.save_recipe(&recipe).await.unwrap();

        // Verify it exists
        let retrieved = db.get_recipe_by_id(&recipe.id).await.unwrap();
        assert!(retrieved.is_some());

        // Delete the recipe
        let deleted = db.delete_recipe(&recipe.id).await.unwrap();
        assert!(deleted);

        // Verify it's gone
        let retrieved = db.get_recipe_by_id(&recipe.id).await.unwrap();
        assert!(retrieved.is_none());

        // Try to delete again (should return false)
        let deleted = db.delete_recipe(&recipe.id).await.unwrap();
        assert!(!deleted);
    }

    #[tokio::test]
    async fn test_search_recipes() {
        let (db, _temp_dir) = create_test_database().await;

        // Create test recipes
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.title = "Chocolate Cake".to_string();
        recipe1.description = "A delicious chocolate cake".to_string();
        recipe1.source_url = "https://example.com/recipe1".to_string();

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.title = "Vanilla Cookies".to_string();
        recipe2.description = "Sweet vanilla cookies".to_string();
        recipe2.source_url = "https://example.com/recipe2".to_string();

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
        recipe3.title = "Strawberry Pie".to_string();
        recipe3.description = "Fresh strawberry pie with chocolate drizzle".to_string();
        recipe3.source_url = "https://example.com/recipe3".to_string();

        // Save all recipes
        db.save_recipe(&recipe1).await.unwrap();
        db.save_recipe(&recipe2).await.unwrap();
        db.save_recipe(&recipe3).await.unwrap();

        // Search for "chocolate" - should find recipe1 and recipe3
        let results = db.search_recipes("chocolate").await.unwrap();
        assert_eq!(results.len(), 2);
        let titles: Vec<&str> = results.iter().map(|r| r.title.as_str()).collect();
        assert!(titles.contains(&"Chocolate Cake"));
        assert!(titles.contains(&"Strawberry Pie"));

        // Search for "vanilla" - should find recipe2
        let results = db.search_recipes("vanilla").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Vanilla Cookies");

        // Search for "nonexistent" - should find nothing
        let results = db.search_recipes("nonexistent").await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_get_recipes_by_tag() {
        let (db, _temp_dir) = create_test_database().await;

        // Create test recipes with different tags
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.source_url = "https://example.com/recipe1".to_string();
        recipe1.tags = vec!["dessert".to_string(), "chocolate".to_string()];

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.source_url = "https://example.com/recipe2".to_string();
        recipe2.tags = vec!["dessert".to_string(), "vanilla".to_string()];

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
        recipe3.source_url = "https://example.com/recipe3".to_string();
        recipe3.tags = vec!["main-course".to_string(), "chicken".to_string()];

        // Save all recipes
        db.save_recipe(&recipe1).await.unwrap();
        db.save_recipe(&recipe2).await.unwrap();
        db.save_recipe(&recipe3).await.unwrap();

        // Search for "dessert" tag - should find recipe1 and recipe2
        let results = db.get_recipes_by_tag("dessert").await.unwrap();
        assert_eq!(results.len(), 2);

        // Search for "chocolate" tag - should find recipe1
        let results = db.get_recipes_by_tag("chocolate").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "recipe-1");

        // Search for "nonexistent" tag - should find nothing
        let results = db.get_recipes_by_tag("nonexistent").await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_get_favorite_recipes() {
        let (db, _temp_dir) = create_test_database().await;

        // Create test recipes with different favorite status
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.source_url = "https://example.com/recipe1".to_string();
        recipe1.is_favorite = Some(true);

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.source_url = "https://example.com/recipe2".to_string();
        recipe2.is_favorite = Some(false);

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
        recipe3.source_url = "https://example.com/recipe3".to_string();
        recipe3.is_favorite = None;

        // Save all recipes
        db.save_recipe(&recipe1).await.unwrap();
        db.save_recipe(&recipe2).await.unwrap();
        db.save_recipe(&recipe3).await.unwrap();

        // Get favorite recipes - should only find recipe1
        let results = db.get_favorite_recipes().await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "recipe-1");
    }

    #[tokio::test]
    async fn test_get_existing_recipe_urls() {
        let (db, _temp_dir) = create_test_database().await;

        // Create test recipes with different URLs
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.source_url = "https://example.com/recipe1".to_string();

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.source_url = "https://example.com/recipe2".to_string();

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
        recipe3.source_url = "".to_string(); // Empty URL

        // Save all recipes
        db.save_recipe(&recipe1).await.unwrap();
        db.save_recipe(&recipe2).await.unwrap();
        db.save_recipe(&recipe3).await.unwrap();

        // Get existing URLs - should find recipe1 and recipe2 URLs
        let urls = db.get_existing_recipe_urls().await.unwrap();
        assert_eq!(urls.len(), 2);
        assert!(urls.contains(&"https://example.com/recipe1".to_string()));
        assert!(urls.contains(&"https://example.com/recipe2".to_string()));
    }

    #[tokio::test]
    async fn test_update_recipe() {
        let (db, _temp_dir) = create_test_database().await;
        let mut recipe = create_test_recipe();

        // Save the original recipe
        db.save_recipe(&recipe).await.unwrap();

        // Update the recipe
        recipe.title = "Updated Test Recipe".to_string();
        recipe.rating = Some(4);
        recipe.date_modified = Utc::now();

        // Save the updated recipe
        db.save_recipe(&recipe).await.unwrap();

        // Retrieve and verify the update
        let retrieved = db.get_recipe_by_id(&recipe.id).await.unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Test Recipe");
        assert_eq!(retrieved.rating, Some(4));

        // Should still only have one recipe
        let all_recipes = db.get_all_recipes().await.unwrap();
        assert_eq!(all_recipes.len(), 1);
    }

    #[tokio::test]
    async fn test_recipe_serialization() {
        let (db, _temp_dir) = create_test_database().await;
        let recipe = create_test_recipe();

        // Save and retrieve the recipe
        db.save_recipe(&recipe).await.unwrap();
        let retrieved = db.get_recipe_by_id(&recipe.id).await.unwrap().unwrap();

        // Verify complex fields are properly serialized/deserialized
        assert_eq!(retrieved.ingredients.len(), recipe.ingredients.len());
        assert_eq!(retrieved.ingredients[0].name, recipe.ingredients[0].name);
        assert_eq!(retrieved.ingredients[0].amount, recipe.ingredients[0].amount);
        assert_eq!(retrieved.ingredients[0].unit, recipe.ingredients[0].unit);
        assert_eq!(retrieved.ingredients[0].category, recipe.ingredients[0].category);

        assert_eq!(retrieved.instructions, recipe.instructions);
        assert_eq!(retrieved.tags, recipe.tags);
        assert_eq!(retrieved.collections, recipe.collections);

        // Verify nutritional info
        assert!(retrieved.nutritional_info.is_some());
        let nutrition = retrieved.nutritional_info.unwrap();
        let original_nutrition = recipe.nutritional_info.unwrap();
        assert_eq!(nutrition.calories, original_nutrition.calories);
        assert_eq!(nutrition.protein, original_nutrition.protein);
        assert_eq!(nutrition.carbs, original_nutrition.carbs);
    }

    // Tests for ingredient database operations
    fn create_test_ingredient_database() -> IngredientDatabase {
        IngredientDatabase {
            id: "test-ingredient-1".to_string(),
            name: "Test Ingredient".to_string(),
            category: "vegetables".to_string(),
            aliases: vec!["test-ing".to_string(), "testing-ingredient".to_string()],
            date_added: "2024-01-01T00:00:00Z".to_string(),
            date_modified: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    #[tokio::test]
    async fn test_save_and_get_ingredient() {
        let (db, _temp_dir) = create_test_database().await;
        let ingredient = create_test_ingredient_database();

        // Save the ingredient
        db.save_ingredient(&ingredient).await.unwrap();

        // Retrieve all ingredients
        let ingredients = db.get_all_ingredients().await.unwrap();
        assert_eq!(ingredients.len(), 1);
        assert_eq!(ingredients[0].id, ingredient.id);
        assert_eq!(ingredients[0].name, ingredient.name);
        assert_eq!(ingredients[0].category, ingredient.category);
        assert_eq!(ingredients[0].aliases, ingredient.aliases);
    }

    #[tokio::test]
    async fn test_ingredient_duplicate_prevention() {
        let (db, _temp_dir) = create_test_database().await;
        let ingredient = create_test_ingredient_database();

        // Save the ingredient twice
        db.save_ingredient(&ingredient).await.unwrap();
        db.save_ingredient(&ingredient).await.unwrap();

        // Should still only have one ingredient (INSERT OR REPLACE)
        let ingredients = db.get_all_ingredients().await.unwrap();
        assert_eq!(ingredients.len(), 1);
    }

    #[tokio::test]
    async fn test_search_ingredients() {
        let (db, _temp_dir) = create_test_database().await;

        // Create test ingredients
        let mut ingredient1 = create_test_ingredient_database();
        ingredient1.id = "ingredient-1".to_string();
        ingredient1.name = "Tomato".to_string();
        ingredient1.aliases = vec!["tomatoes".to_string()];

        let mut ingredient2 = create_test_ingredient_database();
        ingredient2.id = "ingredient-2".to_string();
        ingredient2.name = "Potato".to_string();
        ingredient2.aliases = vec!["potatoes".to_string()];

        let mut ingredient3 = create_test_ingredient_database();
        ingredient3.id = "ingredient-3".to_string();
        ingredient3.name = "Onion".to_string();
        ingredient3.aliases = vec!["onions".to_string(), "yellow onion".to_string()];

        // Save all ingredients
        db.save_ingredient(&ingredient1).await.unwrap();
        db.save_ingredient(&ingredient2).await.unwrap();
        db.save_ingredient(&ingredient3).await.unwrap();

        // Search by name
        let results = db.search_ingredients("tomato").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Tomato");

        // Search by alias
        let results = db.search_ingredients("potatoes").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Potato");

        // Partial search
        let results = db.search_ingredients("on").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Onion");

        // No results
        let results = db.search_ingredients("nonexistent").await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_delete_ingredient() {
        let (db, _temp_dir) = create_test_database().await;
        let ingredient = create_test_ingredient_database();

        // Save the ingredient
        db.save_ingredient(&ingredient).await.unwrap();

        // Verify it exists
        let ingredients = db.get_all_ingredients().await.unwrap();
        assert_eq!(ingredients.len(), 1);

        // Delete the ingredient
        let deleted = db.delete_ingredient(&ingredient.id).await.unwrap();
        assert!(deleted);

        // Verify it's gone
        let ingredients = db.get_all_ingredients().await.unwrap();
        assert_eq!(ingredients.len(), 0);

        // Try to delete again (should return false)
        let deleted = db.delete_ingredient(&ingredient.id).await.unwrap();
        assert!(!deleted);
    }

    #[tokio::test]
    async fn test_ingredient_auto_detection_from_recipe() {
        let (db, _temp_dir) = create_test_database().await;
        let recipe = create_test_recipe();

        // Save the recipe (this should trigger ingredient auto-detection)
        db.save_recipe(&recipe).await.unwrap();

        // Check if ingredients were auto-detected and saved
        let ingredients = db.get_all_ingredients().await.unwrap();

        // We expect ingredients to be auto-detected from the recipe
        // The test recipe has 2 ingredients: "Test Ingredient 1" and "Test Ingredient 2"
        assert!(ingredients.len() >= 2, "Expected at least 2 ingredients to be auto-detected, found {}", ingredients.len());

        // Check that ingredient names match what's in the recipe (after cleaning)
        let ingredient_names: Vec<String> = ingredients.iter().map(|i| i.name.clone()).collect();

        // The names might be cleaned, so check for the cleaned versions
        assert!(ingredient_names.iter().any(|name| name.to_lowercase().contains("test ingredient 1")));
        assert!(ingredient_names.iter().any(|name| name.to_lowercase().contains("test ingredient 2")));
    }

    #[tokio::test]
    async fn test_ingredient_category_detection() {
        let (db, _temp_dir) = create_test_database().await;

        // Create a recipe with ingredients that should have detectable categories
        let mut recipe = create_test_recipe();
        recipe.ingredients = vec![
            Ingredient {
                name: "Carrots".to_string(),
                amount: "2".to_string(),
                unit: "cups".to_string(),
                category: None,
                section: None,
            },
            Ingredient {
                name: "Chicken Breast".to_string(),
                amount: "1".to_string(),
                unit: "lb".to_string(),
                category: None,
                section: None,
            },
            Ingredient {
                name: "Olive Oil".to_string(),
                amount: "2".to_string(),
                unit: "tbsp".to_string(),
                category: None,
                section: None,
            },
        ];

        // Save the recipe
        db.save_recipe(&recipe).await.unwrap();

        // Check that ingredients were categorized correctly
        let ingredients = db.get_all_ingredients().await.unwrap();
        assert!(ingredients.len() >= 3);

        // Find specific ingredients and check their categories (case-insensitive)
        let carrot_ingredient = ingredients.iter().find(|i| i.name.to_lowercase().contains("carrot"));
        let chicken_ingredient = ingredients.iter().find(|i| i.name.to_lowercase().contains("chicken"));
        let oil_ingredient = ingredients.iter().find(|i| i.name.to_lowercase().contains("olive"));

        assert!(carrot_ingredient.is_some(), "Carrots ingredient should be auto-detected");
        assert!(chicken_ingredient.is_some(), "Chicken Breast ingredient should be auto-detected");
        assert!(oil_ingredient.is_some(), "Olive Oil ingredient should be auto-detected");

        // Categories should be detected
        if let Some(carrot) = carrot_ingredient {
            assert_eq!(carrot.category, "vegetables");
        }
        if let Some(chicken) = chicken_ingredient {
            assert_eq!(chicken.category, "meat");
        }
        if let Some(oil) = oil_ingredient {
            assert_eq!(oil.category, "oils");
        }
    }

    #[tokio::test]
    async fn test_repair_ingredient_catalog_canonicalizes_and_merges_rows() {
        let (db, _temp_dir) = create_test_database().await;

        let older_duplicate = IngredientDatabase {
            id: "ingredient-old-milk".to_string(),
            name: "0.33333334326744 cup 1% milk".to_string(),
            category: "dairy".to_string(),
            aliases: vec!["low fat milk".to_string()],
            date_added: "2024-01-01T00:00:00Z".to_string(),
            date_modified: "2024-01-01T00:00:00Z".to_string(),
        };
        let newer_duplicate = IngredientDatabase {
            id: "ingredient-new-milk".to_string(),
            name: "1% milk".to_string(),
            category: "dairy".to_string(),
            aliases: vec!["milk".to_string()],
            date_added: "2024-01-02T00:00:00Z".to_string(),
            date_modified: "2024-01-02T00:00:00Z".to_string(),
        };
        let size_fragment = IngredientDatabase {
            id: "ingredient-ginger".to_string(),
            name: "-inch knob ginger".to_string(),
            category: "herbs".to_string(),
            aliases: vec![],
            date_added: "2024-01-03T00:00:00Z".to_string(),
            date_modified: "2024-01-03T00:00:00Z".to_string(),
        };
        let note_row = IngredientDatabase {
            id: "ingredient-note".to_string(),
            name: "* Raw egg is not recommended for the elderly".to_string(),
            category: "other".to_string(),
            aliases: vec![],
            date_added: "2024-01-04T00:00:00Z".to_string(),
            date_modified: "2024-01-04T00:00:00Z".to_string(),
        };
        let valid = IngredientDatabase {
            id: "ingredient-onion".to_string(),
            name: "yellow onion".to_string(),
            category: "vegetables".to_string(),
            aliases: vec![],
            date_added: "2024-01-05T00:00:00Z".to_string(),
            date_modified: "2024-01-05T00:00:00Z".to_string(),
        };

        db.save_ingredient(&older_duplicate).await.unwrap();
        db.save_ingredient(&newer_duplicate).await.unwrap();
        db.save_ingredient(&size_fragment).await.unwrap();
        db.save_ingredient(&note_row).await.unwrap();
        db.save_ingredient(&valid).await.unwrap();

        db.create_product_ingredient_mapping("milk-sku", &older_duplicate.id)
            .await
            .unwrap();

        let result = db.repair_ingredient_catalog().await.unwrap();
        assert_eq!(result.scanned, 5);
        assert!(result.updated >= 2);
        assert!(result.merged >= 1);
        assert!(result.removed >= 2);

        let ingredients = db.get_all_ingredients().await.unwrap();
        let names: Vec<String> = ingredients.iter().map(|ingredient| ingredient.name.clone()).collect();

        assert!(names.contains(&"1% milk".to_string()));
        assert!(names.contains(&"ginger".to_string()));
        assert!(names.contains(&"yellow onion".to_string()));
        assert!(!names.contains(&"0.33333334326744 cup 1% milk".to_string()));
        assert!(!names.contains(&"-inch knob ginger".to_string()));
        assert!(!names.contains(&"* Raw egg is not recommended for the elderly".to_string()));

        let surviving_milk = ingredients.iter().find(|ingredient| ingredient.name == "1% milk").unwrap();
        assert_eq!(surviving_milk.id, older_duplicate.id);
        assert!(surviving_milk.aliases.contains(&"low fat milk".to_string()));
        assert!(surviving_milk.aliases.contains(&"milk".to_string()));

        let mapping = db.get_product_ingredient_mapping("milk-sku").await.unwrap().unwrap();
        assert_eq!(mapping.ingredient_id, older_duplicate.id);
        assert_eq!(mapping.ingredient_name, "1% milk");
    }

    // Additional comprehensive duplicate detection tests
    #[tokio::test]
    async fn test_duplicate_url_detection_comprehensive() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert first recipe
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.source_url = "https://allrecipes.com/recipe/123/cookies".to_string();
        db.save_recipe(&recipe1).await.unwrap();

        // Get existing URLs
        let existing_urls = db.get_existing_recipe_urls().await.unwrap();

        // Check if duplicate URL would be detected
        let duplicate_url = "https://allrecipes.com/recipe/123/cookies";
        let is_duplicate = existing_urls.contains(&duplicate_url.to_string());

        assert!(is_duplicate, "Expected duplicate URL to be detected");
        assert_eq!(existing_urls.len(), 1);
    }

    #[tokio::test]
    async fn test_url_variations_comprehensive() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert recipes with URL variations
        let url_variations = vec![
            ("recipe-1", "https://allrecipes.com/recipe/123/cookies"),
            ("recipe-2", "https://allrecipes.com/recipe/123/cookies/"),
            ("recipe-3", "http://allrecipes.com/recipe/123/cookies"),
            ("recipe-4", "https://www.allrecipes.com/recipe/123/cookies"),
        ];

        for (id, url) in &url_variations {
            let mut recipe = create_test_recipe();
            recipe.id = id.to_string();
            recipe.source_url = url.to_string();
            db.save_recipe(&recipe).await.unwrap();
        }

        let urls = db.get_existing_recipe_urls().await.unwrap();

        assert_eq!(urls.len(), 4, "Expected all URL variations to be stored");

        // All variations should be present
        for (_, url) in &url_variations {
            assert!(urls.contains(&url.to_string()),
                   "Expected URL variation {} to be present", url);
        }
    }

    #[tokio::test]
    async fn test_title_based_duplicate_detection() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert recipes with similar titles
        let recipes = vec![
            ("recipe-1", "Chocolate Chip Cookies", "https://example.com/1"),
            ("recipe-2", "Chocolate Chip Cookie Recipe", "https://example.com/2"),
            ("recipe-3", "Best Chocolate Chip Cookies", "https://example.com/3"),
            ("recipe-4", "Vanilla Cookies", "https://example.com/4"),
        ];

        for (id, title, url) in &recipes {
            let mut recipe = create_test_recipe();
            recipe.id = id.to_string();
            recipe.title = title.to_string();
            recipe.source_url = url.to_string();
            db.save_recipe(&recipe).await.unwrap();
        }
    }

    #[tokio::test]
    async fn test_unique_url_constraint() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert first recipe
        let mut recipe1 = create_test_recipe();
        recipe1.id = "recipe-1".to_string();
        recipe1.source_url = "https://allrecipes.com/recipe/123/cookies".to_string();
        db.save_recipe(&recipe1).await.unwrap();

        // Try to insert second recipe with same URL but different ID
        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.title = "Different Title".to_string();
        recipe2.source_url = "https://allrecipes.com/recipe/123/cookies".to_string(); // Same URL

        // This should work with INSERT OR REPLACE, but the unique constraint should prevent true duplicates
        db.save_recipe(&recipe2).await.unwrap();

        // Verify only one recipe exists with this URL
        let existing_urls = db.get_existing_recipe_urls().await.unwrap();
        let matching_urls: Vec<_> = existing_urls.iter()
            .filter(|url| *url == "https://allrecipes.com/recipe/123/cookies")
            .collect();

        assert_eq!(matching_urls.len(), 1, "Should only have one recipe with the same URL");
    }

    #[tokio::test]
    async fn test_recipe_exists_by_url() {
        let (db, _temp_dir) = create_test_database().await;

        let test_url = "https://allrecipes.com/recipe/123/test-recipe";

        // Initially should not exist
        let exists_before = db.recipe_exists_by_url(test_url).await.unwrap();
        assert!(!exists_before, "Recipe should not exist initially");

        // Insert recipe
        let mut recipe = create_test_recipe();
        recipe.source_url = test_url.to_string();
        db.save_recipe(&recipe).await.unwrap();

        // Now should exist
        let exists_after = db.recipe_exists_by_url(test_url).await.unwrap();
        assert!(exists_after, "Recipe should exist after insertion");
    }

    #[tokio::test]
    async fn test_get_recipe_by_url() {
        let (db, _temp_dir) = create_test_database().await;

        let test_url = "https://allrecipes.com/recipe/456/another-recipe";
        let test_title = "Test Recipe Title";

        // Initially should return None
        let recipe_before = db.get_recipe_by_url(test_url).await.unwrap();
        assert!(recipe_before.is_none(), "Should return None for non-existent URL");

        // Insert recipe
        let mut recipe = create_test_recipe();
        recipe.source_url = test_url.to_string();
        recipe.title = test_title.to_string();
        db.save_recipe(&recipe).await.unwrap();

        // Now should return the recipe
        let recipe_after = db.get_recipe_by_url(test_url).await.unwrap();
        assert!(recipe_after.is_some(), "Should return recipe for existing URL");

        let found_recipe = recipe_after.unwrap();
        assert_eq!(found_recipe.source_url, test_url);
        assert_eq!(found_recipe.title, test_title);
    }

    #[tokio::test]
    async fn test_case_insensitive_duplicate_search() {
        let (db, _temp_dir) = create_test_database().await;

        let mut recipe = create_test_recipe();
        recipe.title = "Chocolate Chip Cookies".to_string();
        recipe.source_url = "https://example.com/cookies".to_string();
        db.save_recipe(&recipe).await.unwrap();

        // Search with different cases
        let search_queries = vec![
            "chocolate chip cookies",
            "CHOCOLATE CHIP COOKIES",
            "Chocolate Chip Cookies",
            "ChOcOlAtE cHiP cOoKiEs",
        ];

        for query in search_queries {
            let results = db.search_recipes(query).await.unwrap();
            assert_eq!(results.len(), 1, "Expected 1 result for query: {}", query);
            assert_eq!(results[0].title, "Chocolate Chip Cookies");
        }
    }

    #[tokio::test]
    async fn test_malformed_urls_handling() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert recipes with various URL formats
        let test_urls = vec![
            ("recipe-1", "https://valid-url.com/recipe/123"),
            ("recipe-2", "not-a-valid-url"),
            ("recipe-3", "ftp://weird-protocol.com/recipe"),
            ("recipe-4", "//protocol-relative-url.com/recipe"),
            ("recipe-5", "mailto:test@example.com"),
        ];

        for (id, url) in &test_urls {
            let mut recipe = create_test_recipe();
            recipe.id = id.to_string();
            recipe.source_url = url.to_string();
            // Should not fail even with malformed URLs
            db.save_recipe(&recipe).await.unwrap();
        }

        let urls = db.get_existing_recipe_urls().await.unwrap();

        // All URLs should be stored as-is (validation happens at application level)
        assert_eq!(urls.len(), 5, "Expected all URLs to be stored");
        for (_, test_url) in &test_urls {
            assert!(urls.contains(&test_url.to_string()),
                   "Expected URL {} to be present", test_url);
        }
    }

    #[tokio::test]
    async fn test_empty_url_exclusion() {
        let (db, _temp_dir) = create_test_database().await;

        // Insert recipes with and without URLs
        let mut recipe_with_url = create_test_recipe();
        recipe_with_url.id = "recipe-1".to_string();
        recipe_with_url.source_url = "https://example.com/recipe/123".to_string();

        let mut recipe_without_url = create_test_recipe();
        recipe_without_url.id = "recipe-2".to_string();
        recipe_without_url.source_url = "".to_string();

        db.save_recipe(&recipe_with_url).await.unwrap();
        db.save_recipe(&recipe_without_url).await.unwrap();

        let urls = db.get_existing_recipe_urls().await.unwrap();

        assert_eq!(urls.len(), 1, "Expected only 1 URL (empty URLs should be excluded)");
        assert_eq!(urls[0], "https://example.com/recipe/123");
    }
}
