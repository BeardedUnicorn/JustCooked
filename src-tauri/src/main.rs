#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod recipe_import;
mod image_storage;

use recipe_import::{import_recipe_from_url, ImportedRecipe};
use image_storage::{download_and_store_image, get_app_data_dir, get_local_image_as_base64, delete_stored_image, StoredImage};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![import_recipe, download_recipe_image, get_local_image, delete_recipe_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
