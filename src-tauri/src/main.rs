#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod recipe_import;
mod image_storage;
mod batch_import;
mod database;

use recipe_import::{import_recipe_from_url, ImportedRecipe};
use image_storage::{download_and_store_image, get_app_data_dir, get_local_image_as_base64, delete_stored_image, StoredImage};
use batch_import::{BatchImporter, BatchImportRequest, BatchImportProgress};
use database::{Database, Recipe as DbRecipe, Ingredient as DbIngredient, NutritionalInfo};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::fs;

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
    let ingredients = imported.ingredients.iter().map(|ingredient_str| {
        // Simple parsing - in a real implementation, you might want more sophisticated parsing
        let parts: Vec<&str> = ingredient_str.splitn(3, ' ').collect();
        let (amount, unit, name) = if parts.len() >= 3 {
            let amount_str = parts[0];
            let amount = amount_str.parse::<f64>().unwrap_or(1.0);
            let unit = parts[1].to_string();
            let name = parts[2..].join(" ");
            (amount, unit, name)
        } else if parts.len() == 2 {
            let amount_str = parts[0];
            let amount = amount_str.parse::<f64>().unwrap_or(1.0);
            let name = parts[1].to_string();
            (amount, "".to_string(), name)
        } else {
            (1.0, "".to_string(), ingredient_str.clone())
        };
        
        FrontendIngredient {
            name,
            amount,
            unit,
        }
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
    let frontend_recipe = convert_imported_recipe_to_frontend(imported_recipe);
    let recipe_id = frontend_recipe.id.clone();
    
    // Get the app local data directory
    let app_local_data_dir = app.path().app_local_data_dir()
        .map_err(|e| format!("Failed to get app local data directory: {}", e))?;
    
    // Create recipes directory path
    let recipes_dir = app_local_data_dir.join("recipes");
    let recipe_file_path = recipes_dir.join(format!("{}.json", recipe_id));
    let index_file_path = recipes_dir.join("index.json");
    
    // Ensure the recipes directory exists
    if !recipes_dir.exists() {
        fs::create_dir_all(&recipes_dir)
            .map_err(|e| format!("Failed to create recipes directory: {}", e))?;
    }
    
    // Write the recipe file
    let recipe_json = serde_json::to_string_pretty(&frontend_recipe)
        .map_err(|e| format!("Failed to serialize recipe: {}", e))?;
    
    fs::write(&recipe_file_path, recipe_json)
        .map_err(|e| format!("Failed to write recipe file: {}", e))?;
    
    // Update the index
    let mut recipes_index: Vec<serde_json::Value> = Vec::new();
    
    // Try to read existing index
    if index_file_path.exists() {
        if let Ok(index_content) = fs::read_to_string(&index_file_path) {
            if let Ok(existing_index) = serde_json::from_str::<Vec<serde_json::Value>>(&index_content) {
                recipes_index = existing_index;
            }
        }
    }
    
    // Create index entry
    let index_entry = serde_json::json!({
        "id": frontend_recipe.id,
        "title": frontend_recipe.title,
        "image": frontend_recipe.image,
        "tags": frontend_recipe.tags,
        "dateAdded": frontend_recipe.date_added,
        "dateModified": frontend_recipe.date_modified,
    });
    
    // Add or update the recipe in the index
    if let Some(existing_index) = recipes_index.iter_mut().find(|r| r["id"] == frontend_recipe.id) {
        *existing_index = index_entry;
    } else {
        recipes_index.push(index_entry);
    }
    
    // Write updated index
    let index_json = serde_json::to_string_pretty(&recipes_index)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;
    
    fs::write(&index_file_path, index_json)
        .map_err(|e| format!("Failed to write index file: {}", e))?;
    
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

// Conversion functions
fn convert_frontend_to_db_recipe(frontend: FrontendRecipe) -> DbRecipe {
    use chrono::{DateTime, Utc};
    
    let ingredients = frontend.ingredients.into_iter().map(|ing| DbIngredient {
        name: ing.name,
        amount: ing.amount.to_string(),
        unit: ing.unit,
        category: None,
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

        // Clean up the importer from state when done
        {
            let mut importers = state_clone.lock().unwrap();
            importers.remove(&import_id_clone);
        }
    });

    Ok(import_id)
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
            db_get_recipe_by_id,
            db_delete_recipe,
            db_search_recipes,
            db_get_recipes_by_tag,
            db_get_favorite_recipes,
            db_get_existing_recipe_urls
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
