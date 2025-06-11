use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedRecipe {
    pub name: String,
    pub description: String,
    pub image: String,
    pub prep_time: String,
    pub cook_time: String,
    pub total_time: String,
    pub servings: u32,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub keywords: String,
    pub source_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecipeImportError {
    pub message: String,
    pub error_type: String,
}

impl std::fmt::Display for RecipeImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}: {}", self.error_type, self.message)
    }
}

impl std::error::Error for RecipeImportError {}

pub async fn import_recipe_from_url(url: &str) -> Result<ImportedRecipe, RecipeImportError> {
    // Validate URL
    let parsed_url = Url::parse(url).map_err(|_| RecipeImportError {
        message: "Invalid URL format".to_string(),
        error_type: "ValidationError".to_string(),
    })?;

    // Check if it's a supported site
    if !is_supported_url(&parsed_url) {
        return Err(RecipeImportError {
            message: "Unsupported website. Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes.".to_string(),
            error_type: "UnsupportedSite".to_string(),
        });
    }

    // Fetch the webpage
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .map_err(|e| RecipeImportError {
            message: format!("Failed to create HTTP client: {}", e),
            error_type: "NetworkError".to_string(),
        })?;

    let response = client.get(url).send().await.map_err(|e| RecipeImportError {
        message: format!("Failed to fetch webpage: {}", e),
        error_type: "NetworkError".to_string(),
    })?;

    if !response.status().is_success() {
        return Err(RecipeImportError {
            message: format!("HTTP error: {}", response.status()),
            error_type: "NetworkError".to_string(),
        });
    }

    let html_content = response.text().await.map_err(|e| RecipeImportError {
        message: format!("Failed to read response body: {}", e),
        error_type: "NetworkError".to_string(),
    })?;

    // Parse the HTML and extract recipe data
    extract_recipe_data(&html_content, url)
}

pub fn is_supported_url(url: &Url) -> bool {
    if let Some(host) = url.host_str() {
        host.contains("allrecipes.com") ||
        host.contains("foodnetwork.com") ||
        host.contains("bbcgoodfood.com") ||
        host.contains("seriouseats.com") ||
        host.contains("epicurious.com") ||
        host.contains("food.com") ||
        host.contains("tasteofhome.com") ||
        host.contains("delish.com") ||
        host.contains("bonappetit.com") ||
        host.contains("simplyrecipes.com")
    } else {
        false
    }
}

pub fn extract_recipe_data(html: &str, source_url: &str) -> Result<ImportedRecipe, RecipeImportError> {
    let document = Html::parse_document(html);

    // First try to extract from JSON-LD structured data
    if let Ok(recipe) = extract_from_json_ld(&document, source_url) {
        return Ok(recipe);
    }

    // Fallback to HTML scraping
    extract_from_html_selectors(&document, source_url)
}

pub fn extract_from_json_ld(document: &Html, source_url: &str) -> Result<ImportedRecipe, RecipeImportError> {
    let script_selector = Selector::parse("script[type='application/ld+json']").unwrap();
    
    for script in document.select(&script_selector) {
        let json_text = script.inner_html();
        
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&json_text) {
            // Handle both single objects and arrays
            let recipes = if json_value.is_array() {
                json_value.as_array().unwrap()
            } else {
                &vec![json_value]
            };

            for item in recipes {
                if let Some(recipe_type) = item.get("@type") {
                    // Handle both string and array @type values
                    let is_recipe = if recipe_type.is_string() {
                        recipe_type.as_str() == Some("Recipe")
                    } else if recipe_type.is_array() {
                        recipe_type.as_array()
                            .map(|arr| arr.iter().any(|t| t.as_str() == Some("Recipe")))
                            .unwrap_or(false)
                    } else {
                        false
                    };

                    if is_recipe {
                        return parse_json_ld_recipe(item, source_url);
                    }
                }
            }
        }
    }

    Err(RecipeImportError {
        message: "No JSON-LD recipe data found".to_string(),
        error_type: "ParseError".to_string(),
    })
}

pub fn parse_json_ld_recipe(recipe_data: &serde_json::Value, source_url: &str) -> Result<ImportedRecipe, RecipeImportError> {
    let name = recipe_data.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled Recipe")
        .to_string();

    let description = recipe_data.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let image = extract_image_from_json(recipe_data);

    let prep_time = recipe_data.get("prepTime")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let cook_time = recipe_data.get("cookTime")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let total_time = recipe_data.get("totalTime")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let servings = extract_servings_from_json(recipe_data);
    let ingredients = extract_ingredients_from_json(recipe_data);
    let instructions = extract_instructions_from_json(recipe_data);

    let keywords = extract_keywords_from_json(recipe_data);

    Ok(ImportedRecipe {
        name,
        description,
        image,
        prep_time,
        cook_time,
        total_time,
        servings,
        ingredients,
        instructions,
        keywords,
        source_url: source_url.to_string(),
    })
}

pub fn extract_from_html_selectors(document: &Html, source_url: &str) -> Result<ImportedRecipe, RecipeImportError> {
    // Determine site-specific selectors
    let parsed_url = Url::parse(source_url).map_err(|_| RecipeImportError {
        message: "Invalid source URL".to_string(),
        error_type: "ValidationError".to_string(),
    })?;

    let host = parsed_url.host_str().unwrap_or("");

    // Site-specific selectors
    let (title_selectors, description_selectors, image_selectors) = get_site_selectors(host);

    let title_selector = Selector::parse(&title_selectors).unwrap();
    let description_selector = Selector::parse(&description_selectors).unwrap();
    let image_selector = Selector::parse(&image_selectors).unwrap();

    let name = document.select(&title_selector)
        .next()
        .map(|el| {
            let html = el.inner_html();
            let text = html.trim();
            // Clean up site-specific suffixes
            text.replace(" - Allrecipes", "")
                .replace(" | Food Network", "")
                .replace(" - BBC Good Food", "")
                .replace(" Recipe | Serious Eats", "")
                .replace(" | Epicurious", "")
                .replace(" | Food.com", "")
                .replace(" | Taste of Home", "")
                .replace(" - Delish", "")
                .replace(" | Bon Appétit", "")
                .replace(" | Simply Recipes", "")
        })
        .unwrap_or_else(|| "Untitled Recipe".to_string());

    let description = document.select(&description_selector)
        .next()
        .and_then(|el| {
            el.value().attr("content").map(|s| s.to_string())
                .or_else(|| Some(el.inner_html().trim().to_string()))
        })
        .unwrap_or_else(|| String::new());

    let image = document.select(&image_selector)
        .next()
        .and_then(|el| el.value().attr("content").or_else(|| el.value().attr("src")))
        .unwrap_or("")
        .to_string();

    // Try to extract additional data with site-specific selectors
    let ingredients = extract_sectioned_ingredients_from_html(document, host);
    let instructions = extract_instructions_from_html(document);

    Ok(ImportedRecipe {
        name,
        description,
        image,
        prep_time: String::new(),
        cook_time: String::new(),
        total_time: String::new(),
        servings: 0,
        ingredients,
        instructions,
        keywords: String::new(),
        source_url: source_url.to_string(),
    })
}

pub fn get_site_selectors(host: &str) -> (String, String, String) {
    if host.contains("allrecipes.com") {
        (
            "h1.headline, h1.recipe-summary__h1, h1.entry-title, title".to_string(),
            "meta[name='description'], .recipe-summary__description".to_string(),
            "meta[property='og:image'], .recipe-hero__image img, .recipe-image img".to_string(),
        )
    } else if host.contains("foodnetwork.com") {
        (
            "h1.o-AssetTitle__a-HeadlineText, h1.recipe-title, title".to_string(),
            "meta[name='description'], .o-RecipeInfo__a-Description".to_string(),
            "meta[property='og:image'], .m-MediaBlock__a-Image img".to_string(),
        )
    } else if host.contains("bbcgoodfood.com") {
        (
            "h1.post-header__title, h1.recipe-header__title, title".to_string(),
            "meta[name='description'], .recipe-header__description".to_string(),
            "meta[property='og:image'], .recipe-media__image img".to_string(),
        )
    } else if host.contains("seriouseats.com") {
        (
            "h1.heading__title, h1.recipe-title, title".to_string(),
            "meta[name='description'], .recipe-about".to_string(),
            "meta[property='og:image'], .recipe-hero-image img".to_string(),
        )
    } else if host.contains("epicurious.com") {
        (
            "h1.recipe-title, h1.hed, title".to_string(),
            "meta[name='description'], .recipe-intro".to_string(),
            "meta[property='og:image'], .recipe-image img".to_string(),
        )
    } else {
        // Generic fallback selectors
        (
            "h1, .recipe-title, .entry-title, title".to_string(),
            "meta[name='description'], .recipe-description, .description".to_string(),
            "meta[property='og:image'], .recipe-image img, .featured-image img".to_string(),
        )
    }
}

// Extract instructions from HTML
pub fn extract_instructions_from_html(document: &Html) -> Vec<String> {
    let instruction_selectors = [
        ".recipe-instruction, .instructions li, .instruction",
        ".recipe-instructions li, .instructions-list li",
        ".recipe__instruction, .recipe-card__instruction",
        ".recipe-method li, .method li",
        ".directions li, .recipe-directions li",
    ];

    for selector_str in &instruction_selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            let found_instructions: Vec<String> = document
                .select(&selector)
                .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            if !found_instructions.is_empty() {
                return found_instructions;
            }
        }
    }

    Vec::new()
}

// Helper functions for JSON extraction (made public for testing)
pub fn extract_image_from_json(recipe_data: &serde_json::Value) -> String {
    recipe_data.get("image")
        .and_then(|v| {
            if v.is_string() {
                v.as_str()
            } else if v.is_object() {
                v.get("url").and_then(|u| u.as_str())
            } else if v.is_array() {
                v.as_array().and_then(|arr| arr.first()).and_then(|first| {
                    if first.is_string() {
                        first.as_str()
                    } else {
                        first.get("url").and_then(|u| u.as_str())
                    }
                })
            } else {
                None
            }
        })
        .unwrap_or("")
        .to_string()
}

pub fn extract_servings_from_json(recipe_data: &serde_json::Value) -> u32 {
    recipe_data.get("recipeYield")
        .or_else(|| recipe_data.get("yield"))
        .and_then(|v| {
            if v.is_number() {
                v.as_u64().map(|n| n as u32)
            } else if v.is_string() {
                v.as_str().and_then(|s| s.parse::<u32>().ok())
            } else if v.is_array() {
                v.as_array().and_then(|arr| arr.first()).and_then(|first| {
                    if first.is_number() {
                        first.as_u64().map(|n| n as u32)
                    } else if first.is_string() {
                        first.as_str().and_then(|s| s.parse::<u32>().ok())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
        .unwrap_or(0)
}

pub fn extract_ingredients_from_json(recipe_data: &serde_json::Value) -> Vec<String> {
    recipe_data.get("recipeIngredient")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str())
                .map(|s| clean_raw_ingredient_string(s))
                .filter(|s| !s.is_empty() && is_valid_ingredient_name(s))
                .collect()
        })
        .unwrap_or_else(Vec::new)
}

/// Clean raw ingredient strings from JSON-LD data before parsing
pub fn clean_raw_ingredient_string(raw: &str) -> String {
    let mut cleaned = raw.trim().to_string();

    // Remove HTML entities and tags
    cleaned = cleaned.replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .replace("&#39;", "'");

    // Remove HTML tags if any
    if cleaned.contains('<') && cleaned.contains('>') {
        cleaned = regex::Regex::new(r"<[^>]*>").unwrap().replace_all(&cleaned, "").to_string();
    }

    // Fix common malformed patterns from AllRecipes
    // Pattern: "ounce) package cream cheese" -> "8 ounce package cream cheese"
    if let Some(captures) = regex::Regex::new(r"^([a-zA-Z]+)\)\s+(.+)$").unwrap().captures(&cleaned) {
        let unit = &captures[1];
        let rest = &captures[2];
        // Try to infer a reasonable amount for common units
        let amount = match unit.to_lowercase().as_str() {
            "ounce" | "oz" => "8",
            "pound" | "lb" => "1",
            "cup" => "1",
            "tablespoon" | "tbsp" => "2",
            "teaspoon" | "tsp" => "1",
            _ => "1"
        };
        cleaned = format!("{} {} {}", amount, unit, rest);
    }

    // Fix patterns like "pound) whole chicken" -> "1 pound whole chicken"
    cleaned = regex::Regex::new(r"^([a-zA-Z]+)\)\s+")
        .unwrap()
        .replace(&cleaned, "1 $1 ")
        .to_string();

    // Remove extra whitespace
    cleaned = regex::Regex::new(r"\s+").unwrap().replace_all(&cleaned, " ").trim().to_string();

    cleaned
}

/// Validate that an ingredient name is reasonable
pub fn is_valid_ingredient_name(name: &str) -> bool {
    let trimmed = name.trim();

    // Must have some content
    if trimmed.is_empty() {
        return false;
    }

    // Must contain at least one letter
    if !trimmed.chars().any(|c| c.is_alphabetic()) {
        return false;
    }

    // Reject obviously invalid names
    let invalid_names = [
        "chopped", "sliced", "diced", "minced", "beaten", "melted", "softened",
        "divided", "taste", "needed", "desired", "optional", "garnish",
        "spray", "leaf", "leaves", "caps", "whites", "yolks", "cubed",
        "halved", "quartered", "peeled", "seeded", "trimmed", "baby doll",
        "chopsticks for handles", "with flour", "for rolling", "juiced",
        "mashed", "crushed", "ground", "fresh", "dried", "frozen",
        "or more to taste", "or as needed", "to taste", "as needed"
    ];

    let lower_name = trimmed.to_lowercase();
    if invalid_names.iter().any(|&invalid| lower_name == invalid) {
        return false;
    }

    // Reject names that are just preparation instructions
    if regex::Regex::new(r"^(finely\s+)?(chopped|diced|sliced|minced|grated|shredded|crushed|ground|beaten|melted|softened|peeled|seeded|trimmed|halved|quartered)(\s+.*)?$")
        .unwrap()
        .is_match(&lower_name) {
        return false;
    }

    // Reject names that start with measurements without ingredient
    if regex::Regex::new(r"^[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+\s*(ounce|pound|cup|tablespoon|teaspoon|gram|kilogram|liter|milliliter|inch)\s*$")
        .unwrap()
        .is_match(&lower_name) {
        return false;
    }

    true
}

// Extract ingredients with section information from HTML
pub fn extract_sectioned_ingredients_from_html(document: &Html, host: &str) -> Vec<String> {
    let mut ingredients = Vec::new();

    // Check if this is AllRecipes and try to extract sectioned ingredients
    if host.contains("allrecipes.com") {
        if let Ok(section_selector) = Selector::parse(".mm-recipes-structured-ingredients__list-heading") {
            if let Ok(list_selector) = Selector::parse(".mm-recipes-structured-ingredients__list") {
                let sections = document.select(&section_selector).collect::<Vec<_>>();
                let lists = document.select(&list_selector).collect::<Vec<_>>();

                // Match sections with their corresponding ingredient lists
                for (i, section) in sections.iter().enumerate() {
                    let section_name = section.text().collect::<Vec<_>>().join(" ").trim().to_string();

                    // Get the corresponding ingredient list (should be the next list after this section)
                    if let Some(list) = lists.get(i) {
                        if let Ok(item_selector) = Selector::parse(".mm-recipes-structured-ingredients__list-item") {
                            for item in list.select(&item_selector) {
                                let ingredient_text = item.text().collect::<Vec<_>>().join(" ").trim().to_string();
                                if !ingredient_text.is_empty() {
                                    // Prefix ingredient with section name for parsing later
                                    ingredients.push(format!("[{}] {}", section_name, ingredient_text));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // If no sectioned ingredients found, fall back to regular extraction
    if ingredients.is_empty() {
        ingredients = extract_regular_ingredients_from_html(document);
    }

    ingredients
}

// Regular ingredient extraction (existing logic)
pub fn extract_regular_ingredients_from_html(document: &Html) -> Vec<String> {
    let ingredient_selectors = [
        ".recipe-ingredient, .ingredients li, .ingredient",
        ".recipe-ingredients li, .ingredients-list li",
        ".recipe__ingredient, .recipe-card__ingredient",
        "[data-ingredient], .ingredient-text",
    ];

    for selector_str in &ingredient_selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            let found_ingredients: Vec<String> = document
                .select(&selector)
                .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            if !found_ingredients.is_empty() {
                return found_ingredients;
            }
        }
    }

    Vec::new()
}

pub fn extract_instructions_from_json(recipe_data: &serde_json::Value) -> Vec<String> {
    recipe_data.get("recipeInstructions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    if item.is_string() {
                        item.as_str()
                    } else {
                        item.get("text").and_then(|t| t.as_str())
                    }
                })
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_else(Vec::new)
}

pub fn extract_keywords_from_json(recipe_data: &serde_json::Value) -> String {
    let mut keyword_parts = Vec::new();

    // Try recipeCategory first
    if let Some(category_value) = recipe_data.get("recipeCategory") {
        if category_value.is_array() {
            if let Some(arr) = category_value.as_array() {
                let category_vec: Vec<String> = arr.iter()
                    .filter_map(|item| item.as_str())
                    .map(|s| s.to_string())
                    .collect();
                keyword_parts.extend(category_vec);
            }
        } else if let Some(s) = category_value.as_str() {
            keyword_parts.push(s.to_string());
        }
    }

    // Also try recipeCuisine
    if let Some(cuisine_value) = recipe_data.get("recipeCuisine") {
        if cuisine_value.is_array() {
            if let Some(arr) = cuisine_value.as_array() {
                let cuisine_vec: Vec<String> = arr.iter()
                    .filter_map(|item| item.as_str())
                    .map(|s| s.to_string())
                    .collect();
                keyword_parts.extend(cuisine_vec);
            }
        } else if let Some(s) = cuisine_value.as_str() {
            keyword_parts.push(s.to_string());
        }
    }

    keyword_parts.join(", ")
}

#[cfg(test)]
mod tests;
