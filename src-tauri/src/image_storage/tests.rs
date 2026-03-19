#[cfg(test)]
mod tests {
    use crate::image_storage::*;
    use tempfile::TempDir;
    use tokio::fs;
    use base64::Engine;

    #[test]
    fn test_is_valid_image_url() {
        // Test valid image URLs with extensions
        let valid_urls = vec![
            "https://example.com/image.jpg",
            "https://example.com/image.jpeg",
            "https://example.com/image.png",
            "https://example.com/image.webp",
            "https://example.com/image.gif",
            "https://example.com/path/to/image.JPG",
            "https://example.com/path/to/image.PNG",
        ];

        for url in valid_urls {
            assert!(is_valid_image_url(url), "URL should be valid: {}", url);
        }

        // Test URLs without extensions (should still be valid for dynamic URLs)
        let dynamic_urls = vec![
            "https://example.com/api/image/123",
            "https://images.unsplash.com/photo-123456",
            "https://cdn.example.com/image",
        ];

        for url in dynamic_urls {
            assert!(is_valid_image_url(url), "Dynamic URL should be valid: {}", url);
        }

        // Test invalid URLs
        let invalid_urls = vec![
            "not-a-url",
            "",
            "ftp://example.com/image.jpg",
        ];

        for url in invalid_urls {
            assert!(!is_valid_image_url(url), "URL should be invalid: {}", url);
        }
    }

    #[test]
    fn test_get_app_data_dir() {
        let path = legacy_app_data_dir_from_home(std::path::Path::new("/Users/tester"));
        assert_eq!(path, std::path::Path::new("/Users/tester/.justcooked"));
    }

    #[test]
    fn test_get_image_storage_dir() {
        let path = get_image_storage_dir(std::path::Path::new("/tmp/justcooked"));
        assert_eq!(path, std::path::Path::new("/tmp/justcooked/images"));
    }

    #[tokio::test]
    async fn test_get_local_image_as_base64_file_not_found() {
        let result = get_local_image_as_base64("/nonexistent/path/image.jpg").await;
        assert!(result.is_err());
        
        let error = result.unwrap_err();
        assert_eq!(error.error_type, "FileNotFound");
        assert!(error.message.contains("Image file not found"));
    }

    #[tokio::test]
    async fn test_get_local_image_as_base64_success() {
        // Create a temporary file with some test image data
        let temp_dir = TempDir::new().unwrap();
        let image_path = temp_dir.path().join("test_image.jpg");
        
        // Write some dummy image data (just bytes that represent a minimal JPEG)
        let dummy_jpeg_data = vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
        ];
        fs::write(&image_path, &dummy_jpeg_data).await.unwrap();

        let result = get_local_image_as_base64(image_path.to_str().unwrap()).await;
        assert!(result.is_ok());
        
        let data_url = result.unwrap();
        assert!(data_url.starts_with("data:image/jpeg;base64,"));
        
        // Verify the base64 content
        let base64_part = data_url.strip_prefix("data:image/jpeg;base64,").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD.decode(base64_part).unwrap();
        assert_eq!(decoded, dummy_jpeg_data);
    }

    #[tokio::test]
    async fn test_get_local_image_as_base64_different_formats() {
        let temp_dir = TempDir::new().unwrap();
        
        // Test different file extensions
        let test_cases = vec![
            ("test.png", "data:image/png;base64,"),
            ("test.webp", "data:image/webp;base64,"),
            ("test.gif", "data:image/gif;base64,"),
            ("test.unknown", "data:image/jpeg;base64,"), // Default to JPEG
        ];

        for (filename, expected_prefix) in test_cases {
            let image_path = temp_dir.path().join(filename);
            let dummy_data = vec![0x00, 0x01, 0x02, 0x03]; // Simple test data
            fs::write(&image_path, &dummy_data).await.unwrap();

            let result = get_local_image_as_base64(image_path.to_str().unwrap()).await;
            assert!(result.is_ok());
            
            let data_url = result.unwrap();
            assert!(data_url.starts_with(expected_prefix), 
                   "Expected {} to start with {}", data_url, expected_prefix);
        }
    }

    #[tokio::test]
    async fn test_delete_stored_image_success() {
        // Create a temporary file
        let temp_dir = TempDir::new().unwrap();
        let image_path = temp_dir.path().join("test_image.jpg");
        fs::write(&image_path, b"test data").await.unwrap();
        
        // Verify file exists
        assert!(image_path.exists());
        
        // Delete the file
        let result = delete_stored_image(image_path.to_str().unwrap()).await;
        assert!(result.is_ok());
        
        // Verify file is deleted
        assert!(!image_path.exists());
    }

    #[tokio::test]
    async fn test_delete_stored_image_file_not_found() {
        // Try to delete a non-existent file (should not error)
        let result = delete_stored_image("/nonexistent/path/image.jpg").await;
        assert!(result.is_ok()); // Should succeed even if file doesn't exist
    }

    #[test]
    fn test_image_storage_error_display() {
        let error = ImageStorageError {
            message: "Test error message".to_string(),
            error_type: "TestError".to_string(),
        };
        
        let display_string = format!("{}", error);
        assert_eq!(display_string, "TestError: Test error message");
    }

    #[test]
    fn test_stored_image_serialization() {
        let stored_image = StoredImage {
            local_path: "/path/to/image.jpg".to_string(),
            original_url: "https://example.com/image.jpg".to_string(),
            file_size: 1024,
            format: "jpeg".to_string(),
            width: 800,
            height: 600,
        };

        // Test that it can be serialized and deserialized
        let json = serde_json::to_string(&stored_image).unwrap();
        let deserialized: StoredImage = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.local_path, stored_image.local_path);
        assert_eq!(deserialized.original_url, stored_image.original_url);
        assert_eq!(deserialized.file_size, stored_image.file_size);
        assert_eq!(deserialized.format, stored_image.format);
        assert_eq!(deserialized.width, stored_image.width);
        assert_eq!(deserialized.height, stored_image.height);
    }

    // Property-based tests using proptest would go here
    // For now, we'll add some edge case tests

    #[test]
    fn test_is_valid_image_url_edge_cases() {
        // Test URLs with query parameters
        assert!(is_valid_image_url("https://example.com/image.jpg?v=1&size=large"));
        
        // Test URLs with fragments
        assert!(is_valid_image_url("https://example.com/image.png#section"));
        
        // Test URLs with ports
        assert!(is_valid_image_url("https://example.com:8080/image.webp"));
        
        // Test URLs with subdomains
        assert!(is_valid_image_url("https://cdn.images.example.com/photo.gif"));
        
        // Test case sensitivity
        assert!(is_valid_image_url("https://example.com/IMAGE.JPG"));
        assert!(is_valid_image_url("https://example.com/image.JPEG"));
    }

    #[tokio::test]
    async fn test_get_local_image_as_base64_empty_file() {
        let temp_dir = TempDir::new().unwrap();
        let image_path = temp_dir.path().join("empty.jpg");
        
        // Create an empty file
        fs::write(&image_path, b"").await.unwrap();

        let result = get_local_image_as_base64(image_path.to_str().unwrap()).await;
        assert!(result.is_ok());
        
        let data_url = result.unwrap();
        assert_eq!(data_url, "data:image/jpeg;base64,");
    }

    #[test]
    fn test_image_storage_error_is_error_trait() {
        let error = ImageStorageError {
            message: "Test error".to_string(),
            error_type: "TestError".to_string(),
        };
        
        // Test that it implements the Error trait
        let _: &dyn std::error::Error = &error;
    }

    // Mock tests for download_and_store_image would require wiremock
    // These would be integration tests that test the full download flow
    // For now, we'll focus on unit tests for the helper functions
}
