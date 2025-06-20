use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePool, Row, Sqlite, Transaction};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ingredient {
    pub name: String,
    pub amount: String,
    pub unit: String,
    pub category: Option<String>,
    pub section: Option<String>, // Optional section for grouped ingredients
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionalInfo {
    pub calories: Option<f64>,
    pub protein: Option<f64>,
    pub carbs: Option<f64>,
    pub fat: Option<f64>,
    pub fiber: Option<f64>,
    pub sugar: Option<f64>,
    pub sodium: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub title: String,
    pub description: String,
    pub image: String,
    pub source_url: String,
    pub prep_time: String,
    pub cook_time: String,
    pub total_time: String,
    pub servings: i32,
    pub ingredients: Vec<Ingredient>,
    pub instructions: Vec<String>,
    pub tags: Vec<String>,
    pub date_added: DateTime<Utc>,
    pub date_modified: DateTime<Utc>,
    pub rating: Option<i32>,
    pub difficulty: Option<String>,
    pub is_favorite: Option<bool>,
    pub personal_notes: Option<String>,
    pub collections: Vec<String>,
    pub nutritional_info: Option<NutritionalInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngredientDatabase {
    pub id: String,
    pub name: String,
    pub category: String,
    pub aliases: Vec<String>,
    pub date_added: String,
    pub date_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PantryItem {
    pub id: String,
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: String,
    pub category: Option<String>,
    pub expiry_date: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub date_added: String,
    pub date_modified: String,
    pub product_code: Option<String>,
    pub product_name: Option<String>,
    pub brands: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub code: String,
    pub url: String,
    pub product_name: String,
    pub brands: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSearchResult {
    pub products: Vec<Product>,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeCollection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub recipe_ids: Vec<String>,
    pub date_created: String,
    pub date_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawIngredient {
    pub id: String,
    pub raw_text: String,
    pub source_url: String,
    pub recipe_id: Option<String>,
    pub recipe_title: Option<String>,
    pub date_captured: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlan {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub start_date: String, // ISO date string (YYYY-MM-DD)
    pub end_date: String,   // ISO date string (YYYY-MM-DD)
    pub settings: MealPlanSettings,
    pub date_created: DateTime<Utc>,
    pub date_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlanSettings {
    pub enabled_meal_types: Vec<String>, // ["breakfast", "lunch", "dinner", "snacks"]
    pub default_servings: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlanRecipe {
    pub id: String,
    pub meal_plan_id: String,
    pub recipe_id: String,
    pub date: String,      // ISO date string (YYYY-MM-DD)
    pub meal_type: String, // "breakfast", "lunch", "dinner", "snacks"
    pub serving_multiplier: f64, // 1.0 = original servings, 2.0 = double, etc.
    pub notes: Option<String>,
    pub date_created: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingList {
    pub id: String,
    pub meal_plan_id: String,
    pub name: String,
    pub date_range_start: String, // ISO date string (YYYY-MM-DD)
    pub date_range_end: String,   // ISO date string (YYYY-MM-DD)
    pub date_created: DateTime<Utc>,
    pub date_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingListItem {
    pub id: String,
    pub shopping_list_id: String,
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: String,
    pub category: Option<String>,
    pub is_checked: bool,
    pub notes: Option<String>,
    pub date_created: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductIngredientMapping {
    pub id: String,
    pub product_code: String,
    pub ingredient_id: String,
    pub ingredient_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSearch {
    pub id: String,
    pub query: String,
    pub filters: SearchFilters,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub query: Option<String>,
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<Vec<String>>,
    #[serde(rename = "maxPrepTime")]
    pub max_prep_time: Option<i32>,
    #[serde(rename = "maxCookTime")]
    pub max_cook_time: Option<i32>,
    #[serde(rename = "maxTotalTime")]
    pub max_total_time: Option<i32>,
    #[serde(rename = "minRating")]
    pub min_rating: Option<i32>,
    #[serde(rename = "dietaryRestrictions")]
    pub dietary_restrictions: Option<Vec<String>>,
    #[serde(rename = "prepTime")]
    pub prep_time: Option<String>,
    #[serde(rename = "cookTime")]
    pub cook_time: Option<String>,
    #[serde(rename = "totalTime")]
    pub total_time: Option<String>,
    pub servings: Option<Vec<i32>>,
    pub rating: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseExport {
    pub version: String,
    pub export_date: DateTime<Utc>,
    pub recipes: Vec<Recipe>,
    pub ingredients: Vec<IngredientDatabase>,
    pub pantry_items: Vec<PantryItem>,
    pub recipe_collections: Vec<RecipeCollection>,
    pub recent_searches: Vec<RecentSearch>,
    pub raw_ingredients: Vec<RawIngredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DatabaseImportResult {
    pub recipes_imported: i32,
    pub recipes_failed: i32,
    pub ingredients_imported: i32,
    pub ingredients_failed: i32,
    pub pantry_items_imported: i32,
    pub pantry_items_failed: i32,
    pub collections_imported: i32,
    pub collections_failed: i32,
    pub searches_imported: i32,
    pub searches_failed: i32,
    pub raw_ingredients_imported: i32,
    pub raw_ingredients_failed: i32,
    pub errors: Vec<String>,
}

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    #[cfg(test)]
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_data_dir = app_handle
            .path()
            .app_local_data_dir()
            .context("Failed to get app data directory")?;

        tokio::fs::create_dir_all(&app_data_dir)
            .await
            .context("Failed to create app data directory")?;

        let db_path = app_data_dir.join("recipes.db");
        let db_url = format!("sqlite:{}", db_path.to_string_lossy());

        // Ensure the database file exists before connecting
        if !db_path.exists() {
            std::fs::File::create(&db_path)
                .context("Failed to create database file")?;
        }

        let pool = SqlitePool::connect(&db_url)
            .await
            .context("Failed to connect to database")?;

        let db = Self { pool };
        db.migrate().await?;
        Ok(db)
    }

    pub async fn migrate(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                image TEXT NOT NULL,
                source_url TEXT NOT NULL,
                prep_time TEXT NOT NULL,
                cook_time TEXT NOT NULL,
                total_time TEXT NOT NULL,
                servings INTEGER NOT NULL,
                ingredients TEXT NOT NULL, -- JSON array
                instructions TEXT NOT NULL, -- JSON array
                tags TEXT NOT NULL, -- JSON array
                date_added TEXT NOT NULL,
                date_modified TEXT NOT NULL,
                rating INTEGER,
                difficulty TEXT,
                is_favorite BOOLEAN,
                personal_notes TEXT,
                collections TEXT NOT NULL, -- JSON array
                nutritional_info TEXT -- JSON object
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create recipes table")?;

        // Create ingredients table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS ingredients (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                aliases TEXT NOT NULL, -- JSON array
                date_added TEXT NOT NULL,
                date_modified TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create ingredients table")?;

        // Create pantry items table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS pantry_items (
                id TEXT PRIMARY KEY,
                ingredient_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                expiry_date TEXT,
                location TEXT,
                notes TEXT,
                date_added TEXT NOT NULL,
                date_modified TEXT NOT NULL,
                product_code TEXT,
                product_name TEXT,
                brands TEXT
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create pantry_items table")?;

        // Add product columns to existing pantry_items table if they don't exist
        let _ = sqlx::query("ALTER TABLE pantry_items ADD COLUMN product_code TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE pantry_items ADD COLUMN product_name TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE pantry_items ADD COLUMN brands TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE pantry_items ADD COLUMN category TEXT")
            .execute(&self.pool)
            .await;

        // Create recipe collections table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS recipe_collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                recipe_ids TEXT NOT NULL, -- JSON array
                date_created TEXT NOT NULL,
                date_modified TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create recipe_collections table")?;

        // Create search history table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS search_history (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                filters TEXT NOT NULL, -- JSON object
                timestamp TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create search_history table")?;

        // Create raw ingredients table for ingredient parsing analysis
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS raw_ingredients (
                id TEXT PRIMARY KEY,
                raw_text TEXT NOT NULL,
                source_url TEXT NOT NULL,
                recipe_id TEXT,
                recipe_title TEXT,
                date_captured TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create raw_ingredients table")?;

        // Create meal plans table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS meal_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                settings TEXT NOT NULL, -- JSON object
                date_created TEXT NOT NULL,
                date_modified TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create meal_plans table")?;

        // Create meal plan recipes table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS meal_plan_recipes (
                id TEXT PRIMARY KEY,
                meal_plan_id TEXT NOT NULL,
                recipe_id TEXT NOT NULL,
                date TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                serving_multiplier REAL NOT NULL DEFAULT 1.0,
                notes TEXT,
                date_created TEXT NOT NULL,
                FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create meal_plan_recipes table")?;

        // Create shopping lists table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS shopping_lists (
                id TEXT PRIMARY KEY,
                meal_plan_id TEXT NOT NULL,
                name TEXT NOT NULL,
                date_range_start TEXT NOT NULL,
                date_range_end TEXT NOT NULL,
                date_created TEXT NOT NULL,
                date_modified TEXT NOT NULL,
                FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create shopping_lists table")?;

        // Create product ingredient mappings table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS product_ingredient_mappings (
                id TEXT PRIMARY KEY,
                product_code TEXT NOT NULL UNIQUE,
                ingredient_id TEXT NOT NULL,
                ingredient_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create product_ingredient_mappings table")?;

        // Create shopping list items table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS shopping_list_items (
                id TEXT PRIMARY KEY,
                shopping_list_id TEXT NOT NULL,
                ingredient_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                category TEXT,
                is_checked BOOLEAN NOT NULL DEFAULT FALSE,
                notes TEXT,
                date_created TEXT NOT NULL,
                FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create shopping_list_items table")?;

        // Add unique constraint to source_url for existing databases
        // First, check if the constraint already exists by trying to create a unique index
        let _ = sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_source_url_unique ON recipes(source_url)")
            .execute(&self.pool)
            .await; // Ignore errors if constraint already exists or if there are duplicate URLs

        // Create indexes for better performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title)")
            .execute(&self.pool)
            .await
            .context("Failed to create title index")?;

        // Create indexes for meal planning tables
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_meal_plan_recipes_meal_plan_id ON meal_plan_recipes(meal_plan_id)")
            .execute(&self.pool)
            .await
            .context("Failed to create meal_plan_recipes meal_plan_id index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_meal_plan_recipes_date ON meal_plan_recipes(date)")
            .execute(&self.pool)
            .await
            .context("Failed to create meal_plan_recipes date index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_shopping_list_items_shopping_list_id ON shopping_list_items(shopping_list_id)")
            .execute(&self.pool)
            .await
            .context("Failed to create shopping_list_items shopping_list_id index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_recipes_date_added ON recipes(date_added)")
            .execute(&self.pool)
            .await
            .context("Failed to create date_added index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_recipes_is_favorite ON recipes(is_favorite)")
            .execute(&self.pool)
            .await
            .context("Failed to create is_favorite index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name)")
            .execute(&self.pool)
            .await
            .context("Failed to create ingredients name index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pantry_ingredient ON pantry_items(ingredient_name)")
            .execute(&self.pool)
            .await
            .context("Failed to create pantry ingredient index")?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp)")
            .execute(&self.pool)
            .await
            .context("Failed to create search timestamp index")?;

        Ok(())
    }

    pub async fn save_recipe(&self, recipe: &Recipe) -> Result<()> {
        let ingredients_json = serde_json::to_string(&recipe.ingredients)
            .context("Failed to serialize ingredients")?;
        let instructions_json = serde_json::to_string(&recipe.instructions)
            .context("Failed to serialize instructions")?;
        let tags_json = serde_json::to_string(&recipe.tags)
            .context("Failed to serialize tags")?;
        let collections_json = serde_json::to_string(&recipe.collections)
            .context("Failed to serialize collections")?;
        let nutritional_info_json = match &recipe.nutritional_info {
            Some(info) => Some(serde_json::to_string(info).context("Failed to serialize nutritional info")?),
            None => None,
        };

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipes (
                id, title, description, image, source_url, prep_time, cook_time, total_time,
                servings, ingredients, instructions, tags, date_added, date_modified,
                rating, difficulty, is_favorite, personal_notes, collections, nutritional_info
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&recipe.id)
        .bind(&recipe.title)
        .bind(&recipe.description)
        .bind(&recipe.image)
        .bind(&recipe.source_url)
        .bind(&recipe.prep_time)
        .bind(&recipe.cook_time)
        .bind(&recipe.total_time)
        .bind(recipe.servings)
        .bind(&ingredients_json)
        .bind(&instructions_json)
        .bind(&tags_json)
        .bind(recipe.date_added.to_rfc3339())
        .bind(recipe.date_modified.to_rfc3339())
        .bind(recipe.rating)
        .bind(&recipe.difficulty)
        .bind(recipe.is_favorite)
        .bind(&recipe.personal_notes)
        .bind(&collections_json)
        .bind(&nutritional_info_json)
        .execute(&self.pool)
        .await
        .context("Failed to save recipe")?;

        // Auto-detect and save ingredients to the ingredients database
        self.auto_detect_ingredients_from_recipe(recipe).await?;

        Ok(())
    }

    pub async fn get_recipe_by_id(&self, id: &str) -> Result<Option<Recipe>> {
        let row = sqlx::query("SELECT * FROM recipes WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch recipe")?;

        match row {
            Some(row) => Ok(Some(self.row_to_recipe(row)?)),
            None => Ok(None),
        }
    }

    pub async fn get_all_recipes(&self) -> Result<Vec<Recipe>> {
        let rows = sqlx::query("SELECT * FROM recipes ORDER BY date_added DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch all recipes")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn get_recipes_paginated(&self, page: i32, page_size: i32) -> Result<Vec<Recipe>> {
        let offset = (page - 1) * page_size;
        let rows = sqlx::query("SELECT * FROM recipes ORDER BY date_added DESC LIMIT ? OFFSET ?")
            .bind(page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch paginated recipes")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn get_recipe_count(&self) -> Result<i64> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipes")
            .fetch_one(&self.pool)
            .await
            .context("Failed to get recipe count")?;

        Ok(count)
    }

    pub async fn search_recipes_paginated(&self, query: &str, page: i32, page_size: i32) -> Result<Vec<Recipe>> {
        let search_pattern = format!("%{}%", query);
        let offset = (page - 1) * page_size;
        let rows = sqlx::query(
            r#"
            SELECT * FROM recipes 
            WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
            ORDER BY date_added DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .context("Failed to search recipes with pagination")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn search_recipes_count(&self, query: &str) -> Result<i64> {
        let search_pattern = format!("%{}%", query);
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM recipes 
            WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_one(&self.pool)
        .await
        .context("Failed to get search results count")?;

        Ok(count)
    }

    pub async fn delete_recipe(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM recipes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete recipe")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn get_existing_recipe_urls(&self) -> Result<Vec<String>> {
        let rows = sqlx::query("SELECT source_url FROM recipes WHERE source_url != ''")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch recipe URLs")?;

        let urls = rows
            .into_iter()
            .map(|row| row.get::<String, _>("source_url"))
            .filter(|url| !url.trim().is_empty())
            .collect();

        Ok(urls)
    }

    /// Get all recipes that have non-null source URLs for re-import
    pub async fn get_recipes_with_source_urls(&self) -> Result<Vec<Recipe>> {
        let rows = sqlx::query("SELECT * FROM recipes WHERE source_url != '' AND source_url IS NOT NULL ORDER BY date_added DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch recipes with source URLs")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }


    pub async fn recipe_exists_in_transaction(&self, tx: &mut Transaction<'_, Sqlite>, id: &str) -> Result<bool> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipes WHERE id = ?")
            .bind(id)
            .fetch_one(&mut **tx)
            .await
            .context("Failed to check if recipe exists")?;

        Ok(count > 0)
    }

    /// Check if a recipe with the given source URL already exists
    pub async fn recipe_exists_by_url(&self, source_url: &str) -> Result<bool> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipes WHERE source_url = ?")
            .bind(source_url)
            .fetch_one(&self.pool)
            .await
            .context("Failed to check if recipe exists by URL")?;

        Ok(count > 0)
    }

    /// Get recipe by source URL
    pub async fn get_recipe_by_url(&self, source_url: &str) -> Result<Option<Recipe>> {
        let row = sqlx::query("SELECT * FROM recipes WHERE source_url = ?")
            .bind(source_url)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch recipe by URL")?;

        match row {
            Some(row) => Ok(Some(self.row_to_recipe(row)?)),
            None => Ok(None),
        }
    }

    pub async fn migrate_json_recipes(&self, app_handle: &tauri::AppHandle) -> Result<usize> {
        use tokio::fs;

        let app_data_dir = app_handle
            .path()
            .app_local_data_dir()
            .context("Failed to get app data directory")?;

        let recipes_dir = app_data_dir.join("recipes");
        let index_file = recipes_dir.join("index.json");

        // Check if the recipes directory and index file exist
        if !index_file.exists() {
            return Ok(0); // No recipes to migrate
        }

        // Read the index file
        let index_content = fs::read_to_string(&index_file)
            .await
            .context("Failed to read recipes index")?;

        let index_data: Vec<serde_json::Value> = serde_json::from_str(&index_content)
            .context("Failed to parse recipes index")?;

        let mut migrated_count = 0;
        let mut skipped_count = 0;
        let mut error_count = 0;

        // Process recipes in smaller batches to avoid large transactions
        const BATCH_SIZE: usize = 50; // Reduced batch size for better reliability
        
        for chunk in index_data.chunks(BATCH_SIZE) {
            // Retry logic for transaction failures
            let mut retry_count = 0;
            const MAX_RETRIES: usize = 3;
            
            loop {
                let mut tx = match self.begin_transaction().await {
                    Ok(transaction) => transaction,
                    Err(e) => {
                        eprintln!("Failed to begin transaction (attempt {}): {}", retry_count + 1, e);
                        if retry_count >= MAX_RETRIES {
                            return Err(e);
                        }
                        retry_count += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                        continue;
                    }
                };
                
                let mut batch_migrated = 0;
                let mut batch_failed = false;

                for item in chunk {
                    if let Some(recipe_id) = item.get("id").and_then(|v| v.as_str()) {
                        // Check if recipe already exists in database using transaction
                        match self.recipe_exists_in_transaction(&mut tx, recipe_id).await {
                            Ok(exists) if exists => {
                                skipped_count += 1;
                                continue; // Skip existing recipes
                            }
                            Ok(_) => {}, // Recipe doesn't exist, continue processing
                            Err(e) => {
                                eprintln!("Error checking if recipe {} exists: {}", recipe_id, e);
                                error_count += 1;
                                continue;
                            }
                        }

                        // Read the individual recipe file
                        let recipe_file = recipes_dir.join(format!("{}.json", recipe_id));
                        if !recipe_file.exists() {
                            eprintln!("Recipe file not found: {}", recipe_file.display());
                            error_count += 1;
                            continue;
                        }

                        let recipe_content = match fs::read_to_string(&recipe_file).await {
                            Ok(content) => content,
                            Err(e) => {
                                eprintln!("Failed to read recipe file {}: {}", recipe_file.display(), e);
                                error_count += 1;
                                continue;
                            }
                        };

                        let json_recipe: serde_json::Value = match serde_json::from_str(&recipe_content) {
                            Ok(json) => json,
                            Err(e) => {
                                eprintln!("Failed to parse recipe JSON for {}: {}", recipe_id, e);
                                error_count += 1;
                                continue;
                            }
                        };

                        // Convert JSON recipe to database recipe
                        let db_recipe = match self.convert_json_to_db_recipe(json_recipe) {
                            Ok(recipe) => recipe,
                            Err(e) => {
                                eprintln!("Failed to convert recipe {}: {}", recipe_id, e);
                                error_count += 1;
                                continue;
                            }
                        };

                        // Save recipe in transaction
                        match self.save_recipe_in_transaction(&mut tx, &db_recipe).await {
                            Ok(_) => {
                                batch_migrated += 1;
                            }
                            Err(e) => {
                                eprintln!("Failed to save recipe {} in transaction: {}", recipe_id, e);
                                error_count += 1;
                                batch_failed = true;
                                break; // Exit the batch on transaction error
                            }
                        }
                    }
                }

                // Attempt to commit the batch
                if !batch_failed {
                    match tx.commit().await {
                        Ok(_) => {
                            migrated_count += batch_migrated;
                            break; // Success, exit retry loop
                        }
                        Err(e) => {
                            eprintln!("Failed to commit batch transaction (attempt {}): {}", retry_count + 1, e);
                            if retry_count >= MAX_RETRIES {
                                return Err(e.into());
                            }
                            retry_count += 1;
                            tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                            continue; // Retry the entire batch
                        }
                    }
                } else {
                    // Rollback failed transaction
                    let _ = tx.rollback().await;
                    if retry_count >= MAX_RETRIES {
                        eprintln!("Max retries exceeded for batch, skipping...");
                        break;
                    }
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                    continue; // Retry the entire batch
                }
            }
        }

        if error_count > 0 {
            eprintln!("Migration completed with {} errors and {} skipped recipes", error_count, skipped_count);
        }

        Ok(migrated_count)
    }

    fn convert_json_to_db_recipe(&self, json: serde_json::Value) -> Result<Recipe> {
        use chrono::{DateTime, Utc};

        let id = json.get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing recipe id"))?
            .to_string();

        let title = json.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = json.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let image = json.get("image")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let source_url = json.get("sourceUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let prep_time = json.get("prepTime")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let cook_time = json.get("cookTime")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let total_time = json.get("totalTime")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let servings = json.get("servings")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32;

        // Parse ingredients
        let ingredients = json.get("ingredients")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|ing| {
                        let name = ing.get("name")?.as_str()?.to_string();
                        // Handle amount as either string or number
                        let amount = if let Some(amount_str) = ing.get("amount")?.as_str() {
                            amount_str.to_string()
                        } else if let Some(amount_num) = ing.get("amount")?.as_f64() {
                            amount_num.to_string()
                        } else {
                            return None;
                        };
                        let unit = ing.get("unit")?.as_str()?.to_string();
                        Some(Ingredient {
                            name,
                            amount,
                            unit,
                            category: None,
                            section: None,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Parse instructions
        let instructions = json.get("instructions")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        // Parse tags
        let tags = json.get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        // Parse dates
        let default_date = Utc::now().to_rfc3339();
        let date_added_str = json.get("dateAdded")
            .and_then(|v| v.as_str())
            .unwrap_or(default_date.as_str());

        let date_modified_str = json.get("dateModified")
            .and_then(|v| v.as_str())
            .unwrap_or(default_date.as_str());

        let date_added = DateTime::parse_from_rfc3339(date_added_str)
            .unwrap_or_else(|_| Utc::now().into())
            .with_timezone(&Utc);

        let date_modified = DateTime::parse_from_rfc3339(date_modified_str)
            .unwrap_or_else(|_| Utc::now().into())
            .with_timezone(&Utc);

        // Parse optional fields
        let rating = json.get("rating").and_then(|v| v.as_i64()).map(|r| r as i32);
        let difficulty = json.get("difficulty").and_then(|v| v.as_str()).map(|s| s.to_string());
        let is_favorite = json.get("isFavorite").and_then(|v| v.as_bool());
        let personal_notes = json.get("personalNotes").and_then(|v| v.as_str()).map(|s| s.to_string());

        // Parse collections
        let collections = json.get("collections")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        // Parse nutritional info
        let nutritional_info = json.get("nutritionalInfo")
            .and_then(|v| {
                let calories = v.get("calories")?.as_f64();
                let protein = v.get("protein")?.as_f64();
                let carbs = v.get("carbs")?.as_f64();
                let fat = v.get("fat")?.as_f64();
                let fiber = v.get("fiber")?.as_f64();
                let sugar = v.get("sugar")?.as_f64();
                let sodium = v.get("sodium")?.as_f64();

                Some(NutritionalInfo {
                    calories,
                    protein,
                    carbs,
                    fat,
                    fiber,
                    sugar,
                    sodium,
                })
            });

        Ok(Recipe {
            id,
            title,
            description,
            image,
            source_url,
            prep_time,
            cook_time,
            total_time,
            servings,
            ingredients,
            instructions,
            tags,
            date_added,
            date_modified,
            rating,
            difficulty,
            is_favorite,
            personal_notes,
            collections,
            nutritional_info,
        })
    }

    pub async fn search_recipes(&self, query: &str) -> Result<Vec<Recipe>> {
        let search_pattern = format!("%{}%", query);
        let rows = sqlx::query(
            r#"
            SELECT * FROM recipes 
            WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
            ORDER BY date_added DESC
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await
        .context("Failed to search recipes")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn get_recipes_by_tag(&self, tag: &str) -> Result<Vec<Recipe>> {
        let tag_pattern = format!("%\"{}\"%", tag);
        let rows = sqlx::query("SELECT * FROM recipes WHERE tags LIKE ? ORDER BY date_added DESC")
            .bind(&tag_pattern)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch recipes by tag")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn get_favorite_recipes(&self) -> Result<Vec<Recipe>> {
        let rows = sqlx::query("SELECT * FROM recipes WHERE is_favorite = 1 ORDER BY date_added DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch favorite recipes")?;

        let mut recipes = Vec::new();
        for row in rows {
            recipes.push(self.row_to_recipe(row)?);
        }

        Ok(recipes)
    }

    pub async fn begin_transaction(&self) -> Result<Transaction<'_, Sqlite>> {
        self.pool.begin().await.context("Failed to begin transaction")
    }

    pub async fn save_recipe_in_transaction(&self, tx: &mut Transaction<'_, Sqlite>, recipe: &Recipe) -> Result<()> {
        let ingredients_json = serde_json::to_string(&recipe.ingredients)
            .context("Failed to serialize ingredients")?;
        let instructions_json = serde_json::to_string(&recipe.instructions)
            .context("Failed to serialize instructions")?;
        let tags_json = serde_json::to_string(&recipe.tags)
            .context("Failed to serialize tags")?;
        let collections_json = serde_json::to_string(&recipe.collections)
            .context("Failed to serialize collections")?;
        let nutritional_info_json = match &recipe.nutritional_info {
            Some(info) => Some(serde_json::to_string(info).context("Failed to serialize nutritional info")?),
            None => None,
        };

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipes (
                id, title, description, image, source_url, prep_time, cook_time, total_time,
                servings, ingredients, instructions, tags, date_added, date_modified,
                rating, difficulty, is_favorite, personal_notes, collections, nutritional_info
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&recipe.id)
        .bind(&recipe.title)
        .bind(&recipe.description)
        .bind(&recipe.image)
        .bind(&recipe.source_url)
        .bind(&recipe.prep_time)
        .bind(&recipe.cook_time)
        .bind(&recipe.total_time)
        .bind(recipe.servings)
        .bind(&ingredients_json)
        .bind(&instructions_json)
        .bind(&tags_json)
        .bind(recipe.date_added.to_rfc3339())
        .bind(recipe.date_modified.to_rfc3339())
        .bind(recipe.rating)
        .bind(&recipe.difficulty)
        .bind(recipe.is_favorite)
        .bind(&recipe.personal_notes)
        .bind(&collections_json)
        .bind(&nutritional_info_json)
        .execute(&mut **tx)
        .await
        .context("Failed to save recipe in transaction")?;

        Ok(())
    }

    // Ingredient database methods
    pub async fn save_ingredient(&self, ingredient: &IngredientDatabase) -> Result<()> {
        let aliases_json = serde_json::to_string(&ingredient.aliases)
            .context("Failed to serialize aliases")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO ingredients (
                id, name, category, aliases, date_added, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&ingredient.id)
        .bind(&ingredient.name)
        .bind(&ingredient.category)
        .bind(&aliases_json)
        .bind(ingredient.date_added.clone())
        .bind(ingredient.date_modified.clone())
        .execute(&self.pool)
        .await
        .context("Failed to save ingredient")?;

        Ok(())
    }

    pub async fn get_all_ingredients(&self) -> Result<Vec<IngredientDatabase>> {
        let rows = sqlx::query("SELECT * FROM ingredients ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch all ingredients")?;

        let mut ingredients = Vec::new();
        for row in rows {
            ingredients.push(self.row_to_ingredient(row)?);
        }

        Ok(ingredients)
    }

    pub async fn delete_ingredient(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM ingredients WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete ingredient")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn search_ingredients(&self, query: &str) -> Result<Vec<IngredientDatabase>> {
        let search_pattern = format!("%{}%", query);
        let rows = sqlx::query(
            r#"
            SELECT * FROM ingredients 
            WHERE name LIKE ? OR aliases LIKE ?
            ORDER BY name
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await
        .context("Failed to search ingredients")?;

        let mut ingredients = Vec::new();
        for row in rows {
            ingredients.push(self.row_to_ingredient(row)?);
        }

        Ok(ingredients)
    }

    // Pantry database methods
    pub async fn save_pantry_item(&self, item: &PantryItem) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO pantry_items (
                id, ingredient_name, quantity, unit, category, expiry_date, location, notes, date_added, date_modified, product_code, product_name, brands
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&item.id)
        .bind(&item.ingredient_name)
        .bind(item.quantity)
        .bind(&item.unit)
        .bind(&item.category)
        .bind(&item.expiry_date)
        .bind(&item.location)
        .bind(&item.notes)
        .bind(item.date_added.clone())
        .bind(item.date_modified.clone())
        .bind(&item.product_code)
        .bind(&item.product_name)
        .bind(&item.brands)
        .execute(&self.pool)
        .await
        .context("Failed to save pantry item")?;

        Ok(())
    }

    pub async fn get_all_pantry_items(&self) -> Result<Vec<PantryItem>> {
        let rows = sqlx::query("SELECT * FROM pantry_items ORDER BY ingredient_name")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch all pantry items")?;

        let mut items = Vec::new();
        for row in rows {
            items.push(self.row_to_pantry_item(row)?);
        }

        Ok(items)
    }

    pub async fn delete_pantry_item(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM pantry_items WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete pantry item")?;

        Ok(result.rows_affected() > 0)
    }

    // Recipe collection database methods
    pub async fn save_recipe_collection(&self, collection: &RecipeCollection) -> Result<()> {
        let recipe_ids_json = serde_json::to_string(&collection.recipe_ids)
            .context("Failed to serialize recipe IDs")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipe_collections (
                id, name, description, recipe_ids, date_created, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&collection.id)
        .bind(&collection.name)
        .bind(&collection.description)
        .bind(&recipe_ids_json)
        .bind(collection.date_created.clone())
        .bind(collection.date_modified.clone())
        .execute(&self.pool)
        .await
        .context("Failed to save recipe collection")?;

        Ok(())
    }

    pub async fn get_all_recipe_collections(&self) -> Result<Vec<RecipeCollection>> {
        let rows = sqlx::query("SELECT * FROM recipe_collections ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch all recipe collections")?;

        let mut collections = Vec::new();
        for row in rows {
            collections.push(self.row_to_recipe_collection(row)?);
        }

        Ok(collections)
    }

    pub async fn delete_recipe_collection(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM recipe_collections WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete recipe collection")?;

        Ok(result.rows_affected() > 0)
    }

    // Search history database methods
    pub async fn save_search_history(&self, search: &RecentSearch) -> Result<()> {
        let filters_json = serde_json::to_string(&search.filters)
            .context("Failed to serialize search filters")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO search_history (
                id, query, filters, timestamp
            ) VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(&search.id)
        .bind(&search.query)
        .bind(&filters_json)
        .bind(search.timestamp.clone())
        .execute(&self.pool)
        .await
        .context("Failed to save search history")?;

        Ok(())
    }

    pub async fn get_recent_searches(&self, limit: i32) -> Result<Vec<RecentSearch>> {
        let rows = sqlx::query("SELECT * FROM search_history ORDER BY timestamp DESC LIMIT ?")
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch recent searches")?;

        let mut searches = Vec::new();
        for row in rows {
            searches.push(self.row_to_recent_search(row)?);
        }

        Ok(searches)
    }

    pub async fn delete_search_history(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM search_history WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete search history")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn clear_search_history(&self) -> Result<()> {
        sqlx::query("DELETE FROM search_history")
            .execute(&self.pool)
            .await
            .context("Failed to clear search history")?;

        Ok(())
    }

    // Ingredient auto-detection methods
    pub async fn auto_detect_ingredients_from_recipe(&self, recipe: &Recipe) -> Result<()> {
        let ingredient_names: Vec<String> = recipe.ingredients.iter()
            .map(|ingredient| self.clean_ingredient_name(&ingredient.name))
            .collect();

        for name in ingredient_names {
            // Check if ingredient already exists
            let existing = self.find_ingredient_by_name(&name).await?;

            if existing.is_none() {
                // Create new ingredient with auto-detected category
                let category = self.detect_ingredient_category(&name);
                let new_ingredient = IngredientDatabase {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: name.clone(),
                    category,
                    aliases: Vec::new(),
                    date_added: chrono::Utc::now().to_rfc3339(),
                    date_modified: chrono::Utc::now().to_rfc3339(),
                };

                // Save the new ingredient
                self.save_ingredient(&new_ingredient).await?;
            }
        }

        Ok(())
    }

    async fn find_ingredient_by_name(&self, name: &str) -> Result<Option<IngredientDatabase>> {
        let rows = sqlx::query(
            r#"
            SELECT * FROM ingredients
            WHERE LOWER(name) = LOWER(?) OR aliases LIKE ?
            LIMIT 1
            "#,
        )
        .bind(name)
        .bind(format!("%{}%", name.to_lowercase()))
        .fetch_optional(&self.pool)
        .await
        .context("Failed to search for existing ingredient")?;

        match rows {
            Some(row) => Ok(Some(self.row_to_ingredient(row)?)),
            None => Ok(None),
        }
    }

    pub fn clean_ingredient_name(&self, name: &str) -> String {
        let mut cleaned = name.trim().to_string();

        // Remove preparation instructions after commas first
        if let Some(comma_pos) = cleaned.find(',') {
            cleaned = cleaned[..comma_pos].trim().to_string();
        }

        // Remove "to taste" and similar phrases
        cleaned = regex::Regex::new(r"\s*,?\s*(to\s+taste|or\s+to\s+taste|as\s+needed|or\s+as\s+needed|divided)$")
            .unwrap()
            .replace(&cleaned, "")
            .to_string();

        // Remove parenthetical content (like package sizes)
        cleaned = regex::Regex::new(r"\s*\([^)]*\)\s*")
            .unwrap()
            .replace_all(&cleaned, " ")
            .to_string();

        // Remove malformed quantity patterns at the beginning
        cleaned = regex::Regex::new(r"^(ounce|pound|cup|tablespoon|teaspoon|gram|kilogram|liter|milliliter)\)\s+")
            .unwrap()
            .replace(&cleaned, "")
            .to_string();

        // Convert to lowercase for consistency
        cleaned = cleaned.to_lowercase();

        // Remove common descriptive words that aren't part of the core ingredient name
        let words_to_remove = [
            "fresh", "dried", "chopped", "diced", "sliced", "minced", "grated",
            "cooked", "raw", "organic", "large", "small", "medium", "whole",
            "ground", "crushed", "finely", "roughly", "thinly", "thickly",
            "frozen", "canned", "bottled", "packaged", "prepared", "ready",
            "unsalted", "salted", "sweetened", "unsweetened", "light", "heavy",
            "extra", "pure", "natural", "artificial", "homemade", "store-bought"
        ];

        for word in &words_to_remove {
            // Remove word at beginning
            cleaned = regex::Regex::new(&format!(r"^{}\s+", regex::escape(word)))
                .unwrap()
                .replace(&cleaned, "")
                .to_string();
            // Remove word at end
            cleaned = regex::Regex::new(&format!(r"\s+{}$", regex::escape(word)))
                .unwrap()
                .replace(&cleaned, "")
                .to_string();
            // Remove word in middle (with spaces on both sides)
            cleaned = regex::Regex::new(&format!(r"\s+{}\s+", regex::escape(word)))
                .unwrap()
                .replace_all(&cleaned, " ")
                .to_string();
        }

        // Clean up extra whitespace
        cleaned = regex::Regex::new(r"\s+")
            .unwrap()
            .replace_all(&cleaned, " ")
            .trim()
            .to_string();

        // Return original if cleaning results in empty string
        if cleaned.is_empty() {
            name.trim().to_string()
        } else {
            cleaned
        }
    }

    pub fn detect_ingredient_category(&self, name: &str) -> String {
        let name_lower = name.to_lowercase();

        // Vegetables
        let vegetables = [
            "onion", "garlic", "tomato", "carrot", "celery", "bell pepper", "pepper",
            "broccoli", "cauliflower", "spinach", "lettuce", "cucumber", "zucchini",
            "potato", "sweet potato", "corn", "peas", "beans", "mushroom", "cabbage",
            "kale", "arugula", "radish", "beet", "turnip", "parsnip", "leek", "shallot"
        ];

        // Meat & Poultry
        let meat = [
            "chicken", "beef", "pork", "turkey", "lamb", "duck", "bacon", "ham",
            "sausage", "ground beef", "ground turkey", "ground chicken", "steak",
            "roast", "chops", "breast", "thigh", "wing", "drumstick"
        ];

        // Seafood
        let seafood = [
            "salmon", "tuna", "cod", "halibut", "shrimp", "crab", "lobster", "scallops",
            "mussels", "clams", "oysters", "fish", "tilapia", "mahi mahi", "snapper"
        ];

        // Dairy
        let dairy = [
            "milk", "cheese", "butter", "cream", "yogurt", "sour cream", "cottage cheese",
            "cream cheese", "mozzarella", "cheddar", "parmesan", "feta", "ricotta",
            "heavy cream", "half and half", "buttermilk"
        ];

        // Grains & Starches
        let grains = [
            "rice", "pasta", "bread", "flour", "oats", "quinoa", "barley", "wheat",
            "noodles", "spaghetti", "macaroni", "penne", "linguine", "couscous",
            "bulgur", "millet", "buckwheat", "rye", "cornmeal"
        ];

        // Oils & Fats
        let oils = [
            "oil", "olive oil", "vegetable oil", "canola oil", "coconut oil",
            "sesame oil", "avocado oil", "sunflower oil", "peanut oil", "lard",
            "shortening", "margarine"
        ];

        // Herbs & Spices
        let herbs_spices = [
            "salt", "pepper", "basil", "oregano", "thyme", "rosemary", "sage",
            "parsley", "cilantro", "dill", "mint", "chives", "paprika", "cumin",
            "coriander", "cinnamon", "nutmeg", "ginger", "turmeric", "curry",
            "chili", "cayenne", "bay leaf", "vanilla", "cardamom", "cloves"
        ];

        // Fruits
        let fruits = [
            "apple", "banana", "orange", "lemon", "lime", "strawberry", "blueberry",
            "raspberry", "blackberry", "grape", "pineapple", "mango", "peach",
            "pear", "plum", "cherry", "watermelon", "cantaloupe", "honeydew",
            "kiwi", "papaya", "coconut", "avocado"
        ];

        // Check each category
        for vegetable in &vegetables {
            if name_lower.contains(vegetable) {
                return "vegetables".to_string();
            }
        }

        for meat_item in &meat {
            if name_lower.contains(meat_item) {
                return "meat".to_string();
            }
        }

        for seafood_item in &seafood {
            if name_lower.contains(seafood_item) {
                return "seafood".to_string();
            }
        }

        for dairy_item in &dairy {
            if name_lower.contains(dairy_item) {
                return "dairy".to_string();
            }
        }

        for grain in &grains {
            if name_lower.contains(grain) {
                return "grains".to_string();
            }
        }

        for oil in &oils {
            if name_lower.contains(oil) {
                return "oils".to_string();
            }
        }

        for herb_spice in &herbs_spices {
            if name_lower.contains(herb_spice) {
                return "herbs-spices".to_string();
            }
        }

        for fruit in &fruits {
            if name_lower.contains(fruit) {
                return "fruits".to_string();
            }
        }

        // Default category
        "other".to_string()
    }

    // Raw ingredients methods for ingredient parsing analysis
    #[allow(dead_code)]
    pub async fn save_raw_ingredient(&self, raw_ingredient: &RawIngredient) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO raw_ingredients (
                id, raw_text, source_url, recipe_id, recipe_title, date_captured
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&raw_ingredient.id)
        .bind(&raw_ingredient.raw_text)
        .bind(&raw_ingredient.source_url)
        .bind(&raw_ingredient.recipe_id)
        .bind(&raw_ingredient.recipe_title)
        .bind(raw_ingredient.date_captured.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to save raw ingredient")?;

        Ok(())
    }

    pub async fn save_raw_ingredients_batch(&self, raw_ingredients: &[RawIngredient]) -> Result<()> {
        if raw_ingredients.is_empty() {
            return Ok(());
        }

        let mut tx = self.begin_transaction().await?;

        for raw_ingredient in raw_ingredients {
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO raw_ingredients (
                    id, raw_text, source_url, recipe_id, recipe_title, date_captured
                ) VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&raw_ingredient.id)
            .bind(&raw_ingredient.raw_text)
            .bind(&raw_ingredient.source_url)
            .bind(&raw_ingredient.recipe_id)
            .bind(&raw_ingredient.recipe_title)
            .bind(raw_ingredient.date_captured.to_rfc3339())
            .execute(&mut *tx)
            .await
            .context("Failed to save raw ingredient in batch")?;
        }

        tx.commit().await.context("Failed to commit raw ingredients batch")?;
        Ok(())
    }

    pub async fn get_raw_ingredients_by_source(&self, source_url: &str) -> Result<Vec<RawIngredient>> {
        let rows = sqlx::query("SELECT * FROM raw_ingredients WHERE source_url = ? ORDER BY date_captured DESC")
            .bind(source_url)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch raw ingredients by source")?;

        let mut raw_ingredients = Vec::new();
        for row in rows {
            let date_captured_str: String = row.get("date_captured");
            let date_captured = DateTime::parse_from_rfc3339(&date_captured_str)
                .context("Failed to parse date_captured")?
                .with_timezone(&Utc);

            raw_ingredients.push(RawIngredient {
                id: row.get("id"),
                raw_text: row.get("raw_text"),
                source_url: row.get("source_url"),
                recipe_id: row.get("recipe_id"),
                recipe_title: row.get("recipe_title"),
                date_captured,
            });
        }

        Ok(raw_ingredients)
    }

    pub async fn get_raw_ingredients_count(&self) -> Result<i64> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM raw_ingredients")
            .fetch_one(&self.pool)
            .await
            .context("Failed to get raw ingredients count")?;

        Ok(count)
    }

    // Helper methods for row conversion
    fn row_to_ingredient(&self, row: sqlx::sqlite::SqliteRow) -> Result<IngredientDatabase> {
        let aliases_json: String = row.get("aliases");
        let aliases: Vec<String> = serde_json::from_str(&aliases_json)
            .context("Failed to deserialize aliases")?;

        Ok(IngredientDatabase {
            id: row.get("id"),
            name: row.get("name"),
            category: row.get("category"),
            aliases,
            date_added: row.get("date_added"),
            date_modified: row.get("date_modified"),
        })
    }

    fn row_to_pantry_item(&self, row: sqlx::sqlite::SqliteRow) -> Result<PantryItem> {
        Ok(PantryItem {
            id: row.get("id"),
            ingredient_name: row.get("ingredient_name"),
            quantity: row.get("quantity"),
            unit: row.get("unit"),
            category: row.try_get("category").ok(),
            expiry_date: row.get("expiry_date"),
            location: row.get("location"),
            notes: row.get("notes"),
            date_added: row.get("date_added"),
            date_modified: row.get("date_modified"),
            product_code: row.try_get("product_code").ok(),
            product_name: row.try_get("product_name").ok(),
            brands: row.try_get("brands").ok(),
        })
    }

    fn row_to_recipe_collection(&self, row: sqlx::sqlite::SqliteRow) -> Result<RecipeCollection> {
        let recipe_ids_json: String = row.get("recipe_ids");
        let recipe_ids: Vec<String> = serde_json::from_str(&recipe_ids_json)
            .context("Failed to deserialize recipe IDs")?;

        Ok(RecipeCollection {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            recipe_ids,
            date_created: row.get("date_created"),
            date_modified: row.get("date_modified"),
        })
    }

    fn row_to_recent_search(&self, row: sqlx::sqlite::SqliteRow) -> Result<RecentSearch> {
        let filters_json: String = row.get("filters");
        let filters: SearchFilters = serde_json::from_str(&filters_json)
            .context("Failed to deserialize search filters")?;

        Ok(RecentSearch {
            id: row.get("id"),
            query: row.get("query"),
            filters,
            timestamp: row.get("timestamp"),
        })
    }

    fn row_to_recipe(&self, row: sqlx::sqlite::SqliteRow) -> Result<Recipe> {
        let ingredients_json: String = row.get("ingredients");
        let instructions_json: String = row.get("instructions");
        let tags_json: String = row.get("tags");
        let collections_json: String = row.get("collections");
        let nutritional_info_json: Option<String> = row.get("nutritional_info");

        let ingredients: Vec<Ingredient> = serde_json::from_str(&ingredients_json)
            .context("Failed to deserialize ingredients")?;
        let instructions: Vec<String> = serde_json::from_str(&instructions_json)
            .context("Failed to deserialize instructions")?;
        let tags: Vec<String> = serde_json::from_str(&tags_json)
            .context("Failed to deserialize tags")?;
        let collections: Vec<String> = serde_json::from_str(&collections_json)
            .context("Failed to deserialize collections")?;
        let nutritional_info: Option<NutritionalInfo> = match nutritional_info_json {
            Some(json) => Some(serde_json::from_str(&json).context("Failed to deserialize nutritional info")?),
            None => None,
        };

        let date_added_str: String = row.get("date_added");
        let date_modified_str: String = row.get("date_modified");

        let date_added = DateTime::parse_from_rfc3339(&date_added_str)
            .context("Failed to parse date_added")?
            .with_timezone(&Utc);
        let date_modified = DateTime::parse_from_rfc3339(&date_modified_str)
            .context("Failed to parse date_modified")?
            .with_timezone(&Utc);

        Ok(Recipe {
            id: row.get("id"),
            title: row.get("title"),
            description: row.get("description"),
            image: row.get("image"),
            source_url: row.get("source_url"),
            prep_time: row.get("prep_time"),
            cook_time: row.get("cook_time"),
            total_time: row.get("total_time"),
            servings: row.get("servings"),
            ingredients,
            instructions,
            tags,
            date_added,
            date_modified,
            rating: row.get("rating"),
            difficulty: row.get("difficulty"),
            is_favorite: row.get("is_favorite"),
            personal_notes: row.get("personal_notes"),
            collections,
            nutritional_info,
        })
    }

    // Database management methods
    pub async fn export_all_data(&self) -> Result<DatabaseExport> {
        let recipes = self.get_all_recipes().await?;
        let ingredients = self.get_all_ingredients().await?;
        let pantry_items = self.get_all_pantry_items().await?;
        let recipe_collections = self.get_all_recipe_collections().await?;
        let recent_searches = self.get_recent_searches(100).await?; // Get last 100 searches
        let raw_ingredients = self.get_all_raw_ingredients().await?;

        Ok(DatabaseExport {
            version: "1.0".to_string(),
            export_date: chrono::Utc::now(),
            recipes,
            ingredients,
            pantry_items,
            recipe_collections,
            recent_searches,
            raw_ingredients,
        })
    }

    pub async fn import_all_data(&self, data: &DatabaseExport, replace_existing: bool) -> Result<DatabaseImportResult> {
        let mut tx = self.pool.begin().await.context("Failed to start transaction")?;
        let mut result = DatabaseImportResult::default();

        if replace_existing {
            // Clear all tables
            sqlx::query("DELETE FROM recipes").execute(&mut *tx).await.context("Failed to clear recipes")?;
            sqlx::query("DELETE FROM ingredients").execute(&mut *tx).await.context("Failed to clear ingredients")?;
            sqlx::query("DELETE FROM pantry_items").execute(&mut *tx).await.context("Failed to clear pantry_items")?;
            sqlx::query("DELETE FROM recipe_collections").execute(&mut *tx).await.context("Failed to clear recipe_collections")?;
            sqlx::query("DELETE FROM search_history").execute(&mut *tx).await.context("Failed to clear search_history")?;
            sqlx::query("DELETE FROM raw_ingredients").execute(&mut *tx).await.context("Failed to clear raw_ingredients")?;
        }

        // Import recipes
        for recipe in &data.recipes {
            match self.save_recipe_with_transaction(&mut tx, recipe).await {
                Ok(_) => result.recipes_imported += 1,
                Err(e) => {
                    result.recipes_failed += 1;
                    result.errors.push(format!("Recipe '{}': {}", recipe.title, e));
                }
            }
        }

        // Import ingredients
        for ingredient in &data.ingredients {
            match self.save_ingredient_with_transaction(&mut tx, ingredient).await {
                Ok(_) => result.ingredients_imported += 1,
                Err(e) => {
                    result.ingredients_failed += 1;
                    result.errors.push(format!("Ingredient '{}': {}", ingredient.name, e));
                }
            }
        }

        // Import pantry items
        for pantry_item in &data.pantry_items {
            match self.save_pantry_item_with_transaction(&mut tx, pantry_item).await {
                Ok(_) => result.pantry_items_imported += 1,
                Err(e) => {
                    result.pantry_items_failed += 1;
                    result.errors.push(format!("Pantry item '{}': {}", pantry_item.ingredient_name, e));
                }
            }
        }

        // Import recipe collections
        for collection in &data.recipe_collections {
            match self.save_recipe_collection_with_transaction(&mut tx, collection).await {
                Ok(_) => result.collections_imported += 1,
                Err(e) => {
                    result.collections_failed += 1;
                    result.errors.push(format!("Collection '{}': {}", collection.name, e));
                }
            }
        }

        // Import search history
        for search in &data.recent_searches {
            match self.save_search_history_with_transaction(&mut tx, search).await {
                Ok(_) => result.searches_imported += 1,
                Err(e) => {
                    result.searches_failed += 1;
                    result.errors.push(format!("Search '{}': {}", search.query, e));
                }
            }
        }

        // Import raw ingredients
        for raw_ingredient in &data.raw_ingredients {
            match self.save_raw_ingredient_with_transaction(&mut tx, raw_ingredient).await {
                Ok(_) => result.raw_ingredients_imported += 1,
                Err(e) => {
                    result.raw_ingredients_failed += 1;
                    result.errors.push(format!("Raw ingredient: {}", e));
                }
            }
        }

        tx.commit().await.context("Failed to commit transaction")?;
        Ok(result)
    }

    pub async fn reset_all_data(&self) -> Result<()> {
        let mut tx = self.pool.begin().await.context("Failed to start transaction")?;

        // Clear all tables (order matters due to foreign key constraints)
        sqlx::query("DELETE FROM shopping_list_items").execute(&mut *tx).await.context("Failed to clear shopping_list_items")?;
        sqlx::query("DELETE FROM shopping_lists").execute(&mut *tx).await.context("Failed to clear shopping_lists")?;
        sqlx::query("DELETE FROM meal_plan_recipes").execute(&mut *tx).await.context("Failed to clear meal_plan_recipes")?;
        sqlx::query("DELETE FROM meal_plans").execute(&mut *tx).await.context("Failed to clear meal_plans")?;
        sqlx::query("DELETE FROM recipes").execute(&mut *tx).await.context("Failed to clear recipes")?;
        sqlx::query("DELETE FROM ingredients").execute(&mut *tx).await.context("Failed to clear ingredients")?;
        sqlx::query("DELETE FROM pantry_items").execute(&mut *tx).await.context("Failed to clear pantry_items")?;
        sqlx::query("DELETE FROM recipe_collections").execute(&mut *tx).await.context("Failed to clear recipe_collections")?;
        sqlx::query("DELETE FROM search_history").execute(&mut *tx).await.context("Failed to clear search_history")?;
        sqlx::query("DELETE FROM raw_ingredients").execute(&mut *tx).await.context("Failed to clear raw_ingredients")?;

        // Reset SQLite sequence counters
        sqlx::query("DELETE FROM sqlite_sequence").execute(&mut *tx).await.context("Failed to reset sequences")?;

        tx.commit().await.context("Failed to commit transaction")?;
        Ok(())
    }

    // Helper method to get all raw ingredients
    async fn get_all_raw_ingredients(&self) -> Result<Vec<RawIngredient>> {
        let rows = sqlx::query("SELECT * FROM raw_ingredients ORDER BY date_captured DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch raw ingredients")?;

        let mut raw_ingredients = Vec::new();
        for row in rows {
            raw_ingredients.push(RawIngredient {
                id: row.get("id"),
                raw_text: row.get("raw_text"),
                source_url: row.get("source_url"),
                recipe_id: row.get("recipe_id"),
                recipe_title: row.get("recipe_title"),
                date_captured: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_captured"))
                    .context("Failed to parse date_captured")?
                    .with_timezone(&Utc),
            });
        }

        Ok(raw_ingredients)
    }

    // Transaction helper methods
    async fn save_recipe_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, recipe: &Recipe) -> Result<()> {
        let ingredients_json = serde_json::to_string(&recipe.ingredients)
            .context("Failed to serialize ingredients")?;
        let instructions_json = serde_json::to_string(&recipe.instructions)
            .context("Failed to serialize instructions")?;
        let tags_json = serde_json::to_string(&recipe.tags)
            .context("Failed to serialize tags")?;
        let collections_json = serde_json::to_string(&recipe.collections)
            .context("Failed to serialize collections")?;
        let nutritional_info_json = match &recipe.nutritional_info {
            Some(info) => Some(serde_json::to_string(info).context("Failed to serialize nutritional info")?),
            None => None,
        };

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipes (
                id, title, description, image, source_url, prep_time, cook_time, total_time,
                servings, ingredients, instructions, tags, date_added, date_modified,
                rating, difficulty, is_favorite, personal_notes, collections, nutritional_info
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&recipe.id)
        .bind(&recipe.title)
        .bind(&recipe.description)
        .bind(&recipe.image)
        .bind(&recipe.source_url)
        .bind(&recipe.prep_time)
        .bind(&recipe.cook_time)
        .bind(&recipe.total_time)
        .bind(recipe.servings)
        .bind(&ingredients_json)
        .bind(&instructions_json)
        .bind(&tags_json)
        .bind(recipe.date_added.to_rfc3339())
        .bind(recipe.date_modified.to_rfc3339())
        .bind(recipe.rating)
        .bind(&recipe.difficulty)
        .bind(recipe.is_favorite)
        .bind(&recipe.personal_notes)
        .bind(&collections_json)
        .bind(&nutritional_info_json)
        .execute(&mut **tx)
        .await
        .context("Failed to save recipe")?;

        Ok(())
    }

    async fn save_ingredient_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, ingredient: &IngredientDatabase) -> Result<()> {
        let aliases_json = serde_json::to_string(&ingredient.aliases)
            .context("Failed to serialize aliases")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO ingredients (
                id, name, category, aliases, date_added, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&ingredient.id)
        .bind(&ingredient.name)
        .bind(&ingredient.category)
        .bind(&aliases_json)
        .bind(ingredient.date_added.clone())
        .bind(ingredient.date_modified.clone())
        .execute(&mut **tx)
        .await
        .context("Failed to save ingredient")?;

        Ok(())
    }

    async fn save_pantry_item_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, pantry_item: &PantryItem) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO pantry_items (
                id, ingredient_name, quantity, unit, expiry_date, location, notes, date_added, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&pantry_item.id)
        .bind(&pantry_item.ingredient_name)
        .bind(pantry_item.quantity)
        .bind(&pantry_item.unit)
        .bind(&pantry_item.expiry_date)
        .bind(&pantry_item.location)
        .bind(&pantry_item.notes)
        .bind(pantry_item.date_added.clone())
        .bind(pantry_item.date_modified.clone())
        .execute(&mut **tx)
        .await
        .context("Failed to save pantry item")?;

        Ok(())
    }

    async fn save_recipe_collection_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, collection: &RecipeCollection) -> Result<()> {
        let recipe_ids_json = serde_json::to_string(&collection.recipe_ids)
            .context("Failed to serialize recipe IDs")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipe_collections (
                id, name, description, recipe_ids, date_created, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&collection.id)
        .bind(&collection.name)
        .bind(&collection.description)
        .bind(&recipe_ids_json)
        .bind(collection.date_created.clone())
        .bind(collection.date_modified.clone())
        .execute(&mut **tx)
        .await
        .context("Failed to save recipe collection")?;

        Ok(())
    }

    async fn save_search_history_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, search: &RecentSearch) -> Result<()> {
        let filters_json = serde_json::to_string(&search.filters)
            .context("Failed to serialize search filters")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO search_history (
                id, query, filters, timestamp
            ) VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(&search.id)
        .bind(&search.query)
        .bind(&filters_json)
        .bind(search.timestamp.clone())
        .execute(&mut **tx)
        .await
        .context("Failed to save search history")?;

        Ok(())
    }

    async fn save_raw_ingredient_with_transaction(&self, tx: &mut Transaction<'_, Sqlite>, raw_ingredient: &RawIngredient) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO raw_ingredients (
                id, raw_text, source_url, recipe_id, recipe_title, date_captured
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&raw_ingredient.id)
        .bind(&raw_ingredient.raw_text)
        .bind(&raw_ingredient.source_url)
        .bind(&raw_ingredient.recipe_id)
        .bind(&raw_ingredient.recipe_title)
        .bind(raw_ingredient.date_captured.to_rfc3339())
        .execute(&mut **tx)
        .await
        .context("Failed to save raw ingredient")?;

        Ok(())
    }

    // Meal Plan methods
    pub async fn save_meal_plan(&self, meal_plan: &MealPlan) -> Result<()> {
        let settings_json = serde_json::to_string(&meal_plan.settings)
            .context("Failed to serialize meal plan settings")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO meal_plans (
                id, name, description, start_date, end_date, settings, date_created, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&meal_plan.id)
        .bind(&meal_plan.name)
        .bind(&meal_plan.description)
        .bind(&meal_plan.start_date)
        .bind(&meal_plan.end_date)
        .bind(&settings_json)
        .bind(meal_plan.date_created.to_rfc3339())
        .bind(meal_plan.date_modified.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to save meal plan")?;

        Ok(())
    }

    pub async fn get_all_meal_plans(&self) -> Result<Vec<MealPlan>> {
        let rows = sqlx::query("SELECT * FROM meal_plans ORDER BY date_created DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch meal plans")?;

        let mut meal_plans = Vec::new();
        for row in rows {
            let settings_json: String = row.get("settings");
            let settings: MealPlanSettings = serde_json::from_str(&settings_json)
                .context("Failed to deserialize meal plan settings")?;

            meal_plans.push(MealPlan {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                start_date: row.get("start_date"),
                end_date: row.get("end_date"),
                settings,
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
                date_modified: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_modified"))
                    .context("Failed to parse date_modified")?
                    .with_timezone(&Utc),
            });
        }

        Ok(meal_plans)
    }

    pub async fn get_meal_plan_by_id(&self, id: &str) -> Result<Option<MealPlan>> {
        let row = sqlx::query("SELECT * FROM meal_plans WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch meal plan")?;

        if let Some(row) = row {
            let settings_json: String = row.get("settings");
            let settings: MealPlanSettings = serde_json::from_str(&settings_json)
                .context("Failed to deserialize meal plan settings")?;

            Ok(Some(MealPlan {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                start_date: row.get("start_date"),
                end_date: row.get("end_date"),
                settings,
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
                date_modified: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_modified"))
                    .context("Failed to parse date_modified")?
                    .with_timezone(&Utc),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn delete_meal_plan(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM meal_plans WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete meal plan")?;

        Ok(result.rows_affected() > 0)
    }

    // Meal Plan Recipe methods
    pub async fn save_meal_plan_recipe(&self, meal_plan_recipe: &MealPlanRecipe) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO meal_plan_recipes (
                id, meal_plan_id, recipe_id, date, meal_type, serving_multiplier, notes, date_created
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&meal_plan_recipe.id)
        .bind(&meal_plan_recipe.meal_plan_id)
        .bind(&meal_plan_recipe.recipe_id)
        .bind(&meal_plan_recipe.date)
        .bind(&meal_plan_recipe.meal_type)
        .bind(meal_plan_recipe.serving_multiplier)
        .bind(&meal_plan_recipe.notes)
        .bind(meal_plan_recipe.date_created.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to save meal plan recipe")?;

        Ok(())
    }

    pub async fn get_meal_plan_recipes(&self, meal_plan_id: &str) -> Result<Vec<MealPlanRecipe>> {
        let rows = sqlx::query("SELECT * FROM meal_plan_recipes WHERE meal_plan_id = ? ORDER BY date, meal_type")
            .bind(meal_plan_id)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch meal plan recipes")?;

        let mut meal_plan_recipes = Vec::new();
        for row in rows {
            meal_plan_recipes.push(MealPlanRecipe {
                id: row.get("id"),
                meal_plan_id: row.get("meal_plan_id"),
                recipe_id: row.get("recipe_id"),
                date: row.get("date"),
                meal_type: row.get("meal_type"),
                serving_multiplier: row.get("serving_multiplier"),
                notes: row.get("notes"),
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
            });
        }

        Ok(meal_plan_recipes)
    }

    pub async fn delete_meal_plan_recipe(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM meal_plan_recipes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete meal plan recipe")?;

        Ok(result.rows_affected() > 0)
    }

    // Shopping List methods
    pub async fn save_shopping_list(&self, shopping_list: &ShoppingList) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO shopping_lists (
                id, meal_plan_id, name, date_range_start, date_range_end, date_created, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&shopping_list.id)
        .bind(&shopping_list.meal_plan_id)
        .bind(&shopping_list.name)
        .bind(&shopping_list.date_range_start)
        .bind(&shopping_list.date_range_end)
        .bind(shopping_list.date_created.to_rfc3339())
        .bind(shopping_list.date_modified.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to save shopping list")?;

        Ok(())
    }

    pub async fn get_all_shopping_lists(&self) -> Result<Vec<ShoppingList>> {
        let rows = sqlx::query("SELECT * FROM shopping_lists ORDER BY date_created DESC")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch all shopping lists")?;

        let mut shopping_lists = Vec::new();
        for row in rows {
            let shopping_list = ShoppingList {
                id: row.get("id"),
                meal_plan_id: row.get("meal_plan_id"),
                name: row.get("name"),
                date_range_start: row.get("date_range_start"),
                date_range_end: row.get("date_range_end"),
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
                date_modified: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_modified"))
                    .context("Failed to parse date_modified")?
                    .with_timezone(&Utc),
            };
            shopping_lists.push(shopping_list);
        }

        Ok(shopping_lists)
    }

    pub async fn get_shopping_lists_by_meal_plan(&self, meal_plan_id: &str) -> Result<Vec<ShoppingList>> {
        let rows = sqlx::query("SELECT * FROM shopping_lists WHERE meal_plan_id = ? ORDER BY date_created DESC")
            .bind(meal_plan_id)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch shopping lists")?;

        let mut shopping_lists = Vec::new();
        for row in rows {
            shopping_lists.push(ShoppingList {
                id: row.get("id"),
                meal_plan_id: row.get("meal_plan_id"),
                name: row.get("name"),
                date_range_start: row.get("date_range_start"),
                date_range_end: row.get("date_range_end"),
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
                date_modified: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_modified"))
                    .context("Failed to parse date_modified")?
                    .with_timezone(&Utc),
            });
        }

        Ok(shopping_lists)
    }

    pub async fn get_shopping_list_by_id(&self, id: &str) -> Result<Option<ShoppingList>> {
        let row = sqlx::query("SELECT * FROM shopping_lists WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch shopping list")?;

        if let Some(row) = row {
            Ok(Some(ShoppingList {
                id: row.get("id"),
                meal_plan_id: row.get("meal_plan_id"),
                name: row.get("name"),
                date_range_start: row.get("date_range_start"),
                date_range_end: row.get("date_range_end"),
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
                date_modified: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_modified"))
                    .context("Failed to parse date_modified")?
                    .with_timezone(&Utc),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn delete_shopping_list(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM shopping_lists WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete shopping list")?;

        Ok(result.rows_affected() > 0)
    }

    // Shopping List Item methods
    pub async fn save_shopping_list_item(&self, item: &ShoppingListItem) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO shopping_list_items (
                id, shopping_list_id, ingredient_name, quantity, unit, category, is_checked, notes, date_created
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&item.id)
        .bind(&item.shopping_list_id)
        .bind(&item.ingredient_name)
        .bind(item.quantity)
        .bind(&item.unit)
        .bind(&item.category)
        .bind(item.is_checked)
        .bind(&item.notes)
        .bind(item.date_created.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to save shopping list item")?;

        Ok(())
    }

    pub async fn get_shopping_list_items(&self, shopping_list_id: &str) -> Result<Vec<ShoppingListItem>> {
        let rows = sqlx::query("SELECT * FROM shopping_list_items WHERE shopping_list_id = ? ORDER BY category, ingredient_name")
            .bind(shopping_list_id)
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch shopping list items")?;

        let mut items = Vec::new();
        for row in rows {
            items.push(ShoppingListItem {
                id: row.get("id"),
                shopping_list_id: row.get("shopping_list_id"),
                ingredient_name: row.get("ingredient_name"),
                quantity: row.get("quantity"),
                unit: row.get("unit"),
                category: row.get("category"),
                is_checked: row.get("is_checked"),
                notes: row.get("notes"),
                date_created: DateTime::parse_from_rfc3339(&row.get::<String, _>("date_created"))
                    .context("Failed to parse date_created")?
                    .with_timezone(&Utc),
            });
        }

        Ok(items)
    }

    pub async fn update_shopping_list_item_checked(&self, id: &str, is_checked: bool) -> Result<()> {
        sqlx::query("UPDATE shopping_list_items SET is_checked = ? WHERE id = ?")
            .bind(is_checked)
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to update shopping list item checked status")?;

        Ok(())
    }

    pub async fn delete_shopping_list_item(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM shopping_list_items WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to delete shopping list item")?;

        Ok(result.rows_affected() > 0)
    }

    // Product search methods
    pub async fn search_products(&self, app_handle: &AppHandle, query: &str, limit: i32) -> Result<ProductSearchResult> {
        // Get the path to the products database
        let products_db_path = self.get_products_db_path(app_handle).await?;
        
        // Connect to the products database
        let products_pool = SqlitePool::connect(&format!("sqlite:{}", products_db_path.to_string_lossy()))
            .await
            .context("Failed to connect to products database")?;

        let search_pattern = format!("%{}%", query);
        let rows = sqlx::query(
            r#"
            SELECT code, url, product_name, brands FROM products 
            WHERE code LIKE ? OR product_name LIKE ? OR brands LIKE ?
            ORDER BY 
                CASE 
                    WHEN code = ? THEN 1
                    WHEN product_name LIKE ? THEN 2
                    WHEN brands LIKE ? THEN 3
                    ELSE 4
                END,
                product_name
            LIMIT ?
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(query)
        .bind(&format!("{}%", query))
        .bind(&format!("{}%", query))
        .bind(limit)
        .fetch_all(&products_pool)
        .await
        .context("Failed to search products")?;

        let mut products = Vec::new();
        for row in rows {
            products.push(Product {
                code: row.get("code"),
                url: row.get("url"),
                product_name: row.get("product_name"),
                brands: row.get("brands"),
            });
        }

        // Get total count for the search
        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM products 
            WHERE code LIKE ? OR product_name LIKE ? OR brands LIKE ?
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_one(&products_pool)
        .await
        .context("Failed to get products count")?;

        products_pool.close().await;

        Ok(ProductSearchResult {
            products,
            total,
        })
    }

    async fn get_products_db_path(&self, app_handle: &AppHandle) -> Result<std::path::PathBuf> {
        // First try to get the bundled resource path
        if let Ok(resource_path) = app_handle.path().resolve("resources/products.db", tauri::path::BaseDirectory::Resource) {
            if resource_path.exists() {
                return Ok(resource_path);
            }
        }

        // Fallback to development path
        let current_dir = std::env::current_dir().context("Failed to get current directory")?;
        let dev_path = current_dir.join("src-tauri/resources/products.db");
        if dev_path.exists() {
            return Ok(dev_path);
        }

        // Last fallback to original location
        let original_path = current_dir.join("db/products.db");
        if original_path.exists() {
            return Ok(original_path);
        }

        Err(anyhow::anyhow!("Products database not found"))
    }

    // Product Ingredient Mapping methods
    pub async fn get_product_ingredient_mapping(&self, product_code: &str) -> Result<Option<ProductIngredientMapping>> {
        let row = sqlx::query(
            r#"
            SELECT id, product_code, ingredient_id, ingredient_name, created_at, updated_at
            FROM product_ingredient_mappings
            WHERE product_code = ?
            "#,
        )
        .bind(product_code)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to get product ingredient mapping")?;

        if let Some(row) = row {
            let created_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                .context("Failed to parse created_at")?
                .with_timezone(&Utc);
            let updated_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                .context("Failed to parse updated_at")?
                .with_timezone(&Utc);

            Ok(Some(ProductIngredientMapping {
                id: row.get("id"),
                product_code: row.get("product_code"),
                ingredient_id: row.get("ingredient_id"),
                ingredient_name: row.get("ingredient_name"),
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn create_product_ingredient_mapping(
        &self,
        product_code: &str,
        ingredient_id: &str,
    ) -> Result<ProductIngredientMapping> {
        // First get the ingredient name
        let ingredient_name: String = sqlx::query_scalar(
            "SELECT name FROM ingredients WHERE id = ?"
        )
        .bind(ingredient_id)
        .fetch_one(&self.pool)
        .await
        .context("Failed to get ingredient name")?;

        let mapping = ProductIngredientMapping {
            id: uuid::Uuid::new_v4().to_string(),
            product_code: product_code.to_string(),
            ingredient_id: ingredient_id.to_string(),
            ingredient_name,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO product_ingredient_mappings (
                id, product_code, ingredient_id, ingredient_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&mapping.id)
        .bind(&mapping.product_code)
        .bind(&mapping.ingredient_id)
        .bind(&mapping.ingredient_name)
        .bind(mapping.created_at.to_rfc3339())
        .bind(mapping.updated_at.to_rfc3339())
        .execute(&self.pool)
        .await
        .context("Failed to create product ingredient mapping")?;

        Ok(mapping)
    }

    pub async fn delete_product_ingredient_mapping(&self, product_code: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM product_ingredient_mappings WHERE product_code = ?")
            .bind(product_code)
            .execute(&self.pool)
            .await
            .context("Failed to delete product ingredient mapping")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn get_all_product_ingredient_mappings(&self) -> Result<Vec<ProductIngredientMapping>> {
        let rows = sqlx::query(
            r#"
            SELECT id, product_code, ingredient_id, ingredient_name, created_at, updated_at
            FROM product_ingredient_mappings
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .context("Failed to get all product ingredient mappings")?;

        let mut mappings = Vec::new();
        for row in rows {
            let created_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                .context("Failed to parse created_at")?
                .with_timezone(&Utc);
            let updated_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                .context("Failed to parse updated_at")?
                .with_timezone(&Utc);

            mappings.push(ProductIngredientMapping {
                id: row.get("id"),
                product_code: row.get("product_code"),
                ingredient_id: row.get("ingredient_id"),
                ingredient_name: row.get("ingredient_name"),
                created_at,
                updated_at,
            });
        }

        Ok(mappings)
    }

    // Product creation methods
    pub async fn create_product(&self, app_handle: &AppHandle, product: &Product) -> Result<()> {
        // Get the path to the products database
        let products_db_path = self.get_products_db_path(app_handle).await?;
        
        // Connect to the products database
        let products_pool = SqlitePool::connect(&format!("sqlite:{}", products_db_path.to_string_lossy()))
            .await
            .context("Failed to connect to products database")?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO products (code, url, product_name, brands)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(&product.code)
        .bind(&product.url)
        .bind(&product.product_name)
        .bind(&product.brands)
        .execute(&products_pool)
        .await
        .context("Failed to create product")?;

        products_pool.close().await;
        Ok(())
    }
}

#[cfg(test)]
mod tests;
