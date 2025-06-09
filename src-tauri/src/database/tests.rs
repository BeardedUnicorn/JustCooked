#[cfg(test)]
mod tests {
    use crate::database::{Database, Recipe, Ingredient, NutritionalInfo};
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
                },
                Ingredient {
                    name: "Test Ingredient 2".to_string(),
                    amount: "2".to_string(),
                    unit: "tbsp".to_string(),
                    category: None,
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
            is_favorite: Some(true),
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

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.title = "Vanilla Cookies".to_string();
        recipe2.description = "Sweet vanilla cookies".to_string();

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
        recipe3.title = "Strawberry Pie".to_string();
        recipe3.description = "Fresh strawberry pie with chocolate drizzle".to_string();

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
        recipe1.tags = vec!["dessert".to_string(), "chocolate".to_string()];

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.tags = vec!["dessert".to_string(), "vanilla".to_string()];

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
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
        recipe1.is_favorite = Some(true);

        let mut recipe2 = create_test_recipe();
        recipe2.id = "recipe-2".to_string();
        recipe2.is_favorite = Some(false);

        let mut recipe3 = create_test_recipe();
        recipe3.id = "recipe-3".to_string();
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
}
