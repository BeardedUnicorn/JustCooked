#![allow(non_snake_case)]

use crate::database::{Recipe as DbRecipe, Ingredient as DbIngredient, RawIngredient};
use crate::ingredient_parsing::get_ingredient_parser;
use crate::recipe_import::ImportedRecipe;
use serde::{Deserialize, Serialize};
use tracing::warn;

// Frontend types (these should match the TypeScript types)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendRecipe {
    pub id: String,
    pub title: String,
    pub description: String,
    pub image: String,
    pub source_url: String,
    pub prep_time: String,
    pub cook_time: String,
    pub total_time: String,
    pub servings: u32,
    pub ingredients: Vec<FrontendIngredient>,
    pub instructions: Vec<String>,
    pub tags: Vec<String>,
    pub date_added: String,
    pub date_modified: String,
    pub rating: Option<u32>,
    pub difficulty: Option<String>,
    pub is_favorite: Option<bool>,
    pub personal_notes: Option<String>,
    pub collections: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendIngredient {
    pub name: String,
    pub amount: f64,
    pub unit: String,
    pub section: Option<String>,
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
                // Ingredient crate failed, fallback to simple parsing
                warn!("Ingredient parsing failed for '{}': {}, using fallback", ingredient_text, e);
                // Simple fallback: treat the whole text as ingredient name
                let frontend_ingredient = FrontendIngredient {
                    name: ingredient_text.trim().to_string(),
                    amount: 1.0,
                    unit: "unit".to_string(),
                    section,
                };
                frontend_ingredients.push(frontend_ingredient);
            }
        }
    }

    frontend_ingredients
}

/// Convert imported recipe to frontend format with ingredient parsing
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

/// Convert frontend recipe to database format
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

/// Helper function to capture raw ingredients for analysis
pub async fn capture_raw_ingredients(
    db: &crate::database::Database,
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
