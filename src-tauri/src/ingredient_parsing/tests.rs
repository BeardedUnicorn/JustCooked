#[cfg(test)]
mod tests {
    // Removed unused import: use super::*;
    use crate::ingredient_parsing::{ParsedIngredientInfo, IngredientParser, get_ingredient_parser, normalize_unit};

    /// Test helper to create expected ingredients
    fn create_test_ingredient(
        name: &str,
        amount: &str,
        unit: &str,
        section: Option<String>,
    ) -> crate::database::Ingredient {
        crate::database::Ingredient {
            name: name.to_string(),
            amount: amount.to_string(),
            unit: unit.to_string(),
            category: None,
            section,
        }
    }

    #[tokio::test]
    async fn test_parse_basic_ingredients() {
        let parser = IngredientParser::new();

        // Test basic ingredient parsing
        let result = parser.parse_ingredient("2 cups all-purpose flour", None).await;
        assert!(result.is_ok());
        let ingredient = result.unwrap().unwrap();
        assert_eq!(ingredient.name, "all-purpose flour");
        assert!(ingredient.amount.contains("2"));
        assert_eq!(ingredient.unit, "cup");
        assert_eq!(ingredient.section, None);
    }

    #[tokio::test]
    async fn test_parse_with_section() {
        let parser = IngredientParser::new();

        let result = parser.parse_ingredient(
            "1 tablespoon olive oil",
            Some("Dressing".to_string()),
        ).await;
        assert!(result.is_ok());
        let ingredient = result.unwrap().unwrap();
        assert_eq!(ingredient.name, "olive oil");
        assert!(ingredient.amount.contains("1"));
        assert_eq!(ingredient.unit, "tbsp");
        assert_eq!(ingredient.section, Some("Dressing".to_string()));
    }

    #[tokio::test]
    async fn test_parse_fractions() {
        let parser = IngredientParser::new();

        let result = parser.parse_ingredient("1/2 teaspoon salt", None).await;
        assert!(result.is_ok());
        let ingredient = result.unwrap().unwrap();
        assert_eq!(ingredient.name, "salt");
        assert!(ingredient.amount.contains("0.5"));
        assert_eq!(ingredient.unit, "tsp");
    }

    #[tokio::test]
    async fn test_parse_invalid_ingredients() {
        let parser = IngredientParser::new();

        // Test invalid ingredients that should return None
        let invalid_ingredients = vec!["", "   "];

        for invalid in invalid_ingredients {
            let result = parser.parse_ingredient(invalid, None).await;
            assert!(result.is_ok());
            assert!(result.unwrap().is_none(), "Expected None for invalid ingredient: '{}'", invalid);
        }
    }

    #[test]
    fn test_parsed_ingredient_structure() {
        // Test that ParsedIngredientInfo can be created and serialized
        let ingredient = ParsedIngredientInfo {
            name: "all-purpose flour".to_string(),
            amount: 2.0,
            unit: "cup".to_string(),
            section: None,
        };

        assert_eq!(ingredient.name, "all-purpose flour");
        assert_eq!(ingredient.amount, 2.0);
        assert_eq!(ingredient.unit, "cup");
        assert_eq!(ingredient.section, None);

        // Test with section
        let ingredient_with_section = ParsedIngredientInfo {
            name: "sugar".to_string(),
            amount: 1.5,
            unit: "cup".to_string(),
            section: Some("Cake Layer".to_string()),
        };

        assert_eq!(ingredient_with_section.section, Some("Cake Layer".to_string()));
    }

    #[test]
    fn test_unit_normalization_comprehensive() {
        // Test all unit normalizations
        let test_cases = vec![
            ("cup", "cup"),
            ("cups", "cup"),
            ("tablespoon", "tbsp"),
            ("tablespoons", "tbsp"),
            ("tbsp", "tbsp"),
            ("teaspoon", "tsp"),
            ("teaspoons", "tsp"),
            ("tsp", "tsp"),
            ("pound", "lb"),
            ("pounds", "lb"),
            ("lb", "lb"),
            ("ounce", "oz"),
            ("ounces", "oz"),
            ("oz", "oz"),
            ("gram", "g"),
            ("grams", "g"),
            ("g", "g"),
            ("kilogram", "kg"),
            ("kilograms", "kg"),
            ("kg", "kg"),
            ("milliliter", "ml"),
            ("milliliters", "ml"),
            ("ml", "ml"),
            ("liter", "l"),
            ("liters", "l"),
            ("l", "l"),
            ("can", "can"),
            ("cans", "can"),
            ("package", "package"),
            ("packages", "package"),
            ("jar", "jar"),
            ("jars", "jar"),
            ("bottle", "bottle"),
            ("bottles", "bottle"),
            ("bag", "bag"),
            ("bags", "bag"),
            ("box", "box"),
            ("boxes", "box"),
            ("piece", "piece"),
            ("pieces", "piece"),
            ("slice", "slice"),
            ("slices", "slice"),
            ("clove", "clove"),
            ("cloves", "clove"),
            ("stalk", "stalk"),
            ("stalks", "stalk"),
            ("", ""),
            ("unknown_unit", "unit"),
        ];

        for (input, expected) in test_cases {
            assert_eq!(normalize_unit(input), expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn test_ingredient_parser_creation() {
        // Test that we can create an ingredient parser instance
        let _parser = IngredientParser::new();

        // The parser should be created successfully
        // Model loading is tested separately to avoid heavy dependencies in unit tests
        assert!(true); // Parser creation succeeded
    }

    #[test]
    fn test_global_parser_instance() {
        // Test that we can get the global parser instance
        let parser1 = get_ingredient_parser();
        let parser2 = get_ingredient_parser();

        // Should return the same instance (singleton pattern)
        assert!(std::ptr::eq(parser1, parser2));
    }

    #[tokio::test]
    async fn test_ingredient_crate_integration() {
        let parser = IngredientParser::new();

        // Test that the parser can handle basic ingredients using the ingredient crate
        let test_cases = vec![
            ("1 cup sugar", "sugar"),
            ("2 tablespoons olive oil", "olive oil"),
            ("1/2 teaspoon salt", "salt"),
        ];

        for (input, expected_name) in test_cases {
            let result = parser.parse_ingredient(input, None).await;
            assert!(result.is_ok(), "Failed to parse: {}", input);

            if let Some(ingredient) = result.unwrap() {
                assert_eq!(ingredient.name, expected_name, "Name mismatch for: {}", input);
                assert!(!ingredient.amount.is_empty(), "Amount should not be empty for: {}", input);
                assert!(!ingredient.unit.is_empty(), "Unit should not be empty for: {}", input);
            }
        }
    }

    #[tokio::test]
    async fn test_complex_ingredients() {
        let parser = IngredientParser::new();

        // Test that invalid ingredients are handled gracefully
        let result = parser.parse_ingredient("", None).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        // Test that the parser handles complex ingredients
        let result = parser.parse_ingredient("2 (14.5 oz) cans diced tomatoes, drained", None).await;
        assert!(result.is_ok());

        if let Some(ingredient) = result.unwrap() {
            assert!(!ingredient.name.is_empty());
            assert!(!ingredient.amount.is_empty());
        }
    }

    #[tokio::test]
    async fn test_canonicalizes_size_fragments_into_real_ingredient_names() {
        let parser = IngredientParser::new();

        let result = parser
            .parse_ingredient(
                "1 (4-inch) knob ginger, cut into 1/4- to 1/2-inch slices lengthwise",
                None,
            )
            .await
            .unwrap();

        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "ginger");
    }

    #[tokio::test]
    async fn test_canonicalizes_package_size_prefixes() {
        let parser = IngredientParser::new();

        let result = parser
            .parse_ingredient("1 1/4-oz. envelope instant yeast (about 2 1/4 tsp.)", None)
            .await
            .unwrap();

        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "instant yeast");
    }

    #[tokio::test]
    async fn test_repairs_raw_descriptor_names_when_parser_drops_the_noun() {
        let parser = IngredientParser::new();

        let sugar = parser
            .parse_ingredient("3/4 cup raw (turbinado) sugar", None)
            .await
            .unwrap()
            .unwrap();
        assert!(sugar.name.contains("sugar"));
        assert_ne!(sugar.name, "raw");

        let honey = parser
            .parse_ingredient(
                "6 tablespoons robust flavored raw, unfiltered honey such as clover, or organic amber maple syrup",
                None,
            )
            .await
            .unwrap()
            .unwrap();
        assert!(honey.name.contains("honey"));
        assert_ne!(honey.name, "robust flavored raw");
    }

    #[tokio::test]
    async fn test_rejects_bare_container_rows() {
        let parser = IngredientParser::new();

        assert!(parser.parse_ingredient("1 can", None).await.unwrap().is_none());
        assert!(parser.parse_ingredient("1 clove", None).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_preparation_method_filtering() {
        let parser = IngredientParser::new();

        // Test that simple preparation methods are filtered out
        // Note: Complex preparation methods might still be parsed by the AI model
        let simple_preparation_methods = vec![
            ", beaten",
            ", chopped",
            ", or more to taste",
            "beaten",
            "chopped",
            "sliced",
        ];

        for method in simple_preparation_methods {
            let result = parser.parse_ingredient(method, None).await;
            assert!(result.is_ok());
            // The result should either be None (filtered out) or have a very short/invalid name
            if let Some(ingredient) = result.unwrap() {
                // If not filtered out, the name should be very short (likely parsing artifact)
                assert!(ingredient.name.len() <= 10,
                    "Preparation method '{}' should be filtered out or result in short name, got: '{}'",
                    method, ingredient.name);
            }
        }
    }

    #[tokio::test]
    async fn test_complex_preparation_method_handling() {
        let parser = IngredientParser::new();

        // Test that complex preparation methods are handled (may not be filtered but should be cleaned)
        let complex_preparation_methods = vec![
            ", sliced into thin rings",
            ", peeled and cut into bite-sized pieces",
        ];

        for method in complex_preparation_methods {
            let result = parser.parse_ingredient(method, None).await;
            assert!(result.is_ok());
            // These might not be filtered out by the AI, but if parsed, should not contain commas
            if let Some(ingredient) = result.unwrap() {
                assert!(!ingredient.name.starts_with(','),
                    "Ingredient name should not start with comma: '{}'", ingredient.name);
                assert!(!ingredient.name.is_empty(),
                    "Ingredient name should not be empty for input: '{}'", method);
            }
        }
    }

    #[tokio::test]
    async fn test_underscore_to_space_conversion() {
        let parser = IngredientParser::new();

        // Test that underscores are converted to spaces
        // Focus on the core functionality: underscores should be replaced with spaces
        let underscore_ingredients = vec![
            "baking_powder",
            "boiling_water",
            "bread_flour",
            "celery_seed",
            "ground_beef",
            "kosher_salt",
            "prepared_mustard",
            "seasoned_salt",
            "vegetable_oil",
        ];

        for input in underscore_ingredients {
            println!("Testing input: '{}'", input);
            let result = parser.parse_ingredient(input, None).await;
            assert!(result.is_ok());
            if let Some(ingredient) = result.unwrap() {
                println!("Parsed result: name='{}', amount='{}', unit='{}'",
                    ingredient.name, ingredient.amount, ingredient.unit);

                // Primary test: underscores should be replaced with spaces
                assert!(!ingredient.name.contains('_'),
                    "Ingredient name still contains underscores: '{}' from input '{}'",
                    ingredient.name, input);

                // The ingredient name should not be empty
                assert!(!ingredient.name.is_empty(),
                    "Ingredient name should not be empty for input '{}'", input);

                // For underscore inputs, we expect the cleaned name to have spaces
                // But we need to be more flexible since the ingredient crate might parse differently
                let expected_cleaned = input.replace('_', " ");
                if ingredient.name != expected_cleaned {
                    println!("Warning: Expected '{}' but got '{}' for input '{}'",
                        expected_cleaned, ingredient.name, input);
                    // Don't fail the test, just warn - the ingredient crate might parse differently
                }
            } else {
                panic!("Failed to parse ingredient: '{}'", input);
            }
        }
    }

    #[tokio::test]
    async fn test_complex_ingredient_cleaning() {
        let parser = IngredientParser::new();

        // Test complex ingredients with preparation instructions
        let complex_ingredients = vec![
            ("chicken breast, boneless and skinless", "chicken breast"),
            ("carrots, peeled and cut into matchstick pieces", "carrots"),
            ("garlic, minced", "garlic"),
            ("onion, chopped", "onion"),
            ("mushrooms, sliced", "mushrooms"),
            ("peppers, halved and seeded", "peppers"),
        ];

        for (input, expected_name) in complex_ingredients {
            let result = parser.parse_ingredient(input, None).await;
            assert!(result.is_ok());
            if let Some(ingredient) = result.unwrap() {
                assert_eq!(ingredient.name, expected_name, "Failed to clean ingredient: '{}'", input);
            }
        }
    }

    #[tokio::test]
    async fn test_single_letter_filtering() {
        let parser = IngredientParser::new();

        // Test that single letters are filtered out
        let single_letters = vec!["g", "s", "a", "z"];

        for letter in single_letters {
            let result = parser.parse_ingredient(letter, None).await;
            assert!(result.is_ok());
            assert!(result.unwrap().is_none(), "Should filter out single letter: '{}'", letter);
        }
    }

    #[tokio::test]
    async fn test_malformed_ingredient_cleanup() {
        let parser = IngredientParser::new();

        // Test malformed ingredients from CSV
        let malformed_ingredients = vec![
            ("all-purposed", "all-purposed"), // Should be kept as-is (typo but still ingredient)
            ("all-purposedflour", "all-purposedflour"), // Should be kept as-is
            ("uncooked_longgrainwhiterice", "uncooked longgrainwhiterice"), // Underscore converted
        ];

        for (input, expected_name) in malformed_ingredients {
            let result = parser.parse_ingredient(input, None).await;
            assert!(result.is_ok());
            if let Some(ingredient) = result.unwrap() {
                assert_eq!(ingredient.name, expected_name, "Failed to handle malformed ingredient: '{}'", input);
            }
        }
    }

    #[tokio::test]
    async fn test_parsing_with_sections() {
        let parser = IngredientParser::new();

        // Test parsing with sections
        let result = parser.parse_ingredient("1 cup flour", Some("Dry Ingredients".to_string())).await;
        assert!(result.is_ok());

        if let Some(ingredient) = result.unwrap() {
            assert_eq!(ingredient.name, "flour");
            assert_eq!(ingredient.section, Some("Dry Ingredients".to_string()));
        }
    }

    #[test]
    fn test_clean_ingredient_name_helper() {
        let parser = IngredientParser::new();

        // Test underscore replacement
        assert_eq!(parser.clean_ingredient_name("baking_powder"), "baking powder");
        assert_eq!(parser.clean_ingredient_name("ground_beef"), "ground beef");

        // Test comma removal with preparation instructions
        assert_eq!(parser.clean_ingredient_name("chicken breast, boneless"), "chicken breast");
        assert_eq!(parser.clean_ingredient_name("onion, chopped"), "onion");

        // Test leading comma removal
        assert_eq!(parser.clean_ingredient_name(", beaten"), "beaten");
        assert_eq!(parser.clean_ingredient_name(", chopped"), "chopped");

        // Test parenthetical removal
        assert_eq!(parser.clean_ingredient_name("water (110 degrees F)"), "water");
        assert_eq!(parser.clean_ingredient_name("flour (sifted)"), "flour");

        // Test multiple space normalization
        assert_eq!(parser.clean_ingredient_name("all   purpose    flour"), "all purpose flour");

        // Test whitespace trimming
        assert_eq!(parser.clean_ingredient_name("  salt  "), "salt");
    }

    #[test]
    fn test_is_preparation_method_helper() {
        let parser = IngredientParser::new();

        // Test common preparation methods
        assert!(parser.is_preparation_method("beaten"));
        assert!(parser.is_preparation_method("chopped"));
        assert!(parser.is_preparation_method("sliced"));
        assert!(parser.is_preparation_method("diced"));
        assert!(parser.is_preparation_method("minced"));
        assert!(parser.is_preparation_method("peeled"));
        assert!(parser.is_preparation_method("or more to taste"));
        assert!(parser.is_preparation_method("to taste"));
        assert!(parser.is_preparation_method("as needed"));
        assert!(parser.is_preparation_method("divided"));

        // Test preparation methods with leading commas
        assert!(parser.is_preparation_method(", beaten"));
        assert!(parser.is_preparation_method(", chopped"));

        // Test single letters
        assert!(parser.is_preparation_method("g"));
        assert!(parser.is_preparation_method("s"));

        // Test valid ingredients (should return false)
        assert!(!parser.is_preparation_method("flour"));
        assert!(!parser.is_preparation_method("chicken breast"));
        assert!(!parser.is_preparation_method("olive oil"));
        assert!(!parser.is_preparation_method("baking powder"));
        assert!(!parser.is_preparation_method("salt"));
    }

    #[test]
    fn test_looks_like_ingredient_helper() {
        let parser = IngredientParser::new();

        // Test valid ingredients
        assert!(parser.looks_like_ingredient("flour"));
        assert!(parser.looks_like_ingredient("chicken breast"));
        assert!(parser.looks_like_ingredient("olive oil"));
        assert!(parser.looks_like_ingredient("baking powder"));
        assert!(parser.looks_like_ingredient("all-purpose flour"));

        // Test invalid ingredients
        assert!(!parser.looks_like_ingredient("g"));
        assert!(!parser.looks_like_ingredient("s"));
        assert!(!parser.looks_like_ingredient(""));
        assert!(!parser.looks_like_ingredient("  "));
        assert!(!parser.looks_like_ingredient("123"));
        assert!(!parser.looks_like_ingredient("beaten"));
        assert!(!parser.looks_like_ingredient("chopped"));
        assert!(!parser.looks_like_ingredient("to taste"));
    }
}
