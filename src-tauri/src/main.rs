#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod recipe_import;
mod image_storage;
mod batch_import;
mod database;
mod import_queue;
mod logging;
mod ingredient_parsing;
mod parsing_feedback;
mod conversions;

#[cfg(test)]
mod ingredient_parsing_tests;

#[cfg(test)]
mod e2e_tests;

use recipe_import::{import_recipe_from_url, ImportedRecipe};
use image_storage::{download_and_store_image, get_app_data_dir, get_local_image_as_base64, delete_stored_image, StoredImage};
use batch_import::{BatchImporter, BatchImportRequest, BatchImportProgress};
use import_queue::{ImportQueue, ImportQueueStatus};
use database::{Database, Recipe as DbRecipe, Ingredient as DbIngredient, IngredientDatabase, PantryItem, RecipeCollection, RecentSearch, RawIngredient, DatabaseExport, DatabaseImportResult, MealPlan, MealPlanRecipe, ShoppingList, ShoppingListItem, ProductSearchResult, ProductIngredientMapping};
use logging::{log_info, log_warn, log_error, log_debug, get_log_file_path, get_log_directory_path, open_log_directory};
use ingredient_parsing::{get_ingredient_parser, ParsingMetrics};

use parsing_feedback::{ParsingFeedback, ParsingCorrection, FeedbackStatistics, get_parsing_feedback_manager};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};
use tauri::Manager;

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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendMealPlan {
    id: String,
    name: String,
    description: Option<String>,
    start_date: String,
    end_date: String,
    settings: FrontendMealPlanSettings,
    date_created: String,
    date_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendMealPlanSettings {
    enabled_meal_types: Vec<String>,
    default_servings: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendPantryItem {
    id: String,
    name: String,
    amount: f64,
    unit: String,
    category: Option<String>,
    expiry_date: Option<String>,
    location: Option<String>,
    notes: Option<String>,
    date_added: Option<String>,
    date_modified: Option<String>,
    product_code: Option<String>,
    product_name: Option<String>,
    brands: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendMealPlanRecipe {
    id: String,
    meal_plan_id: String,
    recipe_id: String,
    date: String,
    meal_type: String,
    serving_multiplier: f64,
    notes: Option<String>,
    date_created: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendShoppingList {
    id: String,
    meal_plan_id: String,
    name: String,
    date_range_start: String,
    date_range_end: String,
    date_created: String,
    date_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendShoppingListItem {
    id: String,
    shopping_list_id: String,
    ingredient_name: String,
    quantity: f64,
    unit: String,
    category: Option<String>,
    is_checked: bool,
    notes: Option<String>,
    date_created: String,
}

#[tauri::command]
async fn import_recipe(url: String) -> Result<ImportedRecipe, String> {
    info!("Starting recipe import from URL: {}", url);
    match import_recipe_from_url(&url).await {
        Ok(recipe) => {
            info!("Successfully imported recipe: {} from {}", recipe.name, url);
            Ok(recipe)
        },
        Err(e) => {
            error!("Failed to import recipe from {}: {} ({})", url, e.message, e.error_type);
            Err(e.message)
        },
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

/// Parse ingredients using the ingredient crate with fallback to regex parsing
async fn parse_ingredients_with_ingredient_crate(ingredient_strings: &[String]) -> Vec<FrontendIngredient> {
    let parser = get_ingredient_parser();

    let mut frontend_ingredients = Vec::new();

    for ingredient_str in ingredient_strings {
        // Check if ingredient has section information (format: [Section Name] ingredient text)
        let (section, ingredient_text) = if let Some(captures) =
            regex::Regex::new(r"^\[([^\]]+)\]\s*(.+)$")
                .unwrap()
                .captures(ingredient_str)
        {
            (Some(captures[1].to_string()), captures[2].to_string())
        } else {
            (None, ingredient_str.clone())
        };

        // Try parsing with ingredient crate first
        match parser.parse_ingredient(&ingredient_text, section.clone()).await {
            Ok(Some(db_ingredient)) => {
                // Convert database ingredient to frontend format
                let frontend_ingredient = FrontendIngredient {
                    name: db_ingredient.name,
                    amount: db_ingredient.amount.parse().unwrap_or(1.0),
                    unit: db_ingredient.unit,
                    section: db_ingredient.section,
                };
                frontend_ingredients.push(frontend_ingredient);
            }
            Ok(None) => {
                // Ingredient crate returned None (invalid ingredient), skip
                warn!("Ingredient parsing returned None for ingredient: '{}'", ingredient_text);
            }
            Err(e) => {
                // Ingredient crate failed, fallback to regex parsing
                warn!("Ingredient parsing failed for '{}': {}, using fallback", ingredient_text, e);
                if let Some(frontend_ingredient) = parse_ingredient_string_fallback(&ingredient_text, section) {
                    frontend_ingredients.push(frontend_ingredient);
                }
            }
        }
    }

    frontend_ingredients
}

/// Tauri command to parse ingredients using the ingredient crate
#[tauri::command]
async fn parse_ingredients_with_ingredient_crate_command(ingredients: Vec<String>) -> Result<Vec<FrontendIngredient>, String> {
    match parse_ingredients_with_ingredient_crate(&ingredients).await {
        parsed_ingredients => Ok(parsed_ingredients),
    }
}

pub async fn convert_imported_recipe_to_frontend_async(imported: ImportedRecipe) -> FrontendRecipe {
    let recipe_id = uuid::Uuid::new_v4().to_string();
    let current_time = chrono::Utc::now().to_rfc3339();

    // Parse ingredients using ingredient crate with fallback to regex parsing
    let ingredients = parse_ingredients_with_ingredient_crate(&imported.ingredients).await;

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
    info!("Saving imported recipe with ingredient crate parsing: {}", imported_recipe.name);

    // Use ingredient crate-based parsing for better accuracy
    let frontend_recipe = conversions::convert_imported_recipe_to_frontend_async(imported_recipe.clone()).await;
    let recipe_id = frontend_recipe.id.clone();

    // Convert frontend recipe to database recipe and save to database
    let db_recipe = conversions::convert_frontend_to_db_recipe(frontend_recipe);

    // Initialize database and save recipe
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.save_recipe(&db_recipe).await.map_err(|e| e.to_string())?;

    // Capture raw ingredients for analysis
    conversions::capture_raw_ingredients(&db, &imported_recipe, Some(&recipe_id)).await
        .map_err(|e| format!("Failed to capture raw ingredients: {}", e))?;

    info!("Successfully saved recipe with ID: {}", recipe_id);
    Ok(recipe_id)
}

// Global state for batch import
type BatchImporterMap = Arc<Mutex<HashMap<String, Arc<BatchImporter>>>>;

// Global state for import queue
type ImportQueueState = Arc<ImportQueue>;

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
async fn db_recipe_exists_by_url(
    app: tauri::AppHandle,
    source_url: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;

    let exists = db.recipe_exists_by_url(&source_url).await.map_err(|e| e.to_string())?;

    Ok(exists)
}

#[tauri::command]
async fn db_get_recipe_by_url(
    app: tauri::AppHandle,
    source_url: String,
) -> Result<Option<FrontendRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;

    let recipe = db.get_recipe_by_url(&source_url).await.map_err(|e| e.to_string())?;
    let frontend_recipe = recipe.map(convert_db_to_frontend_recipe);

    Ok(frontend_recipe)
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
    item: FrontendPantryItem,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let db_item = convert_frontend_to_db_pantry_item(item);
    db.save_pantry_item(&db_item).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_pantry_items(app: tauri::AppHandle) -> Result<Vec<FrontendPantryItem>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let items = db.get_all_pantry_items().await.map_err(|e| e.to_string())?;
    let frontend_items = items.into_iter().map(convert_db_to_frontend_pantry_item).collect();
    Ok(frontend_items)
}

#[tauri::command]
async fn db_delete_pantry_item(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_pantry_item(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

// Product search commands
#[tauri::command]
async fn db_search_products(
    app: tauri::AppHandle,
    query: String,
    limit: i32,
) -> Result<ProductSearchResult, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let result = db.search_products(&app, &query, limit).await.map_err(|e| e.to_string())?;
    Ok(result)
}

// Product ingredient mapping commands
#[tauri::command]
async fn db_get_product_ingredient_mapping(
    app: tauri::AppHandle,
    product_code: String,
) -> Result<Option<ProductIngredientMapping>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let mapping = db.get_product_ingredient_mapping(&product_code).await.map_err(|e| e.to_string())?;
    Ok(mapping)
}

#[tauri::command]
async fn db_create_product_ingredient_mapping(
    app: tauri::AppHandle,
    product_code: String,
    ingredient_id: String,
) -> Result<ProductIngredientMapping, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let mapping = db.create_product_ingredient_mapping(&product_code, &ingredient_id).await.map_err(|e| e.to_string())?;
    Ok(mapping)
}

#[tauri::command]
async fn db_delete_product_ingredient_mapping(
    app: tauri::AppHandle,
    product_code: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_product_ingredient_mapping(&product_code).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_get_all_product_ingredient_mappings(
    app: tauri::AppHandle,
) -> Result<Vec<ProductIngredientMapping>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let mappings = db.get_all_product_ingredient_mappings().await.map_err(|e| e.to_string())?;
    Ok(mappings)
}

#[tauri::command]
async fn db_create_product(
    app: tauri::AppHandle,
    product: database::Product,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.create_product(&app, &product).await.map_err(|e| e.to_string())?;
    Ok(())
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

/// Parse ingredient string into structured format with comprehensive pattern matching (FALLBACK ONLY)
/// This function should only be used as a fallback when ingredient crate parsing fails
fn parse_ingredient_string_fallback(ingredient_text: &str, section: Option<String>) -> Option<FrontendIngredient> {
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
                    // For AllRecipes format with full words, include the size info in the name
                    let full_name = if paren_content.contains("ounce") || paren_content.contains("pound") || paren_content.contains("gram") {
                        // AllRecipes format: include size info in name
                        if prep.is_empty() {
                            format!("{} {} {}", paren_content, container_type, ingredient_name)
                        } else {
                            format!("{} {} {}, {}", paren_content, container_type, ingredient_name, prep)
                        }
                    } else {
                        // Traditional format: just container and ingredient
                        if prep.is_empty() {
                            format!("{} {}", container_type, ingredient_name)
                        } else {
                            format!("{} {}, {}", container_type, ingredient_name, prep)
                        }
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

    // For AllRecipes format with full words like "ounce", "pound", etc.,
    // the parenthetical amount is descriptive and should be included in the name,
    // so we use just the container type as the unit
    if paren_content.contains("ounce") || paren_content.contains("pound") || paren_content.contains("gram") {
        normalize_unit(container_type)
    } else {
        // For traditional format with abbreviations like "oz", "lb", etc.,
        // combine with container type for full unit description
        format!("{} {}", paren_unit, normalize_unit(container_type))
    }
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
pub fn convert_frontend_to_db_recipe(frontend: FrontendRecipe) -> DbRecipe {
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
pub async fn capture_raw_ingredients(
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

// Database management commands
#[tauri::command]
async fn db_export_database(app: tauri::AppHandle) -> Result<DatabaseExport, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;

    let export_data = db.export_all_data().await.map_err(|e| e.to_string())?;

    Ok(export_data)
}

#[tauri::command]
async fn db_import_database(
    app: tauri::AppHandle,
    data: DatabaseExport,
    replace_existing: bool,
) -> Result<DatabaseImportResult, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;

    let result = db.import_all_data(&data, replace_existing).await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
async fn db_reset_database(app: tauri::AppHandle) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;

    db.reset_all_data().await.map_err(|e| e.to_string())?;

    Ok(())
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

// Import Queue Commands
#[tauri::command]
async fn add_to_import_queue(
    app: tauri::AppHandle,
    description: String,
    request: BatchImportRequest,
    queue_state: tauri::State<'_, ImportQueueState>,
) -> Result<String, String> {
    info!("=== ADD_TO_IMPORT_QUEUE CALLED ===");
    info!("Adding task to import queue: {}", description);
    info!("Request details: start_url={}, max_recipes={:?}, max_depth={:?}, existing_urls_count={}",
          request.start_url, request.max_recipes, request.max_depth,
          request.existing_urls.as_ref().map_or(0, |urls| urls.len()));

    // Debug: Check if queue is processing
    let queue_status = queue_state.get_status();
    info!("Current queue status: processing={}, pending={}, completed={}, failed={}",
          queue_status.is_processing, queue_status.total_pending, queue_status.total_completed, queue_status.total_failed);

    let task_id = queue_state.add_task(description.clone(), request.clone())?;
    info!("Task added with ID: {}", task_id);

    // Start queue processing if not already started
    info!("Starting queue processing for task: {}", task_id);
    let queue_state_clone = queue_state.inner().clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        queue_state_clone.process_queue(app_clone).await;
    });

    info!("add_to_import_queue returning task_id: {}", task_id);
    Ok(task_id)
}

#[tauri::command]
async fn start_queue_processing(
    app: tauri::AppHandle,
    queue_state: tauri::State<'_, ImportQueueState>,
) -> Result<(), String> {
    info!("=== START_QUEUE_PROCESSING CALLED ===");

    let queue_status = queue_state.get_status();
    info!("Current queue status: processing={}, pending={}, completed={}, failed={}",
          queue_status.is_processing, queue_status.total_pending, queue_status.total_completed, queue_status.total_failed);

    if queue_status.total_pending == 0 {
        info!("No pending tasks in queue, nothing to process");
        return Ok(());
    }

    info!("Starting queue processing...");
    let queue_state_clone = queue_state.inner().clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        queue_state_clone.process_queue(app_clone).await;
    });

    info!("Queue processing started");
    Ok(())
}

#[tauri::command]
async fn get_import_queue_status(
    queue_state: tauri::State<'_, ImportQueueState>,
) -> Result<ImportQueueStatus, String> {
    Ok(queue_state.get_status())
}

#[tauri::command]
async fn remove_from_import_queue(
    task_id: String,
    queue_state: tauri::State<'_, ImportQueueState>,
) -> Result<(), String> {
    info!("Removing task from import queue: {}", task_id);
    queue_state.remove_task(&task_id)
}

#[tauri::command]
async fn get_queue_task_progress(
    task_id: String,
    queue_state: tauri::State<'_, ImportQueueState>,
) -> Result<Option<BatchImportProgress>, String> {
    Ok(queue_state.get_task_progress(&task_id))
}

// Meal Planning Commands
#[tauri::command]
async fn db_save_meal_plan(
    app: tauri::AppHandle,
    meal_plan: FrontendMealPlan,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let db_meal_plan = convert_frontend_to_db_meal_plan(meal_plan);
    db.save_meal_plan(&db_meal_plan).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_meal_plans(app: tauri::AppHandle) -> Result<Vec<FrontendMealPlan>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let meal_plans = db.get_all_meal_plans().await.map_err(|e| e.to_string())?;
    let frontend_meal_plans = meal_plans.into_iter().map(convert_db_to_frontend_meal_plan).collect();
    Ok(frontend_meal_plans)
}

#[tauri::command]
async fn db_get_meal_plan_by_id(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<FrontendMealPlan>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let meal_plan = db.get_meal_plan_by_id(&id).await.map_err(|e| e.to_string())?;
    let frontend_meal_plan = meal_plan.map(convert_db_to_frontend_meal_plan);
    Ok(frontend_meal_plan)
}

#[tauri::command]
async fn db_delete_meal_plan(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_meal_plan(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_save_meal_plan_recipe(
    app: tauri::AppHandle,
    meal_plan_recipe: FrontendMealPlanRecipe,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let db_meal_plan_recipe = convert_frontend_to_db_meal_plan_recipe(meal_plan_recipe);
    db.save_meal_plan_recipe(&db_meal_plan_recipe).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_meal_plan_recipes(
    app: tauri::AppHandle,
    meal_plan_id: String,
) -> Result<Vec<FrontendMealPlanRecipe>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let meal_plan_recipes = db.get_meal_plan_recipes(&meal_plan_id).await.map_err(|e| e.to_string())?;
    let frontend_meal_plan_recipes = meal_plan_recipes.into_iter().map(convert_db_to_frontend_meal_plan_recipe).collect();
    Ok(frontend_meal_plan_recipes)
}

#[tauri::command]
async fn db_delete_meal_plan_recipe(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_meal_plan_recipe(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_save_shopping_list(
    app: tauri::AppHandle,
    shopping_list: FrontendShoppingList,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let db_shopping_list = convert_frontend_to_db_shopping_list(shopping_list);
    db.save_shopping_list(&db_shopping_list).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_all_shopping_lists(app: tauri::AppHandle) -> Result<Vec<FrontendShoppingList>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let shopping_lists = db.get_all_shopping_lists().await.map_err(|e| e.to_string())?;
    let frontend_shopping_lists = shopping_lists.into_iter().map(convert_db_to_frontend_shopping_list).collect();
    Ok(frontend_shopping_lists)
}

#[tauri::command]
async fn db_get_shopping_lists_by_meal_plan(
    app: tauri::AppHandle,
    meal_plan_id: String,
) -> Result<Vec<FrontendShoppingList>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let shopping_lists = db.get_shopping_lists_by_meal_plan(&meal_plan_id).await.map_err(|e| e.to_string())?;
    let frontend_shopping_lists = shopping_lists.into_iter().map(convert_db_to_frontend_shopping_list).collect();
    Ok(frontend_shopping_lists)
}

#[tauri::command]
async fn db_get_shopping_list_by_id(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<FrontendShoppingList>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let shopping_list = db.get_shopping_list_by_id(&id).await.map_err(|e| e.to_string())?;
    let frontend_shopping_list = shopping_list.map(convert_db_to_frontend_shopping_list);
    Ok(frontend_shopping_list)
}

#[tauri::command]
async fn db_delete_shopping_list(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_shopping_list(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
async fn db_save_shopping_list_item(
    app: tauri::AppHandle,
    item: FrontendShoppingListItem,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let db_item = convert_frontend_to_db_shopping_list_item(item);
    db.save_shopping_list_item(&db_item).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_get_shopping_list_items(
    app: tauri::AppHandle,
    shopping_list_id: String,
) -> Result<Vec<FrontendShoppingListItem>, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let items = db.get_shopping_list_items(&shopping_list_id).await.map_err(|e| e.to_string())?;
    let frontend_items = items.into_iter().map(convert_db_to_frontend_shopping_list_item).collect();
    Ok(frontend_items)
}

#[tauri::command]
async fn db_update_shopping_list_item_checked(
    app: tauri::AppHandle,
    id: String,
    is_checked: bool,
) -> Result<(), String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    db.update_shopping_list_item_checked(&id, is_checked).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn db_delete_shopping_list_item(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db = Database::new(&app).await.map_err(|e| e.to_string())?;
    let deleted = db.delete_shopping_list_item(&id).await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

// Conversion functions for meal planning types
fn convert_frontend_to_db_meal_plan(frontend: FrontendMealPlan) -> MealPlan {
    use database::MealPlanSettings;

    MealPlan {
        id: frontend.id,
        name: frontend.name,
        description: frontend.description,
        start_date: frontend.start_date,
        end_date: frontend.end_date,
        settings: MealPlanSettings {
            enabled_meal_types: frontend.settings.enabled_meal_types,
            default_servings: frontend.settings.default_servings,
        },
        date_created: chrono::DateTime::parse_from_rfc3339(&frontend.date_created)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
        date_modified: chrono::DateTime::parse_from_rfc3339(&frontend.date_modified)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
    }
}

fn convert_db_to_frontend_meal_plan(db: MealPlan) -> FrontendMealPlan {
    FrontendMealPlan {
        id: db.id,
        name: db.name,
        description: db.description,
        start_date: db.start_date,
        end_date: db.end_date,
        settings: FrontendMealPlanSettings {
            enabled_meal_types: db.settings.enabled_meal_types,
            default_servings: db.settings.default_servings,
        },
        date_created: db.date_created.to_rfc3339(),
        date_modified: db.date_modified.to_rfc3339(),
    }
}

fn convert_frontend_to_db_meal_plan_recipe(frontend: FrontendMealPlanRecipe) -> MealPlanRecipe {
    MealPlanRecipe {
        id: frontend.id,
        meal_plan_id: frontend.meal_plan_id,
        recipe_id: frontend.recipe_id,
        date: frontend.date,
        meal_type: frontend.meal_type,
        serving_multiplier: frontend.serving_multiplier,
        notes: frontend.notes,
        date_created: chrono::DateTime::parse_from_rfc3339(&frontend.date_created)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
    }
}

fn convert_db_to_frontend_meal_plan_recipe(db: MealPlanRecipe) -> FrontendMealPlanRecipe {
    FrontendMealPlanRecipe {
        id: db.id,
        meal_plan_id: db.meal_plan_id,
        recipe_id: db.recipe_id,
        date: db.date,
        meal_type: db.meal_type,
        serving_multiplier: db.serving_multiplier,
        notes: db.notes,
        date_created: db.date_created.to_rfc3339(),
    }
}

fn convert_frontend_to_db_shopping_list(frontend: FrontendShoppingList) -> ShoppingList {
    ShoppingList {
        id: frontend.id,
        meal_plan_id: frontend.meal_plan_id,
        name: frontend.name,
        date_range_start: frontend.date_range_start,
        date_range_end: frontend.date_range_end,
        date_created: chrono::DateTime::parse_from_rfc3339(&frontend.date_created)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
        date_modified: chrono::DateTime::parse_from_rfc3339(&frontend.date_modified)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
    }
}

fn convert_db_to_frontend_shopping_list(db: ShoppingList) -> FrontendShoppingList {
    FrontendShoppingList {
        id: db.id,
        meal_plan_id: db.meal_plan_id,
        name: db.name,
        date_range_start: db.date_range_start,
        date_range_end: db.date_range_end,
        date_created: db.date_created.to_rfc3339(),
        date_modified: db.date_modified.to_rfc3339(),
    }
}

fn convert_frontend_to_db_shopping_list_item(frontend: FrontendShoppingListItem) -> ShoppingListItem {
    ShoppingListItem {
        id: frontend.id,
        shopping_list_id: frontend.shopping_list_id,
        ingredient_name: frontend.ingredient_name,
        quantity: frontend.quantity,
        unit: frontend.unit,
        category: frontend.category,
        is_checked: frontend.is_checked,
        notes: frontend.notes,
        date_created: chrono::DateTime::parse_from_rfc3339(&frontend.date_created)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .with_timezone(&chrono::Utc),
    }
}

fn convert_db_to_frontend_shopping_list_item(db: ShoppingListItem) -> FrontendShoppingListItem {
    FrontendShoppingListItem {
        id: db.id,
        shopping_list_id: db.shopping_list_id,
        ingredient_name: db.ingredient_name,
        quantity: db.quantity,
        unit: db.unit,
        category: db.category,
        is_checked: db.is_checked,
        notes: db.notes,
        date_created: db.date_created.to_rfc3339(),
    }
}

// Conversion functions for pantry items
fn convert_frontend_to_db_pantry_item(frontend: FrontendPantryItem) -> PantryItem {
    PantryItem {
        id: frontend.id,
        ingredient_name: frontend.name,
        quantity: frontend.amount,
        unit: frontend.unit,
        category: frontend.category,
        expiry_date: frontend.expiry_date,
        location: frontend.location,
        notes: frontend.notes,
        date_added: frontend.date_added.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        date_modified: frontend.date_modified.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        product_code: frontend.product_code,
        product_name: frontend.product_name,
        brands: frontend.brands,
    }
}

fn convert_db_to_frontend_pantry_item(db: PantryItem) -> FrontendPantryItem {
    FrontendPantryItem {
        id: db.id,
        name: db.ingredient_name,
        amount: db.quantity,
        unit: db.unit,
        category: db.category,
        expiry_date: db.expiry_date,
        location: db.location,
        notes: db.notes,
        date_added: Some(db.date_added),
        date_modified: Some(db.date_modified),
        product_code: db.product_code,
        product_name: db.product_name,
        brands: db.brands,
    }
}

#[cfg(test)]
mod pantry_conversion_tests {
    use super::*;
    use crate::database::PantryItem as DbPantryItem;

    #[test]
    fn test_frontend_to_db_conversion() {
        let frontend_item = FrontendPantryItem {
            id: "test-id".to_string(),
            name: "Test Item".to_string(),
            amount: 2.5,
            unit: "cups".to_string(),
            category: Some("baking".to_string()),
            expiry_date: Some("2024-12-31".to_string()),
            location: Some("pantry".to_string()),
            notes: Some("test notes".to_string()),
            date_added: Some("2024-01-01T00:00:00Z".to_string()),
            date_modified: Some("2024-01-01T00:00:00Z".to_string()),
            product_code: Some("123456789012".to_string()),
            product_name: Some("Test Product".to_string()),
            brands: Some("Test Brand".to_string()),
        };

        let db_item = convert_frontend_to_db_pantry_item(frontend_item);

        assert_eq!(db_item.id, "test-id");
        assert_eq!(db_item.ingredient_name, "Test Item");
        assert_eq!(db_item.quantity, 2.5);
        assert_eq!(db_item.unit, "cups");
        assert_eq!(db_item.category, Some("baking".to_string()));
        assert_eq!(db_item.expiry_date, Some("2024-12-31".to_string()));
        assert_eq!(db_item.location, Some("pantry".to_string()));
        assert_eq!(db_item.notes, Some("test notes".to_string()));
        assert_eq!(db_item.date_added, "2024-01-01T00:00:00Z");
        assert_eq!(db_item.date_modified, "2024-01-01T00:00:00Z");
        assert_eq!(db_item.product_code, Some("123456789012".to_string()));
        assert_eq!(db_item.product_name, Some("Test Product".to_string()));
        assert_eq!(db_item.brands, Some("Test Brand".to_string()));
    }

    #[test]
    fn test_db_to_frontend_conversion() {
        let db_item = DbPantryItem {
            id: "db-test-id".to_string(),
            ingredient_name: "DB Test Item".to_string(),
            quantity: 3.0,
            unit: "lbs".to_string(),
            category: Some("produce".to_string()),
            expiry_date: Some("2024-06-30".to_string()),
            location: Some("fridge".to_string()),
            notes: Some("db test notes".to_string()),
            date_added: "2024-01-01T00:00:00Z".to_string(),
            date_modified: "2024-01-02T00:00:00Z".to_string(),
            product_code: Some("987654321098".to_string()),
            product_name: Some("DB Test Product".to_string()),
            brands: Some("DB Test Brand".to_string()),
        };

        let frontend_item = convert_db_to_frontend_pantry_item(db_item);

        assert_eq!(frontend_item.id, "db-test-id");
        assert_eq!(frontend_item.name, "DB Test Item");
        assert_eq!(frontend_item.amount, 3.0);
        assert_eq!(frontend_item.unit, "lbs");
        assert_eq!(frontend_item.category, Some("produce".to_string()));
        assert_eq!(frontend_item.expiry_date, Some("2024-06-30".to_string()));
        assert_eq!(frontend_item.location, Some("fridge".to_string()));
        assert_eq!(frontend_item.notes, Some("db test notes".to_string()));
        assert_eq!(frontend_item.date_added, Some("2024-01-01T00:00:00Z".to_string()));
        assert_eq!(frontend_item.date_modified, Some("2024-01-02T00:00:00Z".to_string()));
        assert_eq!(frontend_item.product_code, Some("987654321098".to_string()));
        assert_eq!(frontend_item.product_name, Some("DB Test Product".to_string()));
        assert_eq!(frontend_item.brands, Some("DB Test Brand".to_string()));
    }

    #[test]
    fn test_round_trip_conversion() {
        let original_frontend = FrontendPantryItem {
            id: "round-trip-id".to_string(),
            name: "Round Trip Item".to_string(),
            amount: 1.25,
            unit: "oz".to_string(),
            category: Some("spices".to_string()),
            expiry_date: Some("2025-01-01".to_string()),
            location: Some("spice rack".to_string()),
            notes: Some("round trip test".to_string()),
            date_added: Some("2024-01-01T00:00:00Z".to_string()),
            date_modified: Some("2024-01-01T00:00:00Z".to_string()),
            product_code: Some("555666777888".to_string()),
            product_name: Some("Round Trip Product".to_string()),
            brands: Some("Round Trip Brand".to_string()),
        };

        // Convert to DB format and back
        let db_item = convert_frontend_to_db_pantry_item(original_frontend.clone());
        let converted_frontend = convert_db_to_frontend_pantry_item(db_item);

        // Should be identical
        assert_eq!(converted_frontend.id, original_frontend.id);
        assert_eq!(converted_frontend.name, original_frontend.name);
        assert_eq!(converted_frontend.amount, original_frontend.amount);
        assert_eq!(converted_frontend.unit, original_frontend.unit);
        assert_eq!(converted_frontend.category, original_frontend.category);
        assert_eq!(converted_frontend.expiry_date, original_frontend.expiry_date);
        assert_eq!(converted_frontend.location, original_frontend.location);
        assert_eq!(converted_frontend.notes, original_frontend.notes);
        assert_eq!(converted_frontend.product_code, original_frontend.product_code);
        assert_eq!(converted_frontend.product_name, original_frontend.product_name);
        assert_eq!(converted_frontend.brands, original_frontend.brands);
    }
}

// Ingredient crate performance monitoring commands
#[tauri::command]
async fn get_parsing_metrics() -> Result<ParsingMetrics, String> {
    let parser = get_ingredient_parser();
    Ok(parser.get_metrics().await)
}



// Parsing feedback commands
#[tauri::command]
async fn submit_parsing_feedback(feedback: ParsingFeedback) -> Result<(), String> {
    let manager = get_parsing_feedback_manager();
    manager.submit_feedback(feedback)
}

#[tauri::command]
async fn get_parsing_feedback_statistics() -> Result<FeedbackStatistics, String> {
    let manager = get_parsing_feedback_manager();
    manager.get_statistics()
}

#[tauri::command]
async fn add_parsing_correction_suggestion(correction: ParsingCorrection) -> Result<(), String> {
    let manager = get_parsing_feedback_manager();
    manager.add_correction_suggestion(correction)
}

#[tauri::command]
async fn get_parsing_correction_suggestions(ingredient_text: String) -> Result<Vec<ParsingCorrection>, String> {
    let manager = get_parsing_feedback_manager();
    manager.get_correction_suggestions(&ingredient_text)
}

#[tauri::command]
async fn clear_parsing_feedback_history() -> Result<(), String> {
    let manager = get_parsing_feedback_manager();
    manager.clear_feedback_history()
}

#[tauri::command]
async fn export_parsing_feedback_data() -> Result<String, String> {
    let manager = get_parsing_feedback_manager();
    manager.export_feedback_data()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let batch_importers: BatchImporterMap = Arc::new(Mutex::new(HashMap::new()));
    let import_queue: ImportQueueState = Arc::new(ImportQueue::new());

    tauri::Builder::default()
        .setup(|app| {
            // Initialize logging system
            let app_data_dir = app.path().app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?;

            if let Err(e) = logging::init_logging(&app_data_dir) {
                eprintln!("Failed to initialize logging: {}", e);
                return Err(format!("Logging initialization failed: {}", e).into());
            }

            // Log application startup
            info!("JustCooked application starting up");
            info!("App data directory: {:?}", app_data_dir);

            // Clean up old log files
            if let Err(e) = logging::cleanup_old_logs(&app_data_dir) {
                warn!("Failed to cleanup old logs: {}", e);
            }

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(batch_importers)
        .manage(import_queue)
        .invoke_handler(tauri::generate_handler![
            import_recipe,
            download_recipe_image,
            get_local_image,
            delete_recipe_image,
            save_imported_recipe,
            parse_ingredients_with_ingredient_crate_command,
            start_batch_import,
            get_batch_import_progress,
            cancel_batch_import,
            add_to_import_queue,
            start_queue_processing,
            get_import_queue_status,
            remove_from_import_queue,
            get_queue_task_progress,
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
            db_recipe_exists_by_url,
            db_get_recipe_by_url,
            db_migrate_json_recipes,
            db_save_ingredient,
            db_get_all_ingredients,
            db_delete_ingredient,
            db_search_ingredients,
            db_save_pantry_item,
            db_get_all_pantry_items,
            db_delete_pantry_item,
            db_search_products,
            db_get_product_ingredient_mapping,
            db_create_product_ingredient_mapping,
            db_delete_product_ingredient_mapping,
            db_get_all_product_ingredient_mappings,
            db_create_product,
            db_save_recipe_collection,
            db_get_all_recipe_collections,
            db_delete_recipe_collection,
            db_save_search_history,
            db_get_recent_searches,
            db_delete_search_history,
            db_clear_search_history,
            db_get_raw_ingredients_by_source,
            db_get_raw_ingredients_count,
            db_export_database,
            db_import_database,
            db_reset_database,
            db_save_meal_plan,
            db_get_all_meal_plans,
            db_get_meal_plan_by_id,
            db_delete_meal_plan,
            db_save_meal_plan_recipe,
            db_get_meal_plan_recipes,
            db_delete_meal_plan_recipe,
            db_save_shopping_list,
            db_get_all_shopping_lists,
            db_get_shopping_lists_by_meal_plan,
            db_get_shopping_list_by_id,
            db_delete_shopping_list,
            db_save_shopping_list_item,
            db_get_shopping_list_items,
            db_update_shopping_list_item_checked,
            db_delete_shopping_list_item,
            log_info,
            log_warn,
            log_error,
            log_debug,
            get_log_file_path,
            get_log_directory_path,
            open_log_directory,
            get_parsing_metrics,
            submit_parsing_feedback,
            get_parsing_feedback_statistics,
            add_parsing_correction_suggestion,
            get_parsing_correction_suggestions,
            clear_parsing_feedback_history,
            export_parsing_feedback_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
