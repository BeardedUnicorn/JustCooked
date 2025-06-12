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

/// Parse ingredient string into structured format with comprehensive pattern matching
fn parse_ingredient_string(ingredient_text: &str, section: Option<String>) -> Option<FrontendIngredient> {
    let trimmed = ingredient_text.trim();

    // Skip empty or invalid ingredients
    if trimmed.is_empty() || !is_valid_ingredient_name(trimmed) {
        return None;
    }

    // Enhanced regex patterns to handle all identified formats from CSV analysis
    let patterns = [
        // Pattern 1: Parenthetical amounts like "1 (15 oz) can tomatoes" or "(15 oz) can tomatoes"
        r"^(?:(\d+(?:\s+\d+\/\d+|\.\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?)\s+)?\(([^)]+)\)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 2: Mixed numbers like "1 1/2 tablespoons olive oil"
        r"^(\d+\s+\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 3: Simple fractions like "1/2 cup flour"
        r"^(\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 4: Ranges like "2-3 cups flour" or "1 to 2 pounds"
        r"^(\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*\d+(?:\.\d+)?)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 5: Decimal amounts like "1.5 cups flour" or "0.25 teaspoon salt"
        r"^(\d*\.?\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 6: Unicode fractions like "½ cup flour"
        r"^([¼½¾⅓⅔⅛⅜⅝⅞])\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 7: Count-based with descriptors like "2 large eggs" or "3 medium onions"
        r"^(\d+(?:\.\d+)?)\s+(large|medium|small|whole|fresh|dried|frozen|cooked)\s+(.+?)(?:,\s*(.+))?$",

        // Pattern 8: Simple count like "2 onions" or "3 apples"
        r"^(\d+(?:\.\d+)?)\s+(.+?)(?:,\s*(.+))?$",
    ];

    for (i, pattern) in patterns.iter().enumerate() {
        if let Ok(regex) = regex::Regex::new(pattern) {
            if let Some(captures) = regex.captures(trimmed) {
                let (amount, unit, name, preparation) = if i == 0 {
                    // Handle parenthetical amounts (Pattern 1)
                    let count = captures.get(1).map(|m| m.as_str()).unwrap_or("1");
                    let paren_content = captures.get(2)?.as_str();
                    let container_type = captures.get(3)?.as_str();
                    let ingredient_name = captures.get(4)?.as_str();
                    let prep = captures.get(5).map(|m| m.as_str()).unwrap_or("");

                    let amount = parse_enhanced_amount(count);
                    let unit = extract_unit_from_parenthetical(paren_content, container_type);

                    // For parenthetical amounts, preserve the full description
                    let full_name = if prep.is_empty() {
                        format!("{} {}", container_type, ingredient_name)
                    } else {
                        format!("{} {}, {}", container_type, ingredient_name, prep)
                    };

                    (amount, unit, full_name, String::new())
                } else {
                    // Handle other patterns (2-8)
                    let amount_str = captures.get(1)?.as_str();
                    let second_capture = captures.get(2)?.as_str();
                    let third_capture = captures.get(3)?.as_str();
                    let prep = captures.get(4).map(|m| m.as_str()).unwrap_or("");

                    let amount = parse_enhanced_amount(amount_str);

                    // Determine if second capture is a unit or descriptor
                    let (unit, name) = if is_measurement_unit(second_capture) {
                        (normalize_unit(second_capture), third_capture.to_string())
                    } else {
                        // It's a descriptor like "large", "medium", etc.
                        let combined_name = format!("{} {}", second_capture, third_capture);
                        let unit = if should_use_empty_unit(&combined_name) {
                            String::new()
                        } else {
                            "unit".to_string()
                        };
                        (unit, combined_name)
                    };

                    (amount, unit, name, prep.to_string())
                };

                let cleaned_name = clean_ingredient_name(&name);
                let final_name = if !preparation.is_empty() && should_include_preparation(&cleaned_name, &preparation) {
                    format!("{}, {}", cleaned_name, preparation)
                } else {
                    cleaned_name
                };

                if !final_name.is_empty() && is_valid_ingredient_name(&final_name) {
                    return Some(FrontendIngredient {
                        name: final_name,
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
        let unit = if should_use_empty_unit(&cleaned_name) { String::new() } else { "unit".to_string() };
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

/// Enhanced amount parsing with comprehensive format support
fn parse_enhanced_amount(amount_str: &str) -> f64 {
    let trimmed = amount_str.trim();

    // Handle ranges like "2-3" or "1 to 2" - take the average
    if let Some(captures) = regex::Regex::new(r"^(\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?)$").unwrap().captures(trimmed) {
        let start = captures.get(1).unwrap().as_str().parse::<f64>().unwrap_or(1.0);
        let end = captures.get(2).unwrap().as_str().parse::<f64>().unwrap_or(1.0);
        return (start + end) / 2.0;
    }

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

    // Handle unicode fractions with more precision
    match trimmed {
        "¼" => 0.25,
        "½" => 0.5,
        "¾" => 0.75,
        "⅓" => 1.0/3.0,
        "⅔" => 2.0/3.0,
        "⅛" => 0.125,
        "⅜" => 0.375,
        "⅝" => 0.625,
        "⅞" => 0.875,
        _ => {
            // Handle decimal numbers, including those with precision issues from CSV
            let cleaned = trimmed.replace(",", ""); // Remove any commas
            cleaned.parse::<f64>().unwrap_or(1.0)
        }
    }
}

/// Parse fraction strings to decimal (kept for backward compatibility)
fn parse_fraction_to_decimal(amount_str: &str) -> f64 {
    parse_enhanced_amount(amount_str)
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

/// Enhanced unit normalization with comprehensive support
fn normalize_unit(unit: &str) -> String {
    let lower = unit.to_lowercase();
    match lower.as_str() {
        // Volume measurements
        "cup" | "cups" | "c" => "cup".to_string(),
        "tablespoon" | "tablespoons" | "tbsp" | "tbs" => "tbsp".to_string(),
        "teaspoon" | "teaspoons" | "tsp" => "tsp".to_string(),
        "pint" | "pints" | "pt" => "pint".to_string(),
        "quart" | "quarts" | "qt" => "quart".to_string(),
        "gallon" | "gallons" | "gal" => "gallon".to_string(),
        "liter" | "liters" | "l" => "liter".to_string(),
        "milliliter" | "milliliters" | "ml" => "ml".to_string(),
        "fluid ounce" | "fluid ounces" | "fl oz" => "fl oz".to_string(),

        // Weight measurements
        "pound" | "pounds" | "lb" => "lb".to_string(),
        "ounce" | "ounces" | "oz" => "oz".to_string(),
        "gram" | "grams" | "g" => "g".to_string(),
        "kilogram" | "kilograms" | "kg" => "kg".to_string(),

        // Count-based units
        "clove" | "cloves" => "clove".to_string(),
        "slice" | "slices" => "slice".to_string(),
        "piece" | "pieces" => "piece".to_string(),
        "head" | "heads" => "head".to_string(),
        "bunch" | "bunches" => "bunch".to_string(),
        "stalk" | "stalks" => "stalk".to_string(),
        "sprig" | "sprigs" => "sprig".to_string(),
        "leaf" | "leaves" => "leaf".to_string(),

        // Container units
        "can" | "cans" => "can".to_string(),
        "package" | "packages" => "package".to_string(),
        "jar" | "jars" => "jar".to_string(),
        "bottle" | "bottles" => "bottle".to_string(),
        "box" | "boxes" => "box".to_string(),
        "bag" | "bags" => "bag".to_string(),
        "container" | "containers" => "container".to_string(),

        // Size descriptors
        "large" => "large".to_string(),
        "medium" => "medium".to_string(),
        "small" => "small".to_string(),
        "whole" => "whole".to_string(),
        "fresh" => "fresh".to_string(),
        "dried" => "dried".to_string(),
        "frozen" => "frozen".to_string(),

        _ => unit.to_string()
    }
}

/// Check if a string represents a measurement unit
fn is_measurement_unit(text: &str) -> bool {
    let lower = text.to_lowercase();
    let units = [
        // Volume
        "cup", "cups", "c", "tablespoon", "tablespoons", "tbsp", "tbs",
        "teaspoon", "teaspoons", "tsp", "pint", "pints", "pt",
        "quart", "quarts", "qt", "gallon", "gallons", "gal",
        "liter", "liters", "l", "milliliter", "milliliters", "ml",
        "fluid ounce", "fluid ounces", "fl oz",

        // Weight
        "pound", "pounds", "lb", "ounce", "ounces", "oz",
        "gram", "grams", "g", "kilogram", "kilograms", "kg",

        // Count/Container
        "clove", "cloves", "slice", "slices", "piece", "pieces",
        "head", "heads", "bunch", "bunches", "stalk", "stalks",
        "sprig", "sprigs", "leaf", "leaves", "can", "cans",
        "package", "packages", "jar", "jars", "bottle", "bottles",
        "box", "boxes", "bag", "bags", "container", "containers"
    ];

    units.iter().any(|&unit| lower == unit)
}

/// Extract unit from parenthetical content like "(15 oz)" combined with container type
fn extract_unit_from_parenthetical(paren_content: &str, container_type: &str) -> String {
    // Extract the unit from parenthetical content
    let paren_unit = if let Some(captures) = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*([a-zA-Z\s]+)").unwrap().captures(paren_content) {
        normalize_unit(captures.get(2).unwrap().as_str().trim())
    } else {
        paren_content.to_string()
    };

    // Combine with container type for full unit description
    format!("{} {}", paren_unit, normalize_unit(container_type))
}

/// Determine if preparation should be included in the ingredient name
fn should_include_preparation(_ingredient_name: &str, preparation: &str) -> bool {
    if preparation.is_empty() {
        return false;
    }

    let prep_lower = preparation.to_lowercase();

    // Include preparation for essential descriptors
    let essential_preparations = [
        "drained", "undrained", "rinsed", "packed", "softened", "melted",
        "room temperature", "cold", "warm", "hot", "frozen", "thawed",
        "cooked", "uncooked", "raw", "fresh", "dried"
    ];

    essential_preparations.iter().any(|&prep| prep_lower.contains(prep))
}

/// Enhanced ingredient name cleaning with comprehensive pattern handling
fn clean_ingredient_name(name: &str) -> String {
    let mut cleaned = name.trim().to_string();

    // Remove brand names and "such as" references
    cleaned = regex::Regex::new(r"\s*\(such as [^)]*\)\s*")
        .unwrap()
        .replace_all(&cleaned, " ")
        .to_string();

    // Remove temperature specifications
    cleaned = regex::Regex::new(r"\s*\(\d+\s*degrees?\s*[FC][^)]*\)\s*")
        .unwrap()
        .replace_all(&cleaned, " ")
        .to_string();

    // Remove "or to taste", "as needed", "divided" etc.
    cleaned = regex::Regex::new(r"\s*,?\s*(or\s+)?to\s+taste\s*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    cleaned = regex::Regex::new(r"\s*,?\s*(or\s+)?as\s+needed\s*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    cleaned = regex::Regex::new(r"\s*,?\s*divided\s*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    // Remove "or more" phrases
    cleaned = regex::Regex::new(r"\s*,?\s*or\s+more.*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    // Remove generic parenthetical content (but preserve essential info)
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

    // If cleaning resulted in empty string, return original
    if cleaned.is_empty() {
        name.trim().to_string()
    } else {
        cleaned
    }
}

/// Enhanced check for count-based ingredients that should use empty unit
fn should_use_empty_unit(name: &str) -> bool {
    let lower_name = name.to_lowercase();
    let count_based = [
        // Fruits
        "apple", "apples", "banana", "bananas", "lemon", "lemons", "lime", "limes",
        "orange", "oranges", "peach", "peaches", "pear", "pears", "cherry", "cherries",
        "strawberry", "strawberries", "avocado", "avocados",

        // Vegetables
        "onion", "onions", "potato", "potatoes", "tomato", "tomatoes", "carrot", "carrots",
        "bell pepper", "bell peppers", "pepper", "peppers", "cucumber", "cucumbers",
        "zucchini", "eggplant", "eggplants", "shallot", "shallots",

        // Proteins
        "egg", "eggs", "chicken breast", "chicken breasts", "chicken thigh", "chicken thighs",
        "drumstick", "drumsticks", "fillet", "fillets", "chop", "chops",

        // Herbs and aromatics
        "clove", "cloves", "bay leaf", "bay leaves", "sprig", "sprigs",

        // Bread and baked goods
        "slice", "slices", "roll", "rolls", "bun", "buns", "tortilla", "tortillas",

        // Other countable items
        "link", "links", "strip", "strips", "piece", "pieces"
    ];

    count_based.iter().any(|&item| {
        // Check for exact matches or if the ingredient name contains the count-based item
        lower_name == item || lower_name.contains(&format!(" {}", item)) || lower_name.starts_with(&format!("{} ", item))
    })
}

/// Enhanced validation for ingredient names with comprehensive filtering
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

    // Must be longer than 1 character (unless it's a single letter ingredient like "a")
    if trimmed.len() == 1 && !trimmed.chars().next().unwrap().is_alphabetic() {
        return false;
    }

    let lower_name = trimmed.to_lowercase();

    // Reject obviously invalid names (preparation methods only)
    let invalid_names = [
        "chopped", "sliced", "diced", "minced", "beaten", "melted", "softened",
        "divided", "taste", "needed", "desired", "optional", "garnish",
        "spray", "cubed", "halved", "quartered", "peeled", "seeded", "trimmed",
        "mashed", "crushed", "ground", "grated", "shredded", "julienned",
        "or more to taste", "or as needed", "to taste", "as needed",
        "for garnish", "for serving", "for dusting", "for rolling"
    ];

    if invalid_names.iter().any(|&invalid| lower_name == invalid) {
        return false;
    }

    // Reject names that are just preparation instructions
    if regex::Regex::new(r"^(finely\s+)?(chopped|diced|sliced|minced|grated|shredded|crushed|ground|beaten|melted|softened|peeled|seeded|trimmed|halved|quartered|mashed|julienned)(\s+.*)?$")
        .unwrap()
        .is_match(&lower_name) {
        return false;
    }

    // Reject names that are just measurements without ingredient
    if regex::Regex::new(r"^[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+\s*(ounce|pound|cup|tablespoon|teaspoon|gram|kilogram|liter|milliliter|inch)\s*$")
        .unwrap()
        .is_match(&lower_name) {
        return false;
    }

    // Reject names that are just "or" alternatives
    if lower_name.starts_with("or ") {
        return false;
    }

    // Reject names that are just brand references
    if regex::Regex::new(r"^such as .+$").unwrap().is_match(&lower_name) {
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
