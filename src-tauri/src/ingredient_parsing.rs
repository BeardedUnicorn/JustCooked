use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
use tracing::{debug, info};
use ingredient::{from_str as parse_ingredient_str, Ingredient as ParsedIngredient};
use crate::ingredient_catalog::{canonicalize_ingredient_catalog_name, is_suspicious_catalog_name};

/// Simple ingredient structure for parsing results
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParsedIngredientInfo {
    /// The ingredient name (e.g., "all-purpose flour", "chicken breast")
    pub name: String,

    /// The amount as a decimal number (e.g., 2.5, 0.25, 1.0)
    pub amount: f64,

    /// The unit of measurement (e.g., "cup", "tbsp", "lb", "oz", "unit", "")
    pub unit: String,

    /// Optional section for grouped ingredients (e.g., "Cake Layer", "Frosting")
    pub section: Option<String>,
}

/// Performance metrics for monitoring parsing operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingMetrics {
    pub total_requests: u64,
    pub successful_parses: u64,
    pub failed_parses: u64,
    pub average_latency_ms: f64,
    pub batch_operations: u64,
}

impl Default for ParsingMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_parses: 0,
            failed_parses: 0,
            average_latency_ms: 0.0,
            batch_operations: 0,
        }
    }
}

/// Ingredient parsing service using the ingredient crate
pub struct IngredientParser {
    /// Performance metrics
    metrics: Arc<Mutex<ParsingMetrics>>,
}

impl IngredientParser {
    /// Create a new ingredient parser instance
    pub fn new() -> Self {
        info!("Initializing ingredient parser with ingredient crate");

        Self {
            metrics: Arc::new(Mutex::new(ParsingMetrics::default())),
        }
    }

    /// Get current performance metrics
    pub async fn get_metrics(&self) -> ParsingMetrics {
        self.metrics.lock().await.clone()
    }



    /// Parse a single ingredient string using the ingredient crate
    pub async fn parse_ingredient(
        &self,
        ingredient_text: &str,
        section: Option<String>,
    ) -> Result<Option<crate::database::Ingredient>> {
        // Skip empty or invalid ingredients
        if ingredient_text.trim().is_empty() {
            return Ok(None);
        }

        let start_time = Instant::now();
        debug!("Parsing ingredient with ingredient crate: '{}'", ingredient_text);

        // Update metrics
        {
            let mut metrics = self.metrics.lock().await;
            metrics.total_requests += 1;
        }

        // Parse using the ingredient crate
        let result = self.parse_with_ingredient_crate(ingredient_text, section);

        // Update latency metrics
        let elapsed = start_time.elapsed();
        {
            let mut metrics = self.metrics.lock().await;
            let total_time = metrics.average_latency_ms * (metrics.total_requests - 1) as f64;
            metrics.average_latency_ms = (total_time + elapsed.as_millis() as f64) / metrics.total_requests as f64;
        }

        result
    }

    /// Parse ingredient using the ingredient crate
    fn parse_with_ingredient_crate(
        &self,
        ingredient_text: &str,
        section: Option<String>,
    ) -> Result<Option<crate::database::Ingredient>> {
        // Parse using the ingredient crate
        let parsed = parse_ingredient_str(ingredient_text);

        debug!("Raw parsed ingredient: {:?}", parsed);
        debug!("Ingredient name: '{}', amounts: {:?}, modifier: {:?}", parsed.name, parsed.amounts, parsed.modifier);

        // If the ingredient crate didn't parse it well (empty name or looks incomplete),
        // fall back to treating the whole input as the ingredient name
        let result = if parsed.name.is_empty() ||
                       (ingredient_text.contains('_') && !parsed.name.contains(' ') &&
                        parsed.name.len() < ingredient_text.replace('_', "").len()) {
            debug!("Ingredient crate parsing seems incomplete, using fallback for '{}'", ingredient_text);
            self.fallback_parse_simple(ingredient_text, section)
        } else {
            // Convert to our database format
            self.convert_parsed_ingredient(parsed, section)
        };

        // Update metrics based on result
        let success = result.is_ok() && result.as_ref().map_or(false, |opt| opt.is_some());
        tokio::spawn({
            let metrics = self.metrics.clone();
            async move {
                let mut metrics = metrics.lock().await;
                if success {
                    metrics.successful_parses += 1;
                } else {
                    metrics.failed_parses += 1;
                }
            }
        });

        result
    }

    /// Convert parsed ingredient from ingredient crate to our database format
    fn convert_parsed_ingredient(
        &self,
        parsed: ParsedIngredient,
        section: Option<String>,
    ) -> Result<Option<crate::database::Ingredient>> {
        // Clean and validate the ingredient name
        let cleaned_name = self.clean_ingredient_name(&parsed.name);
        let repaired_name = if is_suspicious_catalog_name(&cleaned_name) {
            canonicalize_ingredient_catalog_name(&cleaned_name)
        } else {
            Some(cleaned_name.clone())
        };

        // Validate the parsed ingredient
        let Some(cleaned_name) = repaired_name else {
            debug!("Parsed ingredient has invalid name: '{}'", cleaned_name);
            return Ok(None);
        };

        if cleaned_name.is_empty() || self.is_preparation_method(&cleaned_name) {
            debug!("Parsed ingredient has invalid name: '{}'", cleaned_name);
            return Ok(None);
        }

        // Extract the primary amount and unit from the parsed ingredient
        let (amount, unit) = if parsed.amounts.is_empty() {
            ("1".to_string(), "unit".to_string())
        } else {
            let measure = &parsed.amounts[0];
            let (value, upper_value, unit_str) = measure.values();

            // Format the amount, including range if present
            let amount_str = if let Some(upper) = upper_value {
                format!("{}-{}", value, upper)
            } else {
                value.to_string()
            };

            (amount_str, normalize_unit(&unit_str))
        };

        // Convert to database ingredient
        let db_ingredient = crate::database::Ingredient {
            name: cleaned_name,
            amount,
            unit,
            category: None,
            section,
        };

        Ok(Some(db_ingredient))
    }

    /// Simple fallback parsing when the ingredient crate doesn't work well
    fn fallback_parse_simple(
        &self,
        ingredient_text: &str,
        section: Option<String>,
    ) -> Result<Option<crate::database::Ingredient>> {
        let fallback_name = self.clean_ingredient_name(ingredient_text);
        let cleaned_name = canonicalize_ingredient_catalog_name(ingredient_text)
            .or_else(|| canonicalize_ingredient_catalog_name(&fallback_name))
            .unwrap_or(fallback_name);

        if cleaned_name.is_empty()
            || self.is_preparation_method(&cleaned_name)
            || is_suspicious_catalog_name(&cleaned_name)
        {
            return Ok(None);
        }

        Ok(Some(crate::database::Ingredient {
            name: cleaned_name,
            amount: "1".to_string(),
            unit: "unit".to_string(),
            category: None,
            section,
        }))
    }







    /// Clean ingredient name by fixing common issues
    fn clean_ingredient_name(&self, name: &str) -> String {
        let cleaned = name.trim();

        // Replace underscores with spaces
        let cleaned = cleaned.replace('_', " ");

        // Remove leading commas and whitespace (common parsing artifacts)
        let cleaned = cleaned.trim_start_matches(',').trim();

        // Remove preparation instructions in parentheses or after commas
        let cleaned = if let Some(comma_pos) = cleaned.find(',') {
            let before_comma = &cleaned[..comma_pos].trim();
            // Only keep the part before comma if it looks like an ingredient
            if self.looks_like_ingredient(before_comma) {
                before_comma.to_string()
            } else {
                cleaned.to_string()
            }
        } else {
            cleaned.to_string()
        };

        // Remove parenthetical preparation instructions
        let cleaned = if let Some(paren_pos) = cleaned.find('(') {
            cleaned[..paren_pos].trim().to_string()
        } else {
            cleaned
        };

        // Normalize multiple spaces to single spaces
        let cleaned = regex::Regex::new(r"\s+").unwrap().replace_all(&cleaned, " ");

        cleaned.trim().to_string()
    }

    /// Check if a string represents a preparation method rather than an ingredient
    fn is_preparation_method(&self, text: &str) -> bool {
        let text_lower = text.to_lowercase();
        let trimmed_text = text.trim();

        // Common preparation methods that should be filtered out
        let preparation_methods = [
            "beaten", "chopped", "sliced", "diced", "minced", "grated", "shredded",
            "peeled", "cut", "trimmed", "cleaned", "washed", "dried", "cooked",
            "boiled", "fried", "baked", "roasted", "grilled", "steamed",
            "or more to taste", "to taste", "as needed", "or as needed",
            "divided", "reserved", "optional", "for serving", "for garnish",
            "thawed", "defrosted", "room temperature", "softened", "melted",
            "pounded", "flattened", "butterflied", "scored", "pierced",
        ];

        // Check if the text is primarily a preparation method
        for method in &preparation_methods {
            if text_lower.contains(method) {
                // If the text is mostly the preparation method (with some descriptive words)
                // or if it's a short text containing the method, it's likely a preparation method
                let method_ratio = method.len() as f64 / text_lower.len() as f64;
                if method_ratio > 0.3 || text_lower.len() < method.len() + 15 {
                    return true;
                }
            }
        }

        // Check for very short strings that are likely parsing artifacts
        if text.len() <= 2 {
            return true;
        }

        // Check if it starts with a comma and is mostly preparation text
        if trimmed_text.starts_with(',') {
            let without_comma = trimmed_text.trim_start_matches(',').trim();
            // If after removing comma it's mostly preparation methods, filter it out
            for method in &preparation_methods {
                if without_comma.to_lowercase().contains(method) {
                    return true;
                }
            }
            // Also filter out if it's just punctuation/short text after comma
            if without_comma.len() <= 3 || !without_comma.chars().any(char::is_alphabetic) {
                return true;
            }
        }

        false
    }

    /// Check if a string looks like a valid ingredient name
    fn looks_like_ingredient(&self, text: &str) -> bool {
        let text = text.trim();

        // Must have some alphabetic characters
        if !text.chars().any(char::is_alphabetic) {
            return false;
        }

        // Must be longer than 2 characters
        if text.len() <= 2 {
            return false;
        }

        // Should not be primarily preparation methods
        !self.is_preparation_method(text)
    }
}

/// Normalize unit names to standard abbreviations
fn normalize_unit(unit: &str) -> String {
    match unit.to_lowercase().as_str() {
        "cup" | "cups" => "cup".to_string(),
        "tablespoon" | "tablespoons" | "tbsp" => "tbsp".to_string(),
        "teaspoon" | "teaspoons" | "tsp" => "tsp".to_string(),
        "pound" | "pounds" | "lb" => "lb".to_string(),
        "ounce" | "ounces" | "oz" => "oz".to_string(),
        "gram" | "grams" | "g" => "g".to_string(),
        "kilogram" | "kilograms" | "kg" => "kg".to_string(),
        "milliliter" | "milliliters" | "ml" => "ml".to_string(),
        "liter" | "liters" | "l" => "l".to_string(),
        "can" | "cans" => "can".to_string(),
        "package" | "packages" => "package".to_string(),
        "jar" | "jars" => "jar".to_string(),
        "bottle" | "bottles" => "bottle".to_string(),
        "bag" | "bags" => "bag".to_string(),
        "box" | "boxes" => "box".to_string(),
        "piece" | "pieces" => "piece".to_string(),
        "slice" | "slices" => "slice".to_string(),
        "clove" | "cloves" => "clove".to_string(),
        "stalk" | "stalks" => "stalk".to_string(),
        "" => "".to_string(),
        _ => "unit".to_string(),
    }
}

/// Global instance of the ingredient parser
static INGREDIENT_PARSER: std::sync::OnceLock<IngredientParser> = std::sync::OnceLock::new();

/// Get the global ingredient parser instance
pub fn get_ingredient_parser() -> &'static IngredientParser {
    INGREDIENT_PARSER.get_or_init(|| IngredientParser::new())
}



#[cfg(test)]
mod tests;
