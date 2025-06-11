#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod recipe_import;
mod image_storage;
mod batch_import;
mod database;

#[cfg(test)]
mod ingredient_parsing_tests;

use recipe_import::{import_recipe_from_url, ImportedRecipe};
use image_storage::{download_and_store_image, get_app_data_dir, get_local_image_as_base64, delete_stored_image, StoredImage};
use batch_import::{BatchImporter, BatchImportRequest, BatchImportProgress};
use database::{Database, Recipe as DbRecipe, Ingredient as DbIngredient, IngredientDatabase, PantryItem, RecipeCollection, RecentSearch, RawIngredient};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendRecipe {
    id: String,
    title: String,
    description: String,
    image: String,
    source_url: String,
    prep_time: String,
    cook_time: String,
    total_time: String,
    servings: u32,
    ingredients: Vec<FrontendIngredient>,
    instructions: Vec<String>,
    tags: Vec<String>,
    date_added: String,
    date_modified: String,
    rating: Option<u32>,
    difficulty: Option<String>,
    is_favorite: Option<bool>,
    personal_notes: Option<String>,
    collections: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendIngredient {
    name: String,
    amount: f64,
    unit: String,
    section: Option<String>,
}

#[tauri::command]
async fn import_recipe(url: String) -> Result<ImportedRecipe, String> {
    match import_recipe_from_url(&url).await {
        Ok(recipe) => Ok(recipe),
        Err(e) => Err(e.message),
    }
}

#[tauri::command]
async fn download_recipe_image(image_url: String) -> Result<StoredImage, String> {
    let app_data_dir = get_app_data_dir().map_err(|e| e.message)?;
    match download_and_store_image(&image_url, &app_data_dir).await {
        Ok(stored_image) => Ok(stored_image),
        Err(e) => Err(e.message),
    }
}

#[tauri::command]
async fn get_local_image(local_path: String) -> Result<String, String> {
    match get_local_image_as_base64(&local_path).await {
        Ok(base64_data_url) => Ok(base64_data_url),
        Err(e) => Err(e.message),
    }
}

#[tauri::command]
async fn delete_recipe_image(local_path: String) -> Result<(), String> {
    match delete_stored_image(&local_path).await {
        Ok(()) => Ok(()),
        Err(e) => Err(e.message),
    }
}

fn convert_imported_recipe_to_frontend(imported: ImportedRecipe) -> FrontendRecipe {
    let recipe_id = uuid::Uuid::new_v4().to_string();
    let current_time = chrono::Utc::now().to_rfc3339();
    
    // Parse ingredients from strings to structured format
    let ingredients = imported.ingredients.iter().filter_map(|ingredient_str| {
        // Check if ingredient has section information (format: [Section Name] ingredient text)
        let (section, ingredient_text) = if let Some(captures) = regex::Regex::new(r"^\[([^\]]+)\]\s*(.+)$").unwrap().captures(ingredient_str) {
            (Some(captures[1].to_string()), captures[2].to_string())
        } else {
            (None, ingredient_str.clone())
        };

        // Parse ingredient using improved logic
        parse_ingredient_string(&ingredient_text, section)
    }).collect();
    
    // Parse tags from keywords
    let tags: Vec<String> = if imported.keywords.is_empty() {
        Vec::new()
    } else {
        imported.keywords.split(',').map(|s| s.trim().to_string()).collect()
    };
    
    FrontendRecipe {
        id: recipe_id,
        title: imported.name,
        description: imported.description,
        image: imported.image,
        source_url: imported.source_url,
        prep_time: imported.prep_time,
        cook_time: imported.cook_time,
        total_time: imported.total_time,
        servings: imported.servings,
        ingredients,
        instructions: imported.instructions,
        tags,
        date_added: current_time.clone(),
        date_modified: current_time,
        rating: None,
        difficulty: None,
        is_favorite: Some(false),
        personal_notes: None,
        collections: None,
    }
}

#[tauri::command]
async fn save_imported_recipe(
    app: tauri::AppHandle,
    imported_recipe: ImportedRecipe,
) -> Result<String, String> {
    let frontend_recipe = convert_imported_recipe_to_frontend(imported_recipe.clone());
    let recipe_id = frontend_recipe.id.clone();

    // Convert frontend recipe to database recipe and save to database
    let db_recipe = convert_frontend_to_db_recipe(frontend_recipe);

    // Initialize database and save recipe
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_recipe(&db_recipe).await.map_err(|e| e.to_string())?;

    // Capture raw ingredients for analysis
    capture_raw_ingredients(&db, &imported_recipe, Some(&recipe_id)).await
        .map_err(|e| format!("Failed to capture raw ingredients: {}", e))?;

    Ok(recipe_id)
}

// Global state for batch import
type BatchImporterMap = Arc<Mutex<HashMap<String, Arc<BatchImporter>>>>;

// Database commands
#[tauri::command]
async fn db_save_recipe(
    app: tauri::AppHandle,
    recipe: FrontendRecipe,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let db_recipe = convert_frontend_to_db_recipe(recipe);
    db.save_recipe(&db_recipe).await.map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn db_get_all_recipes(app: tauri::AppHandle) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.get_all_recipes().await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_get_recipes_paginated(
    app: tauri::AppHandle,
    page: i32,
    page_size: i32,
) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.get_recipes_paginated(page, page_size).await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_get_recipe_count(app: tauri::AppHandle) -> Result<i64, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let count = db.get_recipe_count().await.map_err(|e| e.to_string())?;
    
    Ok(count)
}

#[tauri::command]
async fn db_search_recipes_paginated(
    app: tauri::AppHandle,
    query: String,
    page: i32,
    page_size: i32,
) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.search_recipes_paginated(&query, page, page_size).await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_search_recipes_count(
    app: tauri::AppHandle,
    query: String,
) -> Result<i64, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let count = db.search_recipes_count(&query).await.map_err(|e| e.to_string())?;
    
    Ok(count)
}

#[tauri::command]
async fn db_get_recipe_by_id(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipe = db.get_recipe_by_id(&id).await.map_err(|e| e.to_string())?;
    let frontend_recipe = recipe.map(convert_db_to_frontend_recipe);
    
    Ok(frontend_recipe)
}

#[tauri::command]
async fn db_delete_recipe(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let deleted = db.delete_recipe(&id).await.map_err(|e| e.to_string())?;
    
    Ok(deleted)
}

#[tauri::command]
async fn db_search_recipes(
    app: tauri::AppHandle,
    query: String,
) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.search_recipes(&query).await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_get_recipes_by_tag(
    app: tauri::AppHandle,
    tag: String,
) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.get_recipes_by_tag(&tag).await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_get_favorite_recipes(app: tauri::AppHandle) -> Result<Vec<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let recipes = db.get_favorite_recipes().await.map_err(|e| e.to_string())?;
    let frontend_recipes = recipes.into_iter().map(convert_db_to_frontend_recipe).collect();
    
    Ok(frontend_recipes)
}

#[tauri::command]
async fn db_get_existing_recipe_urls(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let urls = db.get_existing_recipe_urls().await.map_err(|e| e.to_string())?;
    
    Ok(urls)
}

#[tauri::command]
async fn db_migrate_json_recipes(app: tauri::AppHandle) -> Result<usize, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    
    let migrated_count = db.migrate_json_recipes(&app).await.map_err(|e| e.to_string())?;
    
    Ok(migrated_count)
}

// Ingredient database commands
#[tauri::command]
async fn db_save_ingredient(
    app: tauri::AppHandle,
    ingredient: IngredientDatabase,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_ingredient(&ingredient).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_ingredients(app: tauri::AppHandle) -> Result<Vec<IngredientDatabase>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let ingredients = db.get_all_ingredients().await.map_err(|e| e.to_string())?;
    Ok(ingredients)
}

#[tauri::command]
async fn db_delete_ingredient(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_ingredient(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_search_ingredients(app: tauri::AppHandle, query: String) -> Result<Vec<IngredientDatabase>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let ingredients = db.search_ingredients(&query).await.map_err(|e| e.to_string())?;
    Ok(ingredients)
}

// Pantry database commands
#[tauri::command]
async fn db_save_pantry_item(
    app: tauri::AppHandle,
    item: PantryItem,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_pantry_item(&item).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_pantry_items(app: tauri::AppHandle) -> Result<Vec<PantryItem>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let items = db.get_all_pantry_items().await.map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
async fn db_delete_pantry_item(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_pantry_item(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

// Recipe collection database commands
#[tauri::command]
async fn db_save_recipe_collection(
    app: tauri::AppHandle,
    collection: RecipeCollection,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_recipe_collection(&collection).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_recipe_collections(app: tauri::AppHandle) -> Result<Vec<RecipeCollection>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let collections = db.get_all_recipe_collections().await.map_err(|e| e.to_string())?;
    Ok(collections)
}

#[tauri::command]
async fn db_delete_recipe_collection(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_recipe_collection(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

// Search history database commands
#[tauri::command]
async fn db_save_search_history(
    app: tauri::AppHandle,
    search: RecentSearch,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_search_history(&search).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_recent_searches(app: tauri::AppHandle, limit: i32) -> Result<Vec<RecentSearch>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let searches = db.get_recent_searches(limit).await.map_err(|e| e.to_string())?;
    Ok(searches)
}

#[tauri::command]
async fn db_delete_search_history(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_search_history(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_clear_search_history(app: tauri::AppHandle) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.clear_search_history().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Parse ingredient string into structured format with improved logic
fn parse_ingredient_string(ingredient_text: &str, section: Option<String>) -> Option<FrontendIngredient> {
    let trimmed = ingredient_text.trim();

    // Skip empty or invalid ingredients
    if trimmed.is_empty() || !is_valid_ingredient_name(trimmed) {
        return None;
    }

    // Try to parse amount, unit, and name using regex patterns
    let patterns = [
        // Pattern 1: "2 cups all-purpose flour"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|jar|jars|bottle|bottles)\s+(.+)$",
        // Pattern 2: "2 large eggs"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(large|medium|small|whole|fresh|dried)\s+(.+)$",
        // Pattern 3: "1/2 onion, diced"
        r"^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(.+?)(?:,\s*(.+))?$",
    ];

    for pattern in &patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            if let Some(captures) = regex.captures(trimmed) {
                let amount_str = captures.get(1)?.as_str();
                let amount = parse_fraction_to_decimal(amount_str);

                let (unit, name) = if captures.len() > 3 {
                    // Pattern with unit
                    let unit = captures.get(2)?.as_str().to_string();
                    let name = captures.get(3)?.as_str().to_string();
                    (normalize_unit(&unit), clean_ingredient_name(&name))
                } else {
                    // Pattern without explicit unit
                    let name = captures.get(2)?.as_str().to_string();
                    let cleaned_name = clean_ingredient_name(&name);
                    let unit = if should_use_empty_unit(&cleaned_name) { "".to_string() } else { "unit".to_string() };
                    (unit, cleaned_name)
                };

                if !name.is_empty() && is_valid_ingredient_name(&name) {
                    return Some(FrontendIngredient {
                        name,
                        amount,
                        unit,
                        section,
                    });
                }
            }
        }
    }

    // Fallback: treat as ingredient name with amount 1
    let cleaned_name = clean_ingredient_name(trimmed);
    if !cleaned_name.is_empty() && is_valid_ingredient_name(&cleaned_name) {
        let unit = if should_use_empty_unit(&cleaned_name) { "".to_string() } else { "unit".to_string() };
        Some(FrontendIngredient {
            name: cleaned_name,
            amount: 1.0,
            unit,
            section,
        })
    } else {
        None
    }
}

/// Parse fraction strings to decimal
fn parse_fraction_to_decimal(amount_str: &str) -> f64 {
    let trimmed = amount_str.trim();

    // Handle mixed numbers like "1 1/2"
    if let Some(space_pos) = trimmed.find(' ') {
        let whole_part = &trimmed[..space_pos];
        let fraction_part = &trimmed[space_pos + 1..];

        let whole = whole_part.parse::<f64>().unwrap_or(0.0);
        let fraction = parse_simple_fraction(fraction_part);
        return whole + fraction;
    }

    // Handle simple fractions like "1/2"
    if trimmed.contains('/') {
        return parse_simple_fraction(trimmed);
    }

    // Handle unicode fractions
    match trimmed {
        "¼" => 0.25,
        "½" => 0.5,
        "¾" => 0.75,
        "⅓" => 0.333,
        "⅔" => 0.667,
        "⅛" => 0.125,
        "⅜" => 0.375,
        "⅝" => 0.625,
        "⅞" => 0.875,
        _ => trimmed.parse::<f64>().unwrap_or(1.0)
    }
}

/// Parse simple fractions like "1/2"
fn parse_simple_fraction(fraction_str: &str) -> f64 {
    if let Some(slash_pos) = fraction_str.find('/') {
        let numerator = fraction_str[..slash_pos].parse::<f64>().unwrap_or(1.0);
        let denominator = fraction_str[slash_pos + 1..].parse::<f64>().unwrap_or(1.0);
        if denominator != 0.0 {
            return numerator / denominator;
        }
    }
    1.0
}

/// Normalize unit names to standard forms
fn normalize_unit(unit: &str) -> String {
    match unit.to_lowercase().as_str() {
        "cup" | "cups" | "c" => "cup".to_string(),
        "tablespoon" | "tablespoons" | "tbsp" | "tbs" => "tbsp".to_string(),
        "teaspoon" | "teaspoons" | "tsp" => "tsp".to_string(),
        "pound" | "pounds" | "lb" => "lb".to_string(),
        "ounce" | "ounces" | "oz" => "oz".to_string(),
        "gram" | "grams" | "g" => "g".to_string(),
        "kilogram" | "kilograms" | "kg" => "kg".to_string(),
        "liter" | "liters" | "l" => "liter".to_string(),
        "milliliter" | "milliliters" | "ml" => "ml".to_string(),
        "pint" | "pints" | "pt" => "pint".to_string(),
        "quart" | "quarts" | "qt" => "quart".to_string(),
        "gallon" | "gallons" | "gal" => "gallon".to_string(),
        "clove" | "cloves" => "clove".to_string(),
        "slice" | "slices" => "slice".to_string(),
        "piece" | "pieces" => "piece".to_string(),
        "can" | "cans" => "can".to_string(),
        "package" | "packages" => "package".to_string(),
        "jar" | "jars" => "jar".to_string(),
        "bottle" | "bottles" => "bottle".to_string(),
        _ => unit.to_string(),
    }
}

/// Clean ingredient name by removing preparation instructions
fn clean_ingredient_name(name: &str) -> String {
    let mut cleaned = name.trim().to_string();

    // Remove preparation instructions after commas
    if let Some(comma_pos) = cleaned.find(',') {
        cleaned = cleaned[..comma_pos].trim().to_string();
    }

    // Remove "to taste" and similar phrases
    cleaned = regex::Regex::new(r"\s*,?\s*(to\s+taste|or\s+to\s+taste|as\s+needed|or\s+as\s+needed|divided)$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    // Remove parenthetical content
    cleaned = regex::Regex::new(r"\s*\([^)]*\)\s*")
        .unwrap()
        .replace_all(&cleaned, " ")
        .to_string();

    // Clean up whitespace
    cleaned = regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string();

    cleaned
}

/// Check if ingredient should use empty unit (for count-based items)
fn should_use_empty_unit(name: &str) -> bool {
    let lower_name = name.to_lowercase();
    let count_based = [
        "egg", "eggs", "onion", "onions", "apple", "apples", "banana", "bananas",
        "lemon", "lemons", "lime", "limes", "orange", "oranges", "potato", "potatoes",
        "tomato", "tomatoes", "carrot", "carrots", "clove", "cloves"
    ];

    count_based.iter().any(|&item| lower_name.contains(item))
}

/// Validate that an ingredient name is reasonable (reused from recipe_import.rs)
fn is_valid_ingredient_name(name: &str) -> bool {
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
        "halved", "quartered", "peeled", "seeded", "trimmed",
        "or more to taste", "or as needed", "to taste", "as needed"
    ];

    let lower_name = trimmed.to_lowercase();
    if invalid_names.iter().any(|&invalid| lower_name == invalid) {
        return false;
    }

    true
}

// Conversion functions
fn convert_frontend_to_db_recipe(frontend: FrontendRecipe) -> DbRecipe {
    use chrono::{DateTime, Utc};
    
    let ingredients = frontend.ingredients.into_iter().map(|ing| DbIngredient {
        name: ing.name,
        amount: ing.amount.to_string(),
        unit: ing.unit,
        category: None,
        section: ing.section,
    }).collect();
    
    let date_added = DateTime::parse_from_rfc3339(&frontend.date_added)
        .unwrap_or_else(|_| Utc::now().into())
        .with_timezone(&Utc);
    let date_modified = DateTime::parse_from_rfc3339(&frontend.date_modified)
        .unwrap_or_else(|_| Utc::now().into())
        .with_timezone(&Utc);
    
    DbRecipe {
        id: frontend.id,
        title: frontend.title,
        description: frontend.description,
        image: frontend.image,
        source_url: frontend.source_url,
        prep_time: frontend.prep_time,
        cook_time: frontend.cook_time,
        total_time: frontend.total_time,
        servings: frontend.servings as i32,
        ingredients,
        instructions: frontend.instructions,
        tags: frontend.tags,
        date_added,
        date_modified,
        rating: frontend.rating.map(|r| r as i32),
        difficulty: frontend.difficulty,
        is_favorite: frontend.is_favorite,
        personal_notes: frontend.personal_notes,
        collections: frontend.collections.unwrap_or_default(),
        nutritional_info: None,
    }
}

fn convert_db_to_frontend_recipe(db: DbRecipe) -> FrontendRecipe {
    let ingredients = db.ingredients.into_iter().map(|ing| FrontendIngredient {
        name: ing.name,
        amount: ing.amount.parse().unwrap_or(1.0),
        unit: ing.unit,
        section: ing.section,
    }).collect();
    
    FrontendRecipe {
        id: db.id,
        title: db.title,
        description: db.description,
        image: db.image,
        source_url: db.source_url,
        prep_time: db.prep_time,
        cook_time: db.cook_time,
        total_time: db.total_time,
        servings: db.servings as u32,
        ingredients,
        instructions: db.instructions,
        tags: db.tags,
        date_added: db.date_added.to_rfc3339(),
        date_modified: db.date_modified.to_rfc3339(),
        rating: db.rating.map(|r| r as u32),
        difficulty: db.difficulty,
        is_favorite: db.is_favorite,
        personal_notes: db.personal_notes,
        collections: Some(db.collections),
    }
}

#[tauri::command]
async fn start_batch_import(
    app: tauri::AppHandle,
    request: BatchImportRequest,
    state: tauri::State<'_, BatchImporterMap>,
) -> Result<String, String> {
    let import_id = uuid::Uuid::new_v4().to_string();
    let importer = Arc::new(BatchImporter::new());

    // Store the importer in global state
    {
        let mut importers = state.lock().unwrap();
        importers.insert(import_id.clone(), importer.clone());
    }

    // Start the import in a background task
    let importer_clone = importer.clone();
    let import_id_clone = import_id.clone();
    let state_clone = state.inner().clone();

    tokio::spawn(async move {
        let _result = importer_clone.start_batch_import(app, request).await;

        // Keep the importer in state for a short time after completion
        // to allow the frontend to fetch final progress before cleanup
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

        // Clean up the importer from state after delay
        {
            let mut importers = state_clone.lock().unwrap();
            importers.remove(&import_id_clone);
        }
    });

    Ok(import_id)
}

// Helper function to capture raw ingredients for analysis
async fn capture_raw_ingredients(
    db: &Database,
    imported_recipe: &ImportedRecipe,
    recipe_id: Option<&str>,
) -> Result<(), anyhow::Error> {
    let now = chrono::Utc::now();
    let mut raw_ingredients = Vec::new();

    for raw_text in &imported_recipe.ingredients {
        let raw_ingredient = RawIngredient {
            id: uuid::Uuid::new_v4().to_string(),
            raw_text: raw_text.clone(),
            source_url: imported_recipe.source_url.clone(),
            recipe_id: recipe_id.map(|id| id.to_string()),
            recipe_title: Some(imported_recipe.name.clone()),
            date_captured: now,
        };
        raw_ingredients.push(raw_ingredient);
    }

    if !raw_ingredients.is_empty() {
        db.save_raw_ingredients_batch(&raw_ingredients).await?;
    }

    Ok(())
}

// Raw ingredients commands
#[tauri::command]
async fn db_get_raw_ingredients_by_source(
    app: tauri::AppHandle,
    source_url: String,
) -> Result<Vec<RawIngredient>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let raw_ingredients = db.get_raw_ingredients_by_source(&source_url).await.map_err(|e| e.to_string())?;
    Ok(raw_ingredients)
}

#[tauri::command]
async fn db_get_raw_ingredients_count(app: tauri::AppHandle) -> Result<i64, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let count = db.get_raw_ingredients_count().await.map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
async fn get_batch_import_progress(
    import_id: String,
    state: tauri::State<'_, BatchImporterMap>,
) -> Result<BatchImportProgress, String> {
    let importers = state.lock().unwrap();

    if let Some(importer) = importers.get(&import_id) {
        Ok(importer.get_progress())
    } else {
        Err("Import session not found".to_string())
    }
}

#[tauri::command]
async fn cancel_batch_import(
    import_id: String,
    state: tauri::State<'_, BatchImporterMap>,
) -> Result<(), String> {
    let importers = state.lock().unwrap();

    if let Some(importer) = importers.get(&import_id) {
        importer.cancel();
        Ok(())
    } else {
        Err("Import session not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let batch_importers: BatchImporterMap = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(batch_importers)
        .invoke_handler(tauri::generate_handler![
            import_recipe,
            download_recipe_image,
            get_local_image,
            delete_recipe_image,
            save_imported_recipe,
            start_batch_import,
            get_batch_import_progress,
            cancel_batch_import,
            db_save_recipe,
            db_get_all_recipes,
            db_get_recipes_paginated,
            db_get_recipe_count,
            db_search_recipes_paginated,
            db_search_recipes_count,
            db_get_recipe_by_id,
            db_delete_recipe,
            db_search_recipes,
            db_get_recipes_by_tag,
            db_get_favorite_recipes,
            db_get_existing_recipe_urls,
            db_migrate_json_recipes,
            db_save_ingredient,
            db_get_all_ingredients,
            db_delete_ingredient,
            db_search_ingredients,
            db_save_pantry_item,
            db_get_all_pantry_items,
            db_delete_pantry_item,
            db_save_recipe_collection,
            db_get_all_recipe_collections,
            db_delete_recipe_collection,
            db_save_search_history,
            db_get_recent_searches,
            db_delete_search_history,
            db_clear_search_history,
            db_get_raw_ingredients_by_source,
            db_get_raw_ingredients_count
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
