use JustCooked::recipe_import::import_recipe_from_url;
use reqwest;
use scraper::{Html, Selector};

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let url = if args.len() > 1 {
        &args[1]
    } else {
        "https://www.allrecipes.com/recipe/112157/tuna-garden-casserole/"
    };

    println!("Testing recipe import from: {}", url);
    println!("{}", "=".repeat(60));

    // First, let's debug what's actually on the page
    println!("🔍 Debugging page content...");
    debug_page_content(url).await;

    println!("\n{}", "=".repeat(60));
    println!("🧪 Testing recipe import...");

    match import_recipe_from_url(url).await {
        Ok(recipe) => {
            println!("✅ Recipe imported successfully!");
            println!();
            println!("📝 Recipe Details:");
            println!("Name: {}", recipe.name);
            println!("Description: {}", recipe.description);
            println!("Image URL: {}", recipe.image);
            println!("Prep Time: {}", recipe.prep_time);
            println!("Cook Time: {}", recipe.cook_time);
            println!("Total Time: {}", recipe.total_time);
            println!("Servings: {}", recipe.servings);
            println!("Keywords: {}", recipe.keywords);
            println!("Source URL: {}", recipe.source_url);
            println!();
            
            println!("🥘 Ingredients ({} found):", recipe.ingredients.len());
            if recipe.ingredients.is_empty() {
                println!("  ❌ No ingredients found!");
            } else {
                for (i, ingredient) in recipe.ingredients.iter().enumerate() {
                    println!("  {}. {}", i + 1, ingredient);
                }
            }
            println!();
            
            println!("📋 Instructions ({} found):", recipe.instructions.len());
            if recipe.instructions.is_empty() {
                println!("  ❌ No instructions found!");
            } else {
                for (i, instruction) in recipe.instructions.iter().enumerate() {
                    println!("  {}. {}", i + 1, instruction);
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to import recipe: {}", e);
        }
    }
}

async fn debug_page_content(url: &str) {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .unwrap();

    match client.get(url).send().await {
        Ok(response) => {
            match response.text().await {
                Ok(html_content) => {
                    let document = Html::parse_document(&html_content);

                    // Check for JSON-LD scripts
                    let script_selector = Selector::parse("script[type='application/ld+json']").unwrap();
                    let scripts: Vec<_> = document.select(&script_selector).collect();

                    println!("📄 Found {} JSON-LD script(s)", scripts.len());

                    for (i, script) in scripts.iter().enumerate() {
                        let json_text = script.inner_html();
                        println!("\n🔍 JSON-LD Script {}:", i + 1);
                        println!("Length: {} characters", json_text.len());

                        if json_text.len() > 500 {
                            println!("Content (first 500 chars): {}", &json_text[..500]);
                        } else {
                            println!("Content: {}", json_text);
                        }

                        // Try to parse as JSON
                        match serde_json::from_str::<serde_json::Value>(&json_text) {
                            Ok(json_value) => {
                                if let Some(recipe_type) = json_value.get("@type") {
                                    println!("@type: {}", recipe_type);
                                }
                                if let Some(name) = json_value.get("name") {
                                    println!("name: {}", name);
                                }
                            }
                            Err(e) => {
                                println!("❌ Failed to parse JSON: {}", e);
                            }
                        }
                    }

                    // Check for common ingredient selectors
                    println!("\n🥘 Checking ingredient selectors:");
                    let ingredient_selectors = [
                        ".recipe-ingredient",
                        ".ingredients li",
                        ".ingredient",
                        ".recipe-ingredients li",
                        ".ingredients-list li",
                        ".recipe__ingredient",
                        ".recipe-card__ingredient",
                        "[data-ingredient]",
                        ".ingredient-text",
                    ];

                    for selector_str in &ingredient_selectors {
                        if let Ok(selector) = Selector::parse(selector_str) {
                            let elements: Vec<_> = document.select(&selector).collect();
                            if !elements.is_empty() {
                                println!("  ✅ {} found {} elements", selector_str, elements.len());
                                for (i, element) in elements.iter().take(3).enumerate() {
                                    let text = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                                    if !text.is_empty() {
                                        println!("    {}. {}", i + 1, text);
                                    }
                                }
                            } else {
                                println!("  ❌ {} found 0 elements", selector_str);
                            }
                        }
                    }

                    // Check for common instruction selectors
                    println!("\n📋 Checking instruction selectors:");
                    let instruction_selectors = [
                        ".recipe-instruction",
                        ".instructions li",
                        ".instruction",
                        ".recipe-instructions li",
                        ".instructions-list li",
                        ".recipe__instruction",
                        ".recipe-card__instruction",
                        ".recipe-method li",
                        ".method li",
                        ".directions li",
                        ".recipe-directions li",
                    ];

                    for selector_str in &instruction_selectors {
                        if let Ok(selector) = Selector::parse(selector_str) {
                            let elements: Vec<_> = document.select(&selector).collect();
                            if !elements.is_empty() {
                                println!("  ✅ {} found {} elements", selector_str, elements.len());
                                for (i, element) in elements.iter().take(3).enumerate() {
                                    let text = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                                    if !text.is_empty() {
                                        println!("    {}. {}", i + 1, text);
                                    }
                                }
                            } else {
                                println!("  ❌ {} found 0 elements", selector_str);
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("❌ Failed to read response body: {}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to fetch webpage: {}", e);
        }
    }
}
