use image::{ImageFormat, ImageReader};
use reqwest;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tokio::fs;
use url::Url;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageStorageError {
    pub message: String,
    pub error_type: String,
}

impl std::fmt::Display for ImageStorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}: {}", self.error_type, self.message)
    }
}

impl std::error::Error for ImageStorageError {}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredImage {
    pub local_path: String,
    pub original_url: String,
    pub file_size: u64,
    pub format: String,
    pub width: u32,
    pub height: u32,
}

pub async fn download_and_store_image(
    image_url: &str,
    app_data_dir: &Path,
) -> Result<StoredImage, ImageStorageError> {
    // Validate URL
    let _parsed_url = Url::parse(image_url).map_err(|_| ImageStorageError {
        message: "Invalid image URL format".to_string(),
        error_type: "ValidationError".to_string(),
    })?;

    // Create images directory if it doesn't exist
    let images_dir = app_data_dir.join("images");
    fs::create_dir_all(&images_dir).await.map_err(|e| ImageStorageError {
        message: format!("Failed to create images directory: {}", e),
        error_type: "FileSystemError".to_string(),
    })?;

    // Download the image
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .map_err(|e| ImageStorageError {
            message: format!("Failed to create HTTP client: {}", e),
            error_type: "NetworkError".to_string(),
        })?;

    let response = client.get(image_url).send().await.map_err(|e| ImageStorageError {
        message: format!("Failed to download image: {}", e),
        error_type: "NetworkError".to_string(),
    })?;

    if !response.status().is_success() {
        return Err(ImageStorageError {
            message: format!("HTTP error downloading image: {}", response.status()),
            error_type: "NetworkError".to_string(),
        });
    }

    let image_bytes = response.bytes().await.map_err(|e| ImageStorageError {
        message: format!("Failed to read image data: {}", e),
        error_type: "NetworkError".to_string(),
    })?;

    // Process and validate the image
    let cursor = Cursor::new(&image_bytes);
    let reader = ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| ImageStorageError {
            message: format!("Failed to read image format: {}", e),
            error_type: "ImageProcessingError".to_string(),
        })?;

    let format = reader.format().ok_or_else(|| ImageStorageError {
        message: "Could not determine image format".to_string(),
        error_type: "ImageProcessingError".to_string(),
    })?;

    let image = reader.decode().map_err(|e| ImageStorageError {
        message: format!("Failed to decode image: {}", e),
        error_type: "ImageProcessingError".to_string(),
    })?;

    let (width, height) = (image.width(), image.height());

    // Generate unique filename
    let file_extension = match format {
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Png => "png",
        ImageFormat::WebP => "webp",
        ImageFormat::Gif => "gif",
        _ => "jpg", // Default to jpg for other formats
    };

    let filename = format!("{}.{}", Uuid::new_v4(), file_extension);
    let file_path = images_dir.join(&filename);

    // Resize image if it's too large (max 800px width)
    let processed_image = if width > 800 {
        let aspect_ratio = height as f32 / width as f32;
        let new_width = 800;
        let new_height = (new_width as f32 * aspect_ratio) as u32;
        image.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    // Save the processed image
    processed_image
        .save_with_format(&file_path, ImageFormat::Jpeg)
        .map_err(|e| ImageStorageError {
            message: format!("Failed to save image: {}", e),
            error_type: "FileSystemError".to_string(),
        })?;

    // Get file size
    let metadata = fs::metadata(&file_path).await.map_err(|e| ImageStorageError {
        message: format!("Failed to read file metadata: {}", e),
        error_type: "FileSystemError".to_string(),
    })?;

    let local_path = file_path
        .to_str()
        .ok_or_else(|| ImageStorageError {
            message: "Invalid file path".to_string(),
            error_type: "FileSystemError".to_string(),
        })?
        .to_string();

    Ok(StoredImage {
        local_path,
        original_url: image_url.to_string(),
        file_size: metadata.len(),
        format: "jpeg".to_string(), // We always save as JPEG
        width: processed_image.width(),
        height: processed_image.height(),
    })
}

pub async fn delete_stored_image(local_path: &str) -> Result<(), ImageStorageError> {
    let path = Path::new(local_path);
    
    if !path.exists() {
        return Ok(()); // Already deleted or never existed
    }

    fs::remove_file(path).await.map_err(|e| ImageStorageError {
        message: format!("Failed to delete image file: {}", e),
        error_type: "FileSystemError".to_string(),
    })?;

    Ok(())
}

pub fn get_app_data_dir() -> Result<PathBuf, ImageStorageError> {
    // For now, use a simple approach - we'll pass the app data dir from the frontend
    // or use a default location
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| ImageStorageError {
            message: "Failed to get home directory".to_string(),
            error_type: "FileSystemError".to_string(),
        })?;

    Ok(PathBuf::from(home_dir).join(".justcooked"))
}

#[allow(dead_code)]
pub fn is_valid_image_url(url: &str) -> bool {
    if let Ok(parsed_url) = Url::parse(url) {
        // Check if it's HTTP or HTTPS
        if !matches!(parsed_url.scheme(), "http" | "https") {
            return false;
        }

        if let Some(path) = parsed_url.path_segments() {
            if let Some(last_segment) = path.last() {
                let lower_segment = last_segment.to_lowercase();
                // If it has a known image extension, it's valid
                if lower_segment.ends_with(".jpg")
                    || lower_segment.ends_with(".jpeg")
                    || lower_segment.ends_with(".png")
                    || lower_segment.ends_with(".webp")
                    || lower_segment.ends_with(".gif") {
                    return true;
                }
                // If it has no extension or unknown extension, assume it might be a dynamic image URL
                if !lower_segment.contains('.') || lower_segment.split('.').last().map_or(true, |ext| ext.len() <= 4) {
                    return true;
                }
            }
        }
        // If no path segments, assume it might be a valid image URL
        return true;
    }
    false
}

pub async fn get_local_image_as_base64(local_path: &str) -> Result<String, ImageStorageError> {
    let path = Path::new(local_path);

    if !path.exists() {
        return Err(ImageStorageError {
            message: format!("Image file not found: {}", local_path),
            error_type: "FileNotFound".to_string(),
        });
    }

    // Read the file
    let image_bytes = fs::read(path).await.map_err(|e| ImageStorageError {
        message: format!("Failed to read image file: {}", e),
        error_type: "FileSystemError".to_string(),
    })?;

    // Encode as base64
    let base64_string = general_purpose::STANDARD.encode(&image_bytes);

    // Determine MIME type based on file extension
    let mime_type = match path.extension().and_then(|ext| ext.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "image/jpeg", // Default to JPEG
    };

    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_string))
}

#[cfg(test)]
mod tests;
