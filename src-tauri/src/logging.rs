use std::path::PathBuf;
use tracing::{info, warn, error};
use tracing_subscriber::{
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};
use tracing_appender::{non_blocking, rolling};
use anyhow::Result;
use tauri::Manager;
use std::sync::OnceLock;

// Global storage for the guards to prevent them from being dropped
static LOGGING_GUARDS: OnceLock<(non_blocking::WorkerGuard, non_blocking::WorkerGuard)> = OnceLock::new();

/// Initialize the logging system for the application
pub fn init_logging(app_data_dir: &PathBuf) -> Result<()> {
    // Create logs directory
    let logs_dir = app_data_dir.join("logs");
    std::fs::create_dir_all(&logs_dir)?;

    // Set up file appender with daily rotation
    let file_appender = rolling::daily(&logs_dir, "justcooked");
    let (file_writer, file_guard) = non_blocking(file_appender);

    // Set up console appender
    let (console_writer, console_guard) = non_blocking(std::io::stdout());

    // Store the guards globally to prevent them from being dropped
    if LOGGING_GUARDS.set((file_guard, console_guard)).is_err() {
        return Err(anyhow::anyhow!("Logging already initialized"));
    }

    // Configure log level based on build type
    let log_level = if cfg!(debug_assertions) {
        "debug"
    } else {
        "info"
    };

    // Create environment filter
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("justcooked={},tauri=info", log_level)));

    // Set up the subscriber with both file and console output
    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::Layer::new()
                .with_writer(file_writer)
                .with_ansi(false)
                .with_target(true)
                .with_thread_ids(true)
        )
        .with(
            fmt::Layer::new()
                .with_writer(console_writer)
                .with_ansi(true)
                .compact()
        )
        .try_init()
        .map_err(|e| anyhow::anyhow!("Failed to initialize tracing subscriber: {}", e))?;

    // Log successful initialization
    info!("Logging system initialized");
    info!("Log files will be stored in: {:?}", logs_dir);

    // Allow time for initial logs to be written
    std::thread::sleep(std::time::Duration::from_millis(100));

    Ok(())
}


/// Log cleanup - remove old log files (older than 30 days)
pub fn cleanup_old_logs(app_data_dir: &PathBuf) -> Result<()> {
    let logs_dir = app_data_dir.join("logs");
    
    if !logs_dir.exists() {
        return Ok(());
    }

    let thirty_days_ago = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() - (30 * 24 * 60 * 60); // 30 days in seconds

    let entries = std::fs::read_dir(&logs_dir)?;
    let mut cleaned_count = 0;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(modified_duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                        if modified_duration.as_secs() < thirty_days_ago {
                            if let Err(e) = std::fs::remove_file(&path) {
                                warn!("Failed to remove old log file {:?}: {}", path, e);
                            } else {
                                cleaned_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    if cleaned_count > 0 {
        info!("Cleaned up {} old log files", cleaned_count);
    }

    Ok(())
}

/// Tauri command to log from frontend
#[tauri::command]
pub async fn log_info(component: String, message: String, context: Option<String>) {
    if let Some(ctx) = context {
        info!(component = %component, context = %ctx, "{}", message);
    } else {
        info!(component = %component, "{}", message);
    }
}

/// Tauri command to log warnings from frontend
#[tauri::command]
pub async fn log_warn(component: String, message: String, context: Option<String>) {
    if let Some(ctx) = context {
        warn!(component = %component, context = %ctx, "{}", message);
    } else {
        warn!(component = %component, "{}", message);
    }
}

/// Tauri command to log errors from frontend
#[tauri::command]
pub async fn log_error(component: String, message: String, context: Option<String>) {
    if let Some(ctx) = context {
        error!(component = %component, context = %ctx, "{}", message);
    } else {
        error!(component = %component, "{}", message);
    }
}

/// Tauri command to log debug messages from frontend
#[tauri::command]
pub async fn log_debug(component: String, message: String, context: Option<String>) {
    if let Some(ctx) = context {
        tracing::debug!(component = %component, context = %ctx, "{}", message);
    } else {
        tracing::debug!(component = %component, "{}", message);
    }
}

/// Get the current log file path for debugging
#[tauri::command]
pub async fn get_log_file_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let logs_dir = app_data_dir.join("logs");
    let today = chrono::Utc::now().format("%Y-%m-%d");
    let log_file = logs_dir.join(format!("justcooked.{}.log", today));

    Ok(log_file.to_string_lossy().to_string())
}

/// Get the logs directory path
#[tauri::command]
pub async fn get_log_directory_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let logs_dir = app_data_dir.join("logs");

    // Ensure the logs directory exists
    if !logs_dir.exists() {
        std::fs::create_dir_all(&logs_dir)
            .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    }

    Ok(logs_dir.to_string_lossy().to_string())
}

/// Open the logs directory in the system file manager
#[tauri::command]
pub async fn open_log_directory(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let logs_dir = app_data_dir.join("logs");

    // Ensure the logs directory exists
    if !logs_dir.exists() {
        std::fs::create_dir_all(&logs_dir)
            .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    }

    // Use the appropriate command for each platform
    let result = if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(&logs_dir)
            .spawn()
    } else {
        // Linux and other Unix-like systems
        std::process::Command::new("xdg-open")
            .arg(&logs_dir)
            .spawn()
    };

    match result {
        Ok(_) => {
            info!("Successfully opened logs directory: {:?}", logs_dir);
            Ok(())
        },
        Err(e) => {
            error!("Failed to open logs directory: {}", e);
            Err(format!("Failed to open logs directory: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_cleanup_old_logs() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        std::fs::create_dir_all(&logs_dir).unwrap();

        // Create a test log file
        let test_file = logs_dir.join("test.log");
        std::fs::write(&test_file, "test content").unwrap();

        // Test cleanup (should not remove recent files)
        let result = cleanup_old_logs(&temp_dir.path().to_path_buf());
        assert!(result.is_ok());
        assert!(test_file.exists());
    }
}
