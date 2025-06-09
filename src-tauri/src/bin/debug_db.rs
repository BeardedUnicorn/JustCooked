use std::path::PathBuf;
use sqlx::sqlite::SqlitePool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Simulate the app data directory path
    let app_data_dir = PathBuf::from("/Users/mike/Library/Application Support/com.justcooked.app");
    
    println!("App data directory: {:?}", app_data_dir);
    println!("Directory exists: {}", app_data_dir.exists());
    
    // Create directory if it doesn't exist
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)?;
        println!("Created app data directory");
    }
    
    let db_path = app_data_dir.join("recipes.db");
    let db_url = format!("sqlite:{}", db_path.display());
    
    println!("Database path: {:?}", db_path);
    println!("Database URL: {}", db_url);
    
    // Try creating the file first
    println!("Creating empty database file...");
    if let Err(e) = std::fs::File::create(&db_path) {
        println!("Failed to create file: {}", e);
    } else {
        println!("✅ Created empty database file");
    }
    
    // Try to connect to the database
    match SqlitePool::connect(&db_url).await {
        Ok(pool) => {
            println!("✅ Successfully connected to database!");
            
            // Try to create the table
            let result = sqlx::query(
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
                    ingredients TEXT NOT NULL,
                    instructions TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    date_added TEXT NOT NULL,
                    date_modified TEXT NOT NULL,
                    rating INTEGER,
                    difficulty TEXT,
                    is_favorite BOOLEAN,
                    personal_notes TEXT,
                    collections TEXT NOT NULL,
                    nutritional_info TEXT
                )
                "#,
            )
            .execute(&pool)
            .await;
            
            match result {
                Ok(_) => println!("✅ Successfully created recipes table!"),
                Err(e) => println!("❌ Failed to create recipes table: {}", e),
            }
            
            pool.close().await;
        }
        Err(e) => {
            println!("❌ Failed to connect to database: {}", e);
            println!("Error details: {:?}", e);
            
            // Try alternative connection strings
            println!("\n--- Trying alternative approaches ---");
            
            // Try with file:// prefix
            let alt_url = format!("sqlite:///{}", db_path.to_string_lossy());
            println!("Trying: {}", alt_url);
            match SqlitePool::connect(&alt_url).await {
                Ok(pool) => {
                    println!("✅ Alternative connection successful!");
                    pool.close().await;
                }
                Err(e) => {
                    println!("❌ Alternative connection failed: {}", e);
                }
            }
        }
    }
    
    Ok(())
}
