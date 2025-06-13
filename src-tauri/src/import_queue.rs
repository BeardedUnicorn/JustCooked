#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tracing::{info, error, warn, instrument};
use uuid::Uuid;

use crate::batch_import::{BatchImporter, BatchImportRequest, BatchImportProgress, BatchImportResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportQueueTask {
    pub id: String,
    pub description: String,
    pub request: BatchImportRequest,
    pub status: ImportQueueTaskStatus,
    pub progress: Option<BatchImportProgress>,
    pub added_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
    pub estimated_time_remaining: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ImportQueueTaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportQueueStatus {
    pub tasks: Vec<ImportQueueTask>,
    pub current_task_id: Option<String>,
    pub is_processing: bool,
    pub total_pending: u32,
    pub total_completed: u32,
    pub total_failed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueProgressUpdate {
    pub task_id: String,
    pub progress: BatchImportProgress,
}

pub struct ImportQueue {
    tasks: Arc<Mutex<VecDeque<ImportQueueTask>>>,
    current_task: Arc<Mutex<Option<String>>>,
    is_processing: Arc<Mutex<bool>>,
    importers: Arc<Mutex<std::collections::HashMap<String, Arc<BatchImporter>>>>,
}

impl ImportQueue {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(VecDeque::new())),
            current_task: Arc::new(Mutex::new(None)),
            is_processing: Arc::new(Mutex::new(false)),
            importers: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    #[instrument(skip_all)]
    pub fn add_task(&self, description: String, request: BatchImportRequest) -> Result<String, String> {
        let task_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let task = ImportQueueTask {
            id: task_id.clone(),
            description,
            request,
            status: ImportQueueTaskStatus::Pending,
            progress: None,
            added_at: now,
            started_at: None,
            completed_at: None,
            error: None,
            estimated_time_remaining: None,
        };

        {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.push_back(task);
        }

        info!("Added task to import queue: {}", task_id);
        Ok(task_id)
    }

    pub async fn process_queue(&self, app: tauri::AppHandle) {
        Self::process_queue_loop(
            self.tasks.clone(),
            self.current_task.clone(),
            self.is_processing.clone(),
            self.importers.clone(),
            app,
        ).await;
    }

    pub fn get_status(&self) -> ImportQueueStatus {
        let tasks = self.tasks.lock().unwrap();
        let current_task_id = self.current_task.lock().unwrap().clone();
        let is_processing = *self.is_processing.lock().unwrap();

        let all_tasks: Vec<ImportQueueTask> = tasks.iter().cloned().collect();
        
        let total_pending = all_tasks.iter()
            .filter(|t| t.status == ImportQueueTaskStatus::Pending)
            .count() as u32;
        
        let total_completed = all_tasks.iter()
            .filter(|t| t.status == ImportQueueTaskStatus::Completed)
            .count() as u32;
        
        let total_failed = all_tasks.iter()
            .filter(|t| matches!(t.status, ImportQueueTaskStatus::Failed | ImportQueueTaskStatus::Cancelled))
            .count() as u32;

        ImportQueueStatus {
            tasks: all_tasks,
            current_task_id,
            is_processing,
            total_pending,
            total_completed,
            total_failed,
        }
    }

    pub fn remove_task(&self, task_id: &str) -> Result<(), String> {
        let mut tasks = self.tasks.lock().unwrap();
        
        // Find and remove the task
        let position = tasks.iter().position(|task| task.id == task_id);
        
        if let Some(pos) = position {
            let task = &mut tasks[pos];
            
            // If task is running, cancel it
            if task.status == ImportQueueTaskStatus::Running {
                if let Some(importer) = self.importers.lock().unwrap().get(task_id) {
                    importer.cancel();
                }
                task.status = ImportQueueTaskStatus::Cancelled;
                task.completed_at = Some(chrono::Utc::now().to_rfc3339());
            } else if task.status == ImportQueueTaskStatus::Pending {
                // Remove pending task from queue
                tasks.remove(pos);
                info!("Removed pending task from queue: {}", task_id);
                return Ok(());
            }
        } else {
            return Err("Task not found".to_string());
        }

        info!("Cancelled task: {}", task_id);
        Ok(())
    }

    async fn process_queue_loop(
        tasks: Arc<Mutex<VecDeque<ImportQueueTask>>>,
        current_task: Arc<Mutex<Option<String>>>,
        is_processing: Arc<Mutex<bool>>,
        importers: Arc<Mutex<std::collections::HashMap<String, Arc<BatchImporter>>>>,
        app: tauri::AppHandle,
    ) {
        info!("Starting queue processing loop");

        loop {
            // Check if already processing - if so, wait and retry
            let is_currently_processing = {
                let processing = is_processing.lock().unwrap();
                *processing
            };

            if is_currently_processing {
                info!("Queue is currently processing another task, waiting...");
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                continue; // Continue the loop instead of returning
            }

            // Get next pending task
            let next_task = {
                let mut tasks_guard = tasks.lock().unwrap();
                tasks_guard.iter_mut()
                    .find(|task| task.status == ImportQueueTaskStatus::Pending)
                    .map(|task| {
                        task.status = ImportQueueTaskStatus::Running;
                        task.started_at = Some(chrono::Utc::now().to_rfc3339());
                        task.clone()
                    })
            };

            // If no pending tasks, exit the loop
            let task = match next_task {
                Some(task) => task,
                None => {
                    info!("No more pending tasks in queue, exiting processing loop");
                    return;
                }
            };

            info!("Starting queue task: {} - {}", task.id, task.description);

            // Set processing state
            {
                *is_processing.lock().unwrap() = true;
                *current_task.lock().unwrap() = Some(task.id.clone());
            }

            // Create and store importer
            let importer = Arc::new(BatchImporter::new());
            {
                let mut importers_guard = importers.lock().unwrap();
                importers_guard.insert(task.id.clone(), importer.clone());
            }

            // Execute the import with progress tracking
            let result = Self::execute_import_task_with_progress(
                importer.clone(),
                task.request.clone(),
                app.clone(),
                tasks.clone(),
                task.id.clone()
            ).await;

            // Update task status
            {
                let mut tasks_guard = tasks.lock().unwrap();
                if let Some(task_mut) = tasks_guard.iter_mut().find(|t| t.id == task.id) {
                    task_mut.completed_at = Some(chrono::Utc::now().to_rfc3339());
                    task_mut.progress = Some(importer.get_progress());

                    match result {
                        Ok(_) => {
                            task_mut.status = ImportQueueTaskStatus::Completed;
                            info!("Queue task completed successfully: {}", task.id);
                        }
                        Err(e) => {
                            task_mut.status = ImportQueueTaskStatus::Failed;
                            task_mut.error = Some(e.clone());
                            error!("Queue task failed: {} - {}", task.id, e);
                        }
                    }
                }
            }

            // Keep importer for a short time to allow progress queries
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

            // Clean up
            {
                let mut importers_guard = importers.lock().unwrap();
                importers_guard.remove(&task.id);
            }

            // Reset processing state
            {
                *is_processing.lock().unwrap() = false;
                *current_task.lock().unwrap() = None;
            }

            info!("Queue task {} finished, checking for next task", task.id);
            // Continue to next iteration of the loop to process next task
        }
    }

    async fn execute_import_task(
        importer: Arc<BatchImporter>,
        request: BatchImportRequest,
        app: tauri::AppHandle,
    ) -> Result<BatchImportResult, String> {
        importer.start_batch_import(app, request).await
    }

    async fn execute_import_task_with_progress(
        importer: Arc<BatchImporter>,
        request: BatchImportRequest,
        app: tauri::AppHandle,
        tasks: Arc<Mutex<VecDeque<ImportQueueTask>>>,
        task_id: String,
    ) -> Result<BatchImportResult, String> {
        // Start the import task
        let importer_clone = importer.clone();
        let app_clone = app.clone();
        let request_clone = request.clone();

        // Spawn the actual import task
        let import_handle = tokio::spawn(async move {
            importer_clone.start_batch_import(app_clone, request_clone).await
        });

        // Start progress monitoring with a shared handle reference
        let progress_importer = importer.clone();
        let progress_tasks = tasks.clone();
        let progress_task_id = task_id.clone();

        // Create a shared flag to signal when import is done
        let import_done = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let import_done_clone = import_done.clone();

        let progress_handle = tokio::spawn(async move {
            while !import_done_clone.load(std::sync::atomic::Ordering::Relaxed) {
                // Update task progress in the queue
                {
                    let mut tasks_guard = progress_tasks.lock().unwrap();
                    if let Some(task_mut) = tasks_guard.iter_mut().find(|t| t.id == progress_task_id) {
                        task_mut.progress = Some(progress_importer.get_progress());
                    }
                }

                // Wait before next update
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        });

        // Wait for import to complete
        let result = import_handle.await.map_err(|e| format!("Import task panicked: {}", e))?;

        // Signal that import is done
        import_done.store(true, std::sync::atomic::Ordering::Relaxed);

        // Stop progress monitoring
        progress_handle.abort();

        result
    }

    pub fn get_task_progress(&self, task_id: &str) -> Option<BatchImportProgress> {
        if let Some(importer) = self.importers.lock().unwrap().get(task_id) {
            Some(importer.get_progress())
        } else {
            // Check if task is in completed state
            let tasks = self.tasks.lock().unwrap();
            tasks.iter()
                .find(|task| task.id == task_id)
                .and_then(|task| task.progress.clone())
        }
    }
}
