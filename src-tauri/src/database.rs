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
    pub expiry_date: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub date_added: String,
    pub date_modified: String,
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
pub struct RecentSearch {
    pub id: String,
    pub query: String,
    pub filters: SearchFilters,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<String>,
    pub max_prep_time: Option<i32>,
    pub max_cook_time: Option<i32>,
    pub is_favorite: Option<bool>,
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
                date_modified TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to create pantry_items table")?;

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

        // Create indexes for better performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title)")
            .execute(&self.pool)
            .await
            .context("Failed to create title index")?;

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


    pub async fn recipe_exists_in_transaction(&self, tx: &mut Transaction<'_, Sqlite>, id: &str) -> Result<bool> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipes WHERE id = ?")
            .bind(id)
            .fetch_one(&mut **tx)
            .await
            .context("Failed to check if recipe exists")?;

        Ok(count > 0)
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
                id, ingredient_name, quantity, unit, expiry_date, location, notes, date_added, date_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&item.id)
        .bind(&item.ingredient_name)
        .bind(item.quantity)
        .bind(&item.unit)
        .bind(&item.expiry_date)
        .bind(&item.location)
        .bind(&item.notes)
        .bind(item.date_added.clone())
        .bind(item.date_modified.clone())
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
            expiry_date: row.get("expiry_date"),
            location: row.get("location"),
            notes: row.get("notes"),
            date_added: row.get("date_added"),
            date_modified: row.get("date_modified"),
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
}

#[cfg(test)]
mod tests;
