#[cfg(test)]
mod tests {
    use crate::recipe_import::*;
    use serde_json::json;
    use scraper::Html;
    use url::Url;

    #[test]
    fn test_is_supported_url() {
        // Test supported URLs
        let supported_urls = vec![
            "https://www.allrecipes.com/recipe/123/test",
            "https://www.foodnetwork.com/recipes/test",
            "https://www.bbcgoodfood.com/recipes/test",
            "https://www.seriouseats.com/test-recipe",
            "https://www.epicurious.com/recipes/test",
            "https://www.food.com/recipe/test",
            "https://www.tasteofhome.com/recipes/test",
            "https://www.delish.com/cooking/recipe-ideas/test",
            "https://www.bonappetit.com/recipe/test",
            "https://www.simplyrecipes.com/recipes/test",
            "https://www.americastestkitchen.com/recipes/12345-perfect-cookies",
            "https://www.americastestkitchen.com/recipes/all",
        ];

        for url_str in supported_urls {
            let url = Url::parse(url_str).unwrap();
            assert!(is_supported_url(&url), "URL should be supported: {}", url_str);
        }

        // Test unsupported URLs
        let unsupported_urls = vec![
            "https://www.google.com",
            "https://www.example.com/recipe",
            "https://www.youtube.com/watch?v=123",
            "https://www.reddit.com/r/recipes",
            "https://allrecipes.com.evil.test/recipe/123/test",
            "https://evil-allrecipes.com/recipe/123/test",
            "https://seriouseats.com.attacker.net/test-recipe",
        ];

        for url_str in unsupported_urls {
            let url = Url::parse(url_str).unwrap();
            assert!(!is_supported_url(&url), "URL should not be supported: {}", url_str);
        }
    }

    #[test]
    fn test_extract_image_from_json() {
        // Test string image
        let json_data = json!({
            "image": "https://example.com/image.jpg"
        });
        assert_eq!(extract_image_from_json(&json_data), "https://example.com/image.jpg");

        // Test object image with url
        let json_data = json!({
            "image": {
                "url": "https://example.com/image.jpg",
                "width": 800,
                "height": 600
            }
        });
        assert_eq!(extract_image_from_json(&json_data), "https://example.com/image.jpg");

        // Test array image
        let json_data = json!({
            "image": [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg"
            ]
        });
        assert_eq!(extract_image_from_json(&json_data), "https://example.com/image1.jpg");

        // Test array with objects
        let json_data = json!({
            "image": [
                {
                    "url": "https://example.com/image1.jpg"
                },
                {
                    "url": "https://example.com/image2.jpg"
                }
            ]
        });
        assert_eq!(extract_image_from_json(&json_data), "https://example.com/image1.jpg");

        // Test missing image
        let json_data = json!({
            "name": "Test Recipe"
        });
        assert_eq!(extract_image_from_json(&json_data), "");
    }

    #[test]
    fn test_extract_servings_from_json() {
        // Test number servings
        let json_data = json!({
            "recipeYield": 4
        });
        assert_eq!(extract_servings_from_json(&json_data), 4);

        // Test string servings
        let json_data = json!({
            "recipeYield": "6"
        });
        assert_eq!(extract_servings_from_json(&json_data), 6);

        // Test array servings
        let json_data = json!({
            "recipeYield": [4, 6]
        });
        assert_eq!(extract_servings_from_json(&json_data), 4);

        // Test yield field
        let json_data = json!({
            "yield": 8
        });
        assert_eq!(extract_servings_from_json(&json_data), 8);

        // Test invalid servings
        let json_data = json!({
            "recipeYield": "invalid"
        });
        assert_eq!(extract_servings_from_json(&json_data), 0);

        // Test missing servings
        let json_data = json!({
            "name": "Test Recipe"
        });
        assert_eq!(extract_servings_from_json(&json_data), 0);
    }

    #[test]
    fn test_extract_ingredients_from_json() {
        // Test normal ingredients
        let json_data = json!({
            "recipeIngredient": [
                "2 cups flour",
                "1 cup sugar",
                "3 eggs"
            ]
        });
        let expected = vec!["2 cups flour", "1 cup sugar", "3 eggs"];
        assert_eq!(extract_ingredients_from_json(&json_data), expected);

        // Test empty ingredients
        let json_data = json!({
            "recipeIngredient": []
        });
        assert_eq!(extract_ingredients_from_json(&json_data), Vec::<String>::new());

        // Test missing ingredients
        let json_data = json!({
            "name": "Test Recipe"
        });
        assert_eq!(extract_ingredients_from_json(&json_data), Vec::<String>::new());
    }

    #[test]
    fn test_extract_instructions_from_json() {
        // Test string instructions
        let json_data = json!({
            "recipeInstructions": [
                "Mix flour and sugar",
                "Add eggs",
                "Bake for 30 minutes"
            ]
        });
        let expected = vec!["Mix flour and sugar", "Add eggs", "Bake for 30 minutes"];
        assert_eq!(extract_instructions_from_json(&json_data), expected);

        // Test object instructions with text
        let json_data = json!({
            "recipeInstructions": [
                {
                    "@type": "HowToStep",
                    "text": "Mix flour and sugar"
                },
                {
                    "@type": "HowToStep",
                    "text": "Add eggs"
                }
            ]
        });
        let expected = vec!["Mix flour and sugar", "Add eggs"];
        assert_eq!(extract_instructions_from_json(&json_data), expected);

        // Test missing instructions
        let json_data = json!({
            "name": "Test Recipe"
        });
        assert_eq!(extract_instructions_from_json(&json_data), Vec::<String>::new());
    }

    #[test]
    fn test_extract_keywords_from_json() {
        // Test recipeCategory array
        let json_data = json!({
            "recipeCategory": ["Dessert", "Cake"]
        });
        assert_eq!(extract_keywords_from_json(&json_data), "Dessert, Cake");

        // Test recipeCategory string
        let json_data = json!({
            "recipeCategory": "Dessert"
        });
        assert_eq!(extract_keywords_from_json(&json_data), "Dessert");

        // Test recipeCuisine
        let json_data = json!({
            "recipeCuisine": ["Italian", "Mediterranean"]
        });
        assert_eq!(extract_keywords_from_json(&json_data), "Italian, Mediterranean");

        // Test both category and cuisine
        let json_data = json!({
            "recipeCategory": "Dessert",
            "recipeCuisine": "Italian"
        });
        assert_eq!(extract_keywords_from_json(&json_data), "Dessert, Italian");

        // Test missing keywords
        let json_data = json!({
            "name": "Test Recipe"
        });
        assert_eq!(extract_keywords_from_json(&json_data), "");
    }

    #[test]
    fn test_get_site_selectors() {
        // Test AllRecipes selectors
        let (title, desc, image) = get_site_selectors("www.allrecipes.com");
        assert!(title.contains("h1.headline"));
        assert!(desc.contains("meta[name='description']"));
        assert!(image.contains("meta[property='og:image']"));

        // Test Food Network selectors
        let (title, desc, image) = get_site_selectors("www.foodnetwork.com");
        assert!(title.contains("h1.o-AssetTitle__a-HeadlineText"));
        assert!(desc.contains("meta[name='description']"));
        assert!(image.contains("meta[property='og:image']"));

        // Test America's Test Kitchen selectors
        let (title, desc, image) = get_site_selectors("www.americastestkitchen.com");
        assert!(title.contains("h1"));
        assert!(desc.contains("meta[name='description']") || desc.contains("og:description"));
        assert!(image.contains("meta[property='og:image']"));

        // Test generic fallback selectors
        let (title, desc, image) = get_site_selectors("unknown-site.com");
        assert!(title.contains("h1"));
        assert!(desc.contains("meta[name='description']"));
        assert!(image.contains("meta[property='og:image']"));
    }

    #[test]
    fn test_parse_json_ld_recipe() {
        let recipe_json = json!({
            "@type": "Recipe",
            "name": "Chocolate Chip Cookies",
            "description": "Delicious homemade cookies",
            "image": "https://example.com/cookies.jpg",
            "prepTime": "PT15M",
            "cookTime": "PT12M",
            "totalTime": "PT27M",
            "recipeYield": 24,
            "recipeIngredient": [
                "2 cups flour",
                "1 cup sugar",
                "2 eggs"
            ],
            "recipeInstructions": [
                "Mix ingredients",
                "Bake for 12 minutes"
            ],
            "recipeCategory": "Dessert"
        });

        let result = parse_json_ld_recipe(&recipe_json, "https://example.com/recipe").unwrap();
        
        assert_eq!(result.name, "Chocolate Chip Cookies");
        assert_eq!(result.description, "Delicious homemade cookies");
        assert_eq!(result.image, "https://example.com/cookies.jpg");
        assert_eq!(result.prep_time, "PT15M");
        assert_eq!(result.cook_time, "PT12M");
        assert_eq!(result.total_time, "PT27M");
        assert_eq!(result.servings, 24);
        assert_eq!(result.ingredients, vec!["2 cups flour", "1 cup sugar", "2 eggs"]);
        assert_eq!(result.instructions, vec!["Mix ingredients", "Bake for 12 minutes"]);
        assert_eq!(result.keywords, "Dessert");
        assert_eq!(result.source_url, "https://example.com/recipe");
    }

    #[test]
    fn test_parse_json_ld_recipe_decodes_html_entities_in_text_fields() {
        let recipe_json = json!({
            "@type": "Recipe",
            "name": "Mom&amp;#39;s Cookies",
            "description": "This doesn&amp;#39;t taste bland &amp;amp; stays chewy",
            "image": "https://example.com/cookies.jpg",
            "recipeIngredient": [
                "2 cups flour"
            ],
            "recipeInstructions": [
                "Don&amp;#39;t overmix",
                "Bake until it&amp;#39;s golden"
            ],
            "recipeCategory": "Dessert &amp;amp; Snack"
        });

        let result = parse_json_ld_recipe(&recipe_json, "https://example.com/recipe").unwrap();

        assert_eq!(result.name, "Mom's Cookies");
        assert_eq!(result.description, "This doesn't taste bland & stays chewy");
        assert_eq!(result.instructions, vec!["Don't overmix", "Bake until it's golden"]);
        assert_eq!(result.keywords, "Dessert & Snack");
    }

    #[test]
    fn test_extract_from_json_ld() {
        let html_content = r#"
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@type": "Recipe",
                "name": "Test Recipe",
                "description": "A test recipe",
                "recipeIngredient": ["ingredient 1", "ingredient 2"]
            }
            </script>
        </head>
        <body></body>
        </html>
        "#;

        let document = Html::parse_document(html_content);
        let result = extract_from_json_ld(&document, "https://example.com").unwrap();
        
        assert_eq!(result.name, "Test Recipe");
        assert_eq!(result.description, "A test recipe");
        assert_eq!(result.ingredients, vec!["ingredient 1", "ingredient 2"]);
    }

    #[test]
    fn test_extract_from_json_ld_array() {
        let html_content = r#"
        <html>
        <head>
            <script type="application/ld+json">
            [
                {
                    "@type": "WebPage",
                    "name": "Page"
                },
                {
                    "@type": "Recipe",
                    "name": "Test Recipe",
                    "description": "A test recipe"
                }
            ]
            </script>
        </head>
        <body></body>
        </html>
        "#;

        let document = Html::parse_document(html_content);
        let result = extract_from_json_ld(&document, "https://example.com").unwrap();
        
        assert_eq!(result.name, "Test Recipe");
        assert_eq!(result.description, "A test recipe");
    }

    #[test]
    fn test_extract_from_html_selectors_decodes_html_entities() {
        let html_content = r#"
        <html>
        <head>
            <title>Mom&amp;#39;s Cookies</title>
            <meta name="description" content="This doesn&amp;#39;t taste bland &amp;amp; stays chewy">
        </head>
        <body>
            <ul class="instructions">
                <li>Don&amp;#39;t overmix</li>
                <li>Bake until it&amp;#39;s golden</li>
            </ul>
            <ul class="ingredients">
                <li>2 cups flour</li>
            </ul>
        </body>
        </html>
        "#;

        let document = Html::parse_document(html_content);
        let result = extract_from_html_selectors(&document, "https://example.com/recipe").unwrap();

        assert_eq!(result.name, "Mom's Cookies");
        assert_eq!(result.description, "This doesn't taste bland & stays chewy");
        assert_eq!(result.instructions, vec!["Don't overmix", "Bake until it's golden"]);
    }

    #[test]
    fn test_extract_from_json_ld_no_recipe() {
        let html_content = r#"
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@type": "WebPage",
                "name": "Not a recipe"
            }
            </script>
        </head>
        <body></body>
        </html>
        "#;

        let document = Html::parse_document(html_content);
        let result = extract_from_json_ld(&document, "https://example.com");
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().error_type, "ParseError");
    }
}
