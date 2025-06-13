#![allow(non_snake_case)]

#[cfg(test)]
mod time_estimation_tests {
    use super::super::*;
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_batch_importer_task_time_estimation_fix() {
        let importer = BatchImporter::new();
        
        // Set up initial state with start time
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - Duration::from_secs(60));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100;
            progress.processed_recipes = 20; // 20% complete
        }

        // Create a task clone (this should now have access to start_time)
        let task = importer.clone_for_task();
        
        // Test that the task can calculate time estimation
        let estimated = task.calculate_estimated_time_remaining();
        assert!(estimated.is_some(), "Task should be able to calculate time estimation");
        
        // Should estimate roughly 240 seconds remaining (60 seconds for 20 recipes, so 240 for remaining 80)
        let estimated_time = estimated.unwrap();
        assert!(estimated_time > 200 && estimated_time < 300, 
                "Estimated time should be around 240 seconds, got {}", estimated_time);
    }

    #[tokio::test]
    async fn test_batch_importer_task_progress_update_with_estimation() {
        let importer = BatchImporter::new();
        
        // Set up initial state
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - Duration::from_secs(30));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 50;
            progress.processed_recipes = 10; // 20% complete
        }

        let task = importer.clone_for_task();
        
        // Test that update_progress_with_estimation works
        task.update_progress_with_estimation();
        
        let progress = importer.get_progress();
        assert!(progress.estimated_time_remaining.is_some(), 
                "Progress should have estimated time remaining after task update");
        
        let estimated = progress.estimated_time_remaining.unwrap();
        assert!(estimated > 0, "Estimated time should be greater than 0");
    }

    #[tokio::test]
    async fn test_concurrent_time_estimation_updates() {
        let importer = BatchImporter::new();
        
        // Set up initial state
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - Duration::from_secs(10));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 20;
            progress.processed_recipes = 0;
        }

        // Create multiple tasks to simulate concurrent updates
        let task1 = importer.clone_for_task();
        let task2 = importer.clone_for_task();
        let task3 = importer.clone_for_task();

        // Simulate concurrent progress updates
        let handle1 = tokio::spawn(async move {
            // Simulate processing a recipe
            {
                let mut progress = task1.progress.lock().unwrap();
                progress.processed_recipes += 1;
            }
            task1.update_progress_with_estimation();
        });

        let handle2 = tokio::spawn(async move {
            // Simulate processing a recipe
            {
                let mut progress = task2.progress.lock().unwrap();
                progress.processed_recipes += 1;
            }
            task2.update_progress_with_estimation();
        });

        let handle3 = tokio::spawn(async move {
            // Simulate processing a recipe
            {
                let mut progress = task3.progress.lock().unwrap();
                progress.processed_recipes += 1;
            }
            task3.update_progress_with_estimation();
        });

        // Wait for all tasks to complete
        let _ = tokio::join!(handle1, handle2, handle3);

        let final_progress = importer.get_progress();
        assert_eq!(final_progress.processed_recipes, 3, "Should have processed 3 recipes");
        
        // Time estimation should be available after concurrent updates
        assert!(final_progress.estimated_time_remaining.is_some(), 
                "Should have time estimation after concurrent updates");
    }

    #[tokio::test]
    async fn test_time_estimation_edge_cases() {
        let importer = BatchImporter::new();
        let task = importer.clone_for_task();

        // Test case 1: No start time set
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 10;
            progress.processed_recipes = 5;
        }
        
        let estimated = task.calculate_estimated_time_remaining();
        assert!(estimated.is_none(), "Should return None when no start time is set");

        // Test case 2: All recipes processed
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - Duration::from_secs(60));
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 10;
            progress.processed_recipes = 10;
        }
        
        let estimated = task.calculate_estimated_time_remaining();
        assert!(estimated.is_none(), "Should return None when all recipes are processed");

        // Test case 3: No recipes processed yet, but some time elapsed
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 10;
            progress.processed_recipes = 0;
        }
        
        let estimated = task.calculate_estimated_time_remaining();
        assert!(estimated.is_some(), "Should provide initial estimate when no progress but time elapsed");
        assert_eq!(estimated.unwrap(), 40, "Should estimate 4 seconds per recipe for 10 recipes");
    }

    #[tokio::test]
    async fn test_time_estimation_cap() {
        let importer = BatchImporter::new();
        let task = importer.clone_for_task();

        // Set up a scenario that would result in a very long estimate
        *importer.start_time.lock().unwrap() = Some(std::time::Instant::now() - Duration::from_secs(3600)); // 1 hour elapsed
        {
            let mut progress = importer.progress.lock().unwrap();
            progress.total_recipes = 100000; // Very large number
            progress.processed_recipes = 1; // Only 1 processed
        }
        
        let estimated = task.calculate_estimated_time_remaining();
        assert!(estimated.is_some(), "Should have an estimate");
        
        let estimated_time = estimated.unwrap();
        assert_eq!(estimated_time, 86400, "Should cap estimate at 24 hours (86400 seconds)");
    }
}
