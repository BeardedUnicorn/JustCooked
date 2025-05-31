#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::error::Error;
use reqwest::blocking::Client;

#[derive(Serialize, Deserialize)]
struct RecipeData {
    name: String,
    description: Option<String>,
    image: Option<String>,
    prepTime: Option<String>,
    cookTime: Option<String>,
    totalTime: Option<String>,
    recipeYield: Option<String>,
    recipeIngredient: Vec<String>,
    recipeInstructions: Vec<String>,
    keywords: Option<String>,
}

#[tauri::command]
fn scrape_recipe(url: String) -> Result<RecipeData, String> {
    let client = Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36")
        .send()
        .map_err(|e| format!("Failed to fetch recipe: {}", e))?;

    let html = response
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse the HTML and extract structured data
    // Here we'd use a library like scraper or html5ever to parse the HTML
    // For simplicity, I'll return mock data - in a real app you'd parse the actual content

    Ok(RecipeData {
        name: "Mock Recipe".to_string(),
        description: Some("This is a mock recipe for demonstration".to_string()),
        image: Some("https://example.com/image.jpg".to_string()),
        prepTime: Some("15 minutes".to_string()),
        cookTime: Some("30 minutes".to_string()),
        totalTime: Some("45 minutes".to_string()),
        recipeYield: Some("4".to_string()),
        recipeIngredient: vec![
            "2 cups flour".to_string(),
            "1 cup sugar".to_string(),
            "3 eggs".to_string(),
        ],
        recipeInstructions: vec![
            "Mix ingredients".to_string(),
            "Bake at 350°F for 30 minutes".to_string(),
        ],
        keywords: Some("dessert, easy, quick".to_string()),
    })
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![scrape_recipe])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
