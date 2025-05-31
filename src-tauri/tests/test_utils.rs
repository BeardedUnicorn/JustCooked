use serde_json::json;
use std::path::PathBuf;
use tempfile::TempDir;
use tokio::fs;

/// Test utilities for creating sample recipe data and test fixtures

/// Creates a sample JSON-LD recipe for testing
pub fn create_sample_recipe_json() -> serde_json::Value {
    json!({
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Classic Chocolate Chip Cookies",
        "description": "Soft and chewy chocolate chip cookies that are perfect for any occasion",
        "image": "https://example.com/chocolate-chip-cookies.jpg",
        "prepTime": "PT15M",
        "cookTime": "PT12M", 
        "totalTime": "PT27M",
        "recipeYield": 24,
        "recipeIngredient": [
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
        "recipeInstructions": [
            {
                "@type": "HowToStep",
                "text": "Preheat oven to 375°F (190°C)"
            },
            {
                "@type": "HowToStep", 
                "text": "In a medium bowl, whisk together flour, baking soda, and salt"
            },
            {
                "@type": "HowToStep",
                "text": "In a large bowl, cream together butter and both sugars until light and fluffy"
            },
            {
                "@type": "HowToStep",
                "text": "Beat in eggs one at a time, then stir in vanilla"
            },
            {
                "@type": "HowToStep",
                "text": "Gradually blend in flour mixture"
            },
            {
                "@type": "HowToStep",
                "text": "Stir in chocolate chips"
            },
            {
                "@type": "HowToStep",
                "text": "Drop rounded tablespoons of dough onto ungreased cookie sheets"
            },
            {
                "@type": "HowToStep",
                "text": "Bake for 9-11 minutes or until golden brown"
            },
            {
                "@type": "HowToStep",
                "text": "Cool on baking sheet for 2 minutes before removing to wire rack"
            }
        ],
        "recipeCategory": ["Dessert", "Cookies"],
        "recipeCuisine": "American",
        "keywords": ["chocolate chip", "cookies", "baking", "dessert"],
        "nutrition": {
            "@type": "NutritionInformation",
            "calories": "150 calories",
            "fatContent": "7g",
            "carbohydrateContent": "22g",
            "proteinContent": "2g"
        },
        "author": {
            "@type": "Person",
            "name": "Test Chef"
        }
    })
}

/// Creates a sample HTML page with JSON-LD recipe data
pub fn create_sample_recipe_html(recipe_json: &serde_json::Value) -> String {
    format!(r#"
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Classic Chocolate Chip Cookies - AllRecipes</title>
        <meta name="description" content="Soft and chewy chocolate chip cookies that are perfect for any occasion">
        <meta property="og:title" content="Classic Chocolate Chip Cookies">
        <meta property="og:description" content="Soft and chewy chocolate chip cookies that are perfect for any occasion">
        <meta property="og:image" content="https://example.com/chocolate-chip-cookies.jpg">
        <script type="application/ld+json">
        {}
        </script>
    </head>
    <body>
        <header>
            <h1 class="headline">Classic Chocolate Chip Cookies</h1>
        </header>
        <main>
            <div class="recipe-summary">
                <p class="recipe-summary__description">Soft and chewy chocolate chip cookies that are perfect for any occasion</p>
                <img src="https://example.com/chocolate-chip-cookies.jpg" alt="Chocolate chip cookies" class="recipe-hero__image">
            </div>
            
            <div class="recipe-details">
                <div class="recipe-times">
                    <span class="prep-time">Prep: 15 min</span>
                    <span class="cook-time">Cook: 12 min</span>
                    <span class="total-time">Total: 27 min</span>
                </div>
                <div class="servings">Yield: 24 cookies</div>
            </div>
            
            <div class="recipe-ingredients">
                <h2>Ingredients</h2>
                <ul class="ingredients">
                    <li class="recipe-ingredient">2 1/4 cups all-purpose flour</li>
                    <li class="recipe-ingredient">1 teaspoon baking soda</li>
                    <li class="recipe-ingredient">1 teaspoon salt</li>
                    <li class="recipe-ingredient">1 cup butter, softened</li>
                    <li class="recipe-ingredient">3/4 cup granulated sugar</li>
                    <li class="recipe-ingredient">3/4 cup packed brown sugar</li>
                    <li class="recipe-ingredient">2 large eggs</li>
                    <li class="recipe-ingredient">2 teaspoons vanilla extract</li>
                    <li class="recipe-ingredient">2 cups chocolate chips</li>
                </ul>
            </div>
            
            <div class="recipe-instructions">
                <h2>Instructions</h2>
                <ol class="instructions">
                    <li class="recipe-instruction">Preheat oven to 375°F (190°C)</li>
                    <li class="recipe-instruction">In a medium bowl, whisk together flour, baking soda, and salt</li>
                    <li class="recipe-instruction">In a large bowl, cream together butter and both sugars until light and fluffy</li>
                    <li class="recipe-instruction">Beat in eggs one at a time, then stir in vanilla</li>
                    <li class="recipe-instruction">Gradually blend in flour mixture</li>
                    <li class="recipe-instruction">Stir in chocolate chips</li>
                    <li class="recipe-instruction">Drop rounded tablespoons of dough onto ungreased cookie sheets</li>
                    <li class="recipe-instruction">Bake for 9-11 minutes or until golden brown</li>
                    <li class="recipe-instruction">Cool on baking sheet for 2 minutes before removing to wire rack</li>
                </ol>
            </div>
        </main>
    </body>
    </html>
    "#, serde_json::to_string_pretty(recipe_json).unwrap())
}

/// Creates a minimal HTML page without JSON-LD for testing HTML fallback parsing
pub fn create_minimal_recipe_html() -> String {
    r#"
    <!DOCTYPE html>
    <html>
    <head>
        <title>Simple Recipe - Food Network</title>
        <meta name="description" content="A simple test recipe for unit testing">
        <meta property="og:image" content="https://example.com/simple-recipe.jpg">
    </head>
    <body>
        <h1 class="recipe-title">Simple Test Recipe</h1>
        <p class="recipe-description">A simple test recipe for unit testing</p>
        
        <div class="ingredients">
            <h2>Ingredients</h2>
            <ul class="ingredients-list">
                <li>1 cup test ingredient</li>
                <li>2 tablespoons another ingredient</li>
                <li>1/2 teaspoon seasoning</li>
            </ul>
        </div>
        
        <div class="instructions">
            <h2>Instructions</h2>
            <ol class="instructions-list">
                <li>First step of the recipe</li>
                <li>Second step of the recipe</li>
                <li>Final step of the recipe</li>
            </ol>
        </div>
    </body>
    </html>
    "#.to_string()
}

/// Creates a test image file with minimal JPEG data
pub async fn create_test_image_file(temp_dir: &TempDir, filename: &str) -> PathBuf {
    let image_path = temp_dir.path().join(filename);
    
    // Minimal JPEG file header
    let jpeg_data = vec![
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
    ];
    
    fs::write(&image_path, jpeg_data).await.unwrap();
    image_path
}

/// Creates test data for different image formats
pub fn create_test_image_data(format: &str) -> Vec<u8> {
    match format {
        "jpeg" | "jpg" => vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
        ],
        "png" => vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
            0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
            0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ],
        "gif" => vec![
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
            0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
            0x00, 0x02, 0x02, 0x0C, 0x0A, 0x00, 0x3B
        ],
        "webp" => vec![
            0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
            0x56, 0x50, 0x38, 0x20, 0x0E, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9D,
            0x01, 0x2A, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xA4, 0x00,
            0x03, 0x70, 0x00, 0xFE, 0xFB, 0xFD, 0x50, 0x00
        ],
        _ => vec![0x00, 0x01, 0x02, 0x03] // Generic test data
    }
}

/// Creates sample error scenarios for testing
pub fn create_error_test_cases() -> Vec<(&'static str, &'static str)> {
    vec![
        ("invalid_json", r#"{"@type": "Recipe", "name": "Test", invalid}"#),
        ("missing_type", r#"{"name": "Test Recipe"}"#),
        ("wrong_type", r#"{"@type": "Article", "name": "Not a recipe"}"#),
        ("empty_json", "{}"),
        ("malformed_html", "<html><body>Broken HTML"),
        ("no_recipe_data", "<html><head><title>No Recipe</title></head><body></body></html>"),
    ]
}

/// Validates that a recipe has all required fields
pub fn validate_recipe_completeness(recipe: &JustCooked::recipe_import::ImportedRecipe) -> bool {
    !recipe.name.is_empty() &&
    !recipe.source_url.is_empty() &&
    recipe.ingredients.len() > 0 &&
    recipe.instructions.len() > 0
}

/// Creates a variety of test URLs for validation testing
pub fn create_test_urls() -> Vec<(&'static str, bool)> {
    vec![
        // Supported URLs (should return true)
        ("https://www.allrecipes.com/recipe/123/test", true),
        ("https://allrecipes.com/recipe/456/another-test", true),
        ("https://www.foodnetwork.com/recipes/test-recipe", true),
        ("https://foodnetwork.com/recipes/test", true),
        ("https://www.bbcgoodfood.com/recipes/test", true),
        ("https://www.seriouseats.com/test-recipe", true),
        ("https://www.epicurious.com/recipes/test", true),
        ("https://www.food.com/recipe/test", true),
        ("https://www.tasteofhome.com/recipes/test", true),
        ("https://www.delish.com/cooking/recipe-ideas/test", true),
        ("https://www.bonappetit.com/recipe/test", true),
        ("https://www.simplyrecipes.com/recipes/test", true),
        
        // Unsupported URLs (should return false)
        ("https://www.google.com", false),
        ("https://www.example.com/recipe", false),
        ("https://www.youtube.com/watch?v=123", false),
        ("https://www.reddit.com/r/recipes", false),
        ("https://www.pinterest.com/pin/123", false),
        ("https://www.instagram.com/p/123", false),
    ]
}

/// Creates test cases for image URL validation
pub fn create_image_url_test_cases() -> Vec<(&'static str, bool)> {
    vec![
        // Valid image URLs
        ("https://example.com/image.jpg", true),
        ("https://example.com/image.jpeg", true),
        ("https://example.com/image.png", true),
        ("https://example.com/image.webp", true),
        ("https://example.com/image.gif", true),
        ("https://example.com/path/to/image.JPG", true),
        ("https://cdn.example.com/images/photo.png", true),
        ("https://images.unsplash.com/photo-123", true), // Dynamic URL
        ("https://example.com/api/image/456", true), // API endpoint
        
        // Invalid URLs
        ("not-a-url", false),
        ("", false),
        ("ftp://example.com/image.jpg", false),
        ("file:///local/image.jpg", false),
    ]
}
