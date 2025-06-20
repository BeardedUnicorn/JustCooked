#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tracing::{info, error, warn, instrument};
use uuid::Uuid;

use crate::batch_import::{BatchImporter, BatchImportRequest, BatchImportProgress, BatchImportResult, ReImporter, ReImportRequest};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportRequest {
    BatchImport(BatchImportRequest),
    ReImport(ReImportRequest),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportQueueTask {
    pub id: String,
    pub description: String,
    pub request: ImportRequest,
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

#[derive(Debug, Clone)]
pub enum ImporterType {
    BatchImporter(Arc<BatchImporter>),
    ReImporter(Arc<ReImporter>),
}

pub struct ImportQueue {
    tasks: Arc<Mutex<VecDeque<ImportQueueTask>>>,
    current_task: Arc<Mutex<Option<String>>>,
    is_processing: Arc<Mutex<bool>>,
    importers: Arc<Mutex<std::collections::HashMap<String, ImporterType>>>,
    processing_started: Arc<Mutex<bool>>,
}

impl ImportQueue {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(VecDeque::new())),
            current_task: Arc::new(Mutex::new(None)),
            is_processing: Arc::new(Mutex::new(false)),
            importers: Arc::new(Mutex::new(std::collections::HashMap::new())),
            processing_started: Arc::new(Mutex::new(false)),
        }
    }

    #[instrument(skip_all)]
    pub fn add_task(&self, description: String, request: ImportRequest) -> Result<String, String> {
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

    // Convenience method for batch import requests
    #[instrument(skip_all)]
    pub fn add_batch_import_task(&self, description: String, request: BatchImportRequest) -> Result<String, String> {
        self.add_task(description, ImportRequest::BatchImport(request))
    }

    // Convenience method for re-import requests
    #[instrument(skip_all)]
    pub fn add_re_import_task(&self, description: String, request: ReImportRequest) -> Result<String, String> {
        self.add_task(description, ImportRequest::ReImport(request))
    }

    pub async fn process_queue(&self, app: tauri::AppHandle) {
        // Check if processing has already been started
        {
            let mut started = self.processing_started.lock().unwrap();
            if *started {
                info!("Queue processing already started, skipping duplicate start request");
                return;
            }
            *started = true;
        }

        info!("Starting queue processing for the first time");
        Self::process_queue_loop(
            self.tasks.clone(),
            self.current_task.clone(),
            self.is_processing.clone(),
            self.importers.clone(),
            app,
        ).await;

        // Reset the started flag when processing completes
        {
            let mut started = self.processing_started.lock().unwrap();
            *started = false;
        }
        info!("Queue processing completed, reset started flag");
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
                    match importer {
                        ImporterType::BatchImporter(batch_importer) => batch_importer.cancel(),
                        ImporterType::ReImporter(re_importer) => re_importer.cancel(),
                    }
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
        importers: Arc<Mutex<std::collections::HashMap<String, ImporterType>>>,
        app: tauri::AppHandle,
    ) {
        info!("=== STARTING QUEUE PROCESSING LOOP ===");

        loop {
            // Debug: Check queue state
            {
                let tasks_guard = tasks.lock().unwrap();
                let pending_count = tasks_guard.iter().filter(|t| t.status == ImportQueueTaskStatus::Pending).count();
                let running_count = tasks_guard.iter().filter(|t| t.status == ImportQueueTaskStatus::Running).count();
                let completed_count = tasks_guard.iter().filter(|t| t.status == ImportQueueTaskStatus::Completed).count();
                let failed_count = tasks_guard.iter().filter(|t| t.status == ImportQueueTaskStatus::Failed).count();

                info!("Queue state: {} pending, {} running, {} completed, {} failed",
                      pending_count, running_count, completed_count, failed_count);

                if pending_count > 0 {
                    info!("Pending tasks:");
                    for task in tasks_guard.iter().filter(|t| t.status == ImportQueueTaskStatus::Pending) {
                        info!("  - {}: {}", task.id, task.description);
                    }
                }
            }

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
                        info!("Found pending task: {} - {}", task.id, task.description);
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

            // Create and store appropriate importer based on request type
            let importer_type = match &task.request {
                ImportRequest::BatchImport(_) => {
                    let importer = Arc::new(BatchImporter::new());
                    ImporterType::BatchImporter(importer)
                }
                ImportRequest::ReImport(_) => {
                    let importer = Arc::new(ReImporter::new());
                    ImporterType::ReImporter(importer)
                }
            };

            {
                let mut importers_guard = importers.lock().unwrap();
                importers_guard.insert(task.id.clone(), importer_type.clone());
            }

            // Execute the import with progress tracking
            info!("Executing import task: {} - {}", task.id, task.description);
            let result = Self::execute_import_task_with_progress(
                importer_type.clone(),
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

                    // Get progress from the appropriate importer
                    let progress = match &importer_type {
                        ImporterType::BatchImporter(batch_importer) => batch_importer.get_progress(),
                        ImporterType::ReImporter(re_importer) => re_importer.get_progress(),
                    };
                    task_mut.progress = Some(progress);

                    match result {
                        Ok(import_result) => {
                            task_mut.status = ImportQueueTaskStatus::Completed;
                            info!("✓ Queue task {} completed successfully", task.id);
                            info!("  - {} successful imports", import_result.successful_imports);
                            info!("  - {} failed imports", import_result.failed_imports);
                            info!("  - {} skipped recipes", import_result.skipped_recipes);
                            info!("  - Duration: {}s", import_result.duration);
                        }
                        Err(e) => {
                            task_mut.status = ImportQueueTaskStatus::Failed;
                            task_mut.error = Some(e.clone());
                            error!("✗ Queue task {} failed: {}", task.id, e);
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


    async fn execute_import_task_with_progress(
        importer_type: ImporterType,
        request: ImportRequest,
        app: tauri::AppHandle,
        tasks: Arc<Mutex<VecDeque<ImportQueueTask>>>,
        task_id: String,
    ) -> Result<BatchImportResult, String> {
        // Start the appropriate import task based on type
        let import_handle = match (&importer_type, &request) {
            (ImporterType::BatchImporter(importer), ImportRequest::BatchImport(batch_request)) => {
                let importer_clone = importer.clone();
                let app_clone = app.clone();
                let request_clone = batch_request.clone();

                tokio::spawn(async move {
                    importer_clone.start_batch_import(app_clone, request_clone).await
                })
            }
            (ImporterType::ReImporter(importer), ImportRequest::ReImport(re_request)) => {
                let importer_clone = importer.clone();
                let app_clone = app.clone();
                let request_clone = re_request.clone();

                tokio::spawn(async move {
                    importer_clone.start_re_import(app_clone, request_clone).await
                })
            }
            _ => {
                return Err("Mismatched importer type and request type".to_string());
            }
        };

        // Start progress monitoring with a shared handle reference
        let progress_importer_type = importer_type.clone();
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
                        let progress = match &progress_importer_type {
                            ImporterType::BatchImporter(batch_importer) => batch_importer.get_progress(),
                            ImporterType::ReImporter(re_importer) => re_importer.get_progress(),
                        };
                        task_mut.progress = Some(progress);
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
            let progress = match importer {
                ImporterType::BatchImporter(batch_importer) => batch_importer.get_progress(),
                ImporterType::ReImporter(re_importer) => re_importer.get_progress(),
            };
            Some(progress)
        } else {
            // Check if task is in completed state
            let tasks = self.tasks.lock().unwrap();
            tasks.iter()
                .find(|task| task.id == task_id)
                .and_then(|task| task.progress.clone())
        }
    }


}
