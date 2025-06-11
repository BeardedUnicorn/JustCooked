#[cfg(test)]
mod tests {
    use crate::recipe_import::{clean_raw_ingredient_string, is_valid_ingredient_name};

    #[test]
    fn test_clean_raw_ingredient_string() {
        // Test malformed patterns from AllRecipes
        assert_eq!(
            clean_raw_ingredient_string("ounce) package cream cheese"),
            "8 ounce package cream cheese"
        );
        
        assert_eq!(
            clean_raw_ingredient_string("pound) whole chicken"),
            "1 pound whole chicken"
        );
        
        assert_eq!(
            clean_raw_ingredient_string("cup) all-purpose flour"),
            "1 cup all-purpose flour"
        );
        
        // Test HTML entity cleaning
        assert_eq!(
            clean_raw_ingredient_string("salt &amp; pepper"),
            "salt & pepper"
        );
        
        // Test normal ingredients (should remain unchanged)
        assert_eq!(
            clean_raw_ingredient_string("2 cups all-purpose flour"),
            "2 cups all-purpose flour"
        );
        
        // Test whitespace cleanup
        assert_eq!(
            clean_raw_ingredient_string("  1   cup    milk  "),
            "1 cup milk"
        );
    }

    #[test]
    fn test_is_valid_ingredient_name() {
        // Valid ingredient names
        assert!(is_valid_ingredient_name("all-purpose flour"));
        assert!(is_valid_ingredient_name("chicken breast"));
        assert!(is_valid_ingredient_name("olive oil"));
        assert!(is_valid_ingredient_name("salt"));
        
        // Invalid ingredient names (just preparation methods)
        assert!(!is_valid_ingredient_name("chopped"));
        assert!(!is_valid_ingredient_name("sliced"));
        assert!(!is_valid_ingredient_name("diced"));
        assert!(!is_valid_ingredient_name("beaten"));
        assert!(!is_valid_ingredient_name("melted"));
        assert!(!is_valid_ingredient_name("to taste"));
        assert!(!is_valid_ingredient_name("as needed"));
        
        // Invalid ingredient names (parsing artifacts)
        assert!(!is_valid_ingredient_name("spray"));
        assert!(!is_valid_ingredient_name("leaf"));
        assert!(!is_valid_ingredient_name("caps"));
        assert!(!is_valid_ingredient_name("baby doll"));
        
        // Empty or whitespace-only
        assert!(!is_valid_ingredient_name(""));
        assert!(!is_valid_ingredient_name("   "));
        
        // Must contain at least one letter
        assert!(!is_valid_ingredient_name("123"));
        assert!(!is_valid_ingredient_name("1/2"));
    }

    #[test]
    fn test_parse_ingredient_string_basic() {
        // Test basic parsing with amount, unit, and name
        let result = crate::parse_ingredient_string("2 cups all-purpose flour", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "all-purpose flour");
        assert_eq!(ingredient.amount, 2.0);
        assert_eq!(ingredient.unit, "cup");
        assert_eq!(ingredient.section, None);
    }

    #[test]
    fn test_parse_ingredient_string_with_section() {
        let result = crate::parse_ingredient_string("1 cup sugar", Some("Cake Layer".to_string()));
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "sugar");
        assert_eq!(ingredient.amount, 1.0);
        assert_eq!(ingredient.unit, "cup");
        assert_eq!(ingredient.section, Some("Cake Layer".to_string()));
    }

    #[test]
    fn test_parse_ingredient_string_fractions() {
        // Test unicode fractions
        let result = crate::parse_ingredient_string("½ cup milk", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.amount, 0.5);
        
        // Test regular fractions
        let result = crate::parse_ingredient_string("1/2 cup milk", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.amount, 0.5);
        
        // Test mixed numbers
        let result = crate::parse_ingredient_string("1 1/2 cups flour", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.amount, 1.5);
    }

    #[test]
    fn test_parse_ingredient_string_count_based() {
        // Test count-based ingredients (should use empty unit)
        let result = crate::parse_ingredient_string("2 large eggs", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "eggs");
        assert_eq!(ingredient.amount, 2.0);
        assert_eq!(ingredient.unit, "");
        
        let result = crate::parse_ingredient_string("1 medium onion", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "onion");
        assert_eq!(ingredient.amount, 1.0);
        assert_eq!(ingredient.unit, "");
    }

    #[test]
    fn test_parse_ingredient_string_with_preparation() {
        // Test ingredients with preparation instructions (should be cleaned)
        let result = crate::parse_ingredient_string("1 onion, diced", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "onion");
        assert_eq!(ingredient.amount, 1.0);
        
        let result = crate::parse_ingredient_string("2 cups butter, melted", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "butter");
        assert_eq!(ingredient.amount, 2.0);
        assert_eq!(ingredient.unit, "cup");
    }

    #[test]
    fn test_parse_ingredient_string_invalid() {
        // Test invalid ingredient strings (should return None)
        assert!(crate::parse_ingredient_string("chopped", None).is_none());
        assert!(crate::parse_ingredient_string("to taste", None).is_none());
        assert!(crate::parse_ingredient_string("", None).is_none());
        assert!(crate::parse_ingredient_string("   ", None).is_none());
    }

    #[test]
    fn test_parse_ingredient_string_fallback() {
        // Test fallback for simple ingredient names without amounts
        let result = crate::parse_ingredient_string("salt", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.name, "salt");
        assert_eq!(ingredient.amount, 1.0);
        assert_eq!(ingredient.unit, "unit");
    }

    #[test]
    fn test_unit_normalization() {
        let result = crate::parse_ingredient_string("2 tablespoons olive oil", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.unit, "tbsp");
        
        let result = crate::parse_ingredient_string("1 teaspoon vanilla", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.unit, "tsp");
        
        let result = crate::parse_ingredient_string("1 pound beef", None);
        assert!(result.is_some());
        let ingredient = result.unwrap();
        assert_eq!(ingredient.unit, "lb");
    }

    #[test]
    fn test_clean_ingredient_name_function() {
        assert_eq!(crate::clean_ingredient_name("onion, diced"), "onion");
        assert_eq!(crate::clean_ingredient_name("butter, melted"), "butter");
        assert_eq!(crate::clean_ingredient_name("salt to taste"), "salt");
        assert_eq!(crate::clean_ingredient_name("pepper, or to taste"), "pepper");
        assert_eq!(crate::clean_ingredient_name("flour (all-purpose)"), "flour");
        assert_eq!(crate::clean_ingredient_name("sugar, divided"), "sugar");
    }
}
