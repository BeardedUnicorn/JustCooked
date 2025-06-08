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

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_data_dir = app_handle
            .path()
            .app_local_data_dir()
            .context("Failed to get app data directory")?;

        tokio::fs::create_dir_all(&app_data_dir)
            .await
            .context("Failed to create app data directory")?;

        let db_path = app_data_dir.join("recipes.db");
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = SqlitePool::connect(&db_url)
            .await
            .context("Failed to connect to database")?;

        let db = Self { pool };
        db.migrate().await?;
        Ok(db)
    }

    async fn migrate(&self) -> Result<()> {
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
