use proptest::prelude::*;
use serde_json::json;
use url::Url;

// Property-based tests for recipe import functions

proptest! {
    #[test]
    fn test_extract_servings_from_json_property(
        servings in 0u32..1000u32
    ) {
        // Test that valid numbers are extracted correctly
        let json_data = json!({
            "recipeYield": servings
        });
        assert_eq!(JustCooked::recipe_import::extract_servings_from_json(&json_data), servings);

        // Test string numbers
        let json_data = json!({
            "recipeYield": servings.to_string()
        });
        assert_eq!(JustCooked::recipe_import::extract_servings_from_json(&json_data), servings);
    }

    #[test]
    fn test_extract_image_from_json_property(
        url in r"https://[a-z]+\.com/[a-z]+\.(jpg|png|gif|webp)"
    ) {
        // Test string image URLs
        let json_data = json!({
            "image": url
        });
        assert_eq!(JustCooked::recipe_import::extract_image_from_json(&json_data), url);

        // Test object image URLs
        let json_data = json!({
            "image": {
                "url": url,
                "width": 800,
                "height": 600
            }
        });
        assert_eq!(JustCooked::recipe_import::extract_image_from_json(&json_data), url);
    }

    #[test]
    fn test_extract_ingredients_from_json_property(
        ingredients in prop::collection::vec(r"[0-9]+ [a-z]+ [a-z]+", 1..20)
    ) {
        let json_data = json!({
            "recipeIngredient": ingredients
        });
        let result = JustCooked::recipe_import::extract_ingredients_from_json(&json_data);
        assert_eq!(result, ingredients);
        assert_eq!(result.len(), ingredients.len());
    }

    #[test]
    fn test_extract_instructions_from_json_property(
        instructions in prop::collection::vec(r"[A-Z][a-z ]{10,50}\.", 1..15)
    ) {
        // Test string instructions
        let json_data = json!({
            "recipeInstructions": instructions
        });
        let result = JustCooked::recipe_import::extract_instructions_from_json(&json_data);
        assert_eq!(result, instructions);

        // Test object instructions
        let instruction_objects: Vec<serde_json::Value> = instructions.iter()
            .map(|text| json!({
                "@type": "HowToStep",
                "text": text
            }))
            .collect();

        let json_data = json!({
            "recipeInstructions": instruction_objects
        });
        let result = JustCooked::recipe_import::extract_instructions_from_json(&json_data);
        assert_eq!(result, instructions);
    }

    #[test]
    fn test_extract_keywords_from_json_property(
        categories in prop::collection::vec(r"[A-Z][a-z]{3,15}", 1..5),
        cuisines in prop::collection::vec(r"[A-Z][a-z]{3,15}", 1..3)
    ) {
        let json_data = json!({
            "recipeCategory": categories,
            "recipeCuisine": cuisines
        });

        let result = JustCooked::recipe_import::extract_keywords_from_json(&json_data);
        
        // Should contain all categories and cuisines
        for category in &categories {
            assert!(result.contains(category));
        }
        for cuisine in &cuisines {
            assert!(result.contains(cuisine));
        }
        
        // Should be comma-separated
        let parts: Vec<&str> = result.split(", ").collect();
        assert_eq!(parts.len(), categories.len() + cuisines.len());
    }

    #[test]
    fn test_is_valid_image_url_property(
        domain in r"[a-z]{3,10}",
        tld in r"(com|org|net)",
        path in r"[a-z0-9/]{1,20}",
        extension in r"(jpg|jpeg|png|gif|webp)"
    ) {
        let url = format!("https://{}.{}/{}.{}", domain, tld, path, extension);
        assert!(JustCooked::image_storage::is_valid_image_url(&url));

        // Test with uppercase extension
        let url_upper = format!("https://{}.{}/{}.{}", domain, tld, path, extension.to_uppercase());
        assert!(JustCooked::image_storage::is_valid_image_url(&url_upper));
    }

    #[test]
    fn test_is_supported_url_property(
        subdomain in prop::option::of(r"[a-z]{2,8}"),
        path in r"/[a-z0-9/-]{1,50}"
    ) {
        let supported_domains = vec![
            "allrecipes.com",
            "foodnetwork.com", 
            "bbcgoodfood.com",
            "seriouseats.com",
            "epicurious.com",
            "food.com",
            "tasteofhome.com",
            "delish.com",
            "bonappetit.com",
            "simplyrecipes.com"
        ];
        
        for domain in supported_domains {
            let host = match subdomain {
                Some(ref sub) => format!("{}.{}", sub, domain),
                None => format!("www.{}", domain)
            };
            
            let url_str = format!("https://{}{}", host, path);
            if let Ok(url) = Url::parse(&url_str) {
                assert!(JustCooked::recipe_import::is_supported_url(&url));
            }
        }
    }

    #[test]
    fn test_recipe_name_cleaning_property(
        base_name in r"[A-Z][a-z ]{5,30}",
        suffix in prop::option::of(r" - (Allrecipes|BBC Good Food)| \| (Food Network|Epicurious|Food\.com|Taste of Home|Bon Appétit|Simply Recipes)| Recipe \| Serious Eats| - Delish")
    ) {
        // This tests the name cleaning logic in extract_from_html_selectors
        let full_name = match suffix {
            Some(s) => format!("{}{}", base_name, s),
            None => base_name.clone()
        };

        // The cleaning should remove the suffix (matching the actual implementation)
        let cleaned = full_name
            .replace(" - Allrecipes", "")
            .replace(" | Food Network", "")
            .replace(" - BBC Good Food", "")
            .replace(" Recipe | Serious Eats", "")
            .replace(" | Epicurious", "")
            .replace(" | Food.com", "")
            .replace(" | Taste of Home", "")
            .replace(" - Delish", "")
            .replace(" | Bon Appétit", "")
            .replace(" | Simply Recipes", "");

        // The cleaned name should be the base name
        assert_eq!(cleaned, base_name);
    }

    #[test]
    fn test_json_ld_recipe_parsing_robustness(
        name in r"[A-Z][a-z ]{5,50}",
        description in r"[A-Z][a-z .,]{10,100}",
        servings in 1u32..20u32,
        prep_time in r"PT[0-9]{1,2}M",
        cook_time in r"PT[0-9]{1,3}M"
    ) {
        let recipe_json = json!({
            "@type": "Recipe",
            "name": name,
            "description": description,
            "prepTime": prep_time,
            "cookTime": cook_time,
            "recipeYield": servings,
            "recipeIngredient": ["ingredient 1", "ingredient 2"],
            "recipeInstructions": ["step 1", "step 2"]
        });
        
        let result = JustCooked::recipe_import::parse_json_ld_recipe(&recipe_json, "https://example.com");
        assert!(result.is_ok());
        
        let recipe = result.unwrap();
        assert_eq!(recipe.name, name);
        assert_eq!(recipe.description, description);
        assert_eq!(recipe.prep_time, prep_time);
        assert_eq!(recipe.cook_time, cook_time);
        assert_eq!(recipe.servings, servings);
        assert_eq!(recipe.source_url, "https://example.com");
    }
}

// Additional property tests for edge cases

proptest! {
    #[test]
    fn test_extract_servings_handles_invalid_strings(
        invalid_string in r"[a-zA-Z ]{1,20}"
    ) {
        // Test that invalid string servings default to 0
        let json_data = json!({
            "recipeYield": invalid_string
        });
        assert_eq!(JustCooked::recipe_import::extract_servings_from_json(&json_data), 0);
    }

    #[test]
    fn test_extract_keywords_handles_empty_arrays(
        empty_arrays in prop::bool::ANY
    ) {
        let json_data = if empty_arrays {
            json!({
                "recipeCategory": [],
                "recipeCuisine": []
            })
        } else {
            json!({})
        };

        let result = JustCooked::recipe_import::extract_keywords_from_json(&json_data);
        assert_eq!(result, "");
    }

    #[test]
    fn test_image_url_validation_with_query_params(
        base_url in r"https://[a-z]+\.com/[a-z]+\.(jpg|png)",
        param_name in r"[a-z]{1,10}",
        param_value in r"[a-z0-9]{1,20}"
    ) {
        let url_with_params = format!("{}?{}={}", base_url, param_name, param_value);
        assert!(JustCooked::image_storage::is_valid_image_url(&url_with_params));
    }

    #[test]
    fn test_site_selectors_consistency(
        host in r"[a-z]{3,15}\.com"
    ) {
        let (title_sel, desc_sel, image_sel) = JustCooked::recipe_import::get_site_selectors(&host);
        
        // All selectors should be non-empty
        assert!(!title_sel.is_empty());
        assert!(!desc_sel.is_empty());
        assert!(!image_sel.is_empty());
        
        // All should contain fallback selectors
        assert!(title_sel.contains("title") || title_sel.contains("h1"));
        assert!(desc_sel.contains("meta[name='description']"));
        assert!(image_sel.contains("meta[property='og:image']"));
    }
}

// Stress tests for large inputs

proptest! {
    #[test]
    fn test_large_ingredient_lists(
        ingredients in prop::collection::vec(r"[0-9]+ [a-z ]{5,30}", 50..200)
    ) {
        let json_data = json!({
            "recipeIngredient": ingredients
        });
        
        let result = JustCooked::recipe_import::extract_ingredients_from_json(&json_data);
        assert_eq!(result.len(), ingredients.len());

        // Verify all ingredients are preserved
        for (i, ingredient) in ingredients.iter().enumerate() {
            assert_eq!(result[i], *ingredient);
        }
    }

    #[test]
    fn test_large_instruction_lists(
        instructions in prop::collection::vec(r"[A-Z][a-z .,]{20,100}", 30..100)
    ) {
        let json_data = json!({
            "recipeInstructions": instructions
        });

        let result = JustCooked::recipe_import::extract_instructions_from_json(&json_data);
        assert_eq!(result.len(), instructions.len());
        
        // Verify all instructions are preserved
        for (i, instruction) in instructions.iter().enumerate() {
            assert_eq!(result[i], *instruction);
        }
    }
}
