use reqwest;
use scraper::{Html, Selector};

#[tokio::main]
async fn main() {
    let url = "https://www.allrecipes.com/recipe/247073/cinnabon-cinnamon-roll-cake/";
    
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
                    
                    for (i, script) in scripts.iter().enumerate() {
                        let json_text = script.inner_html();
                        println!("=== JSON-LD Script {} ===", i + 1);
                        
                        // Try to parse and pretty print the JSON
                        match serde_json::from_str::<serde_json::Value>(&json_text) {
                            Ok(json_value) => {
                                println!("{}", serde_json::to_string_pretty(&json_value).unwrap());
                            }
                            Err(e) => {
                                println!("❌ Failed to parse JSON: {}", e);
                                println!("Raw content: {}", json_text);
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
