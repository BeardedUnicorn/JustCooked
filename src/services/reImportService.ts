import { invoke } from '@tauri-apps/api/core';
import {
  ReImportRequest,
  ReImportProgress,
  ReImportOptions
} from '@app-types';
import { createLogger } from '@services/loggingService';

const logger = createLogger('ReImportService');

export class ReImportService {
  private currentImportId: string | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private onProgressCallback: ((progress: ReImportProgress) => void) | null = null;

  /**
   * Start a re-import operation
   */
  async startReImport(
    options?: ReImportOptions
  ): Promise<string> {
    try {
      await logger.info('Starting re-import operation', {
        maxRecipes: options?.maxRecipes,
        recipeIdsCount: options?.recipeIds?.length || 0
      });

      const request: ReImportRequest = {
        maxRecipes: options?.maxRecipes,
        recipeIds: options?.recipeIds,
      };

      await logger.debug('Sending re-import request to backend', {
        maxRecipes: request.maxRecipes,
        recipeIdsCount: request.recipeIds?.length || 0
      });

      const importId: string = await invoke('start_re_import', { request });

      this.currentImportId = importId;
      this.onProgressCallback = options?.onProgress || null;

      // Start progress monitoring
      if (this.onProgressCallback) {
        this.startProgressMonitoring();
      }

      await logger.info('Re-import started successfully', { importId });
      return importId;
    } catch (error) {
      await logger.logError(error, 'Failed to start re-import operation', {
        maxRecipes: options?.maxRecipes,
        recipeIdsCount: options?.recipeIds?.length || 0
      });
      throw new Error(`Failed to start re-import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current progress of a re-import operation
   */
  async getProgress(importId?: string): Promise<ReImportProgress | null> {
    const targetId = importId || this.currentImportId;
    if (!targetId) {
      return null;
    }

    try {
      const progress: ReImportProgress = await invoke('get_re_import_progress', { importId: targetId });
      return progress;
    } catch (error) {
      await logger.logError(error, 'Failed to get re-import progress', { importId: targetId });
      return null;
    }
  }

  /**
   * Cancel a re-import operation
   */
  async cancelReImport(importId?: string): Promise<void> {
    const targetId = importId || this.currentImportId;
    if (!targetId) {
      throw new Error('No re-import operation to cancel');
    }

    try {
      await logger.info('Cancelling re-import operation', { importId: targetId });

      await invoke('cancel_re_import', { importId: targetId });

      // Stop progress monitoring
      this.stopProgressMonitoring();
      this.currentImportId = null;

      await logger.info('Re-import cancelled successfully', { importId: targetId });
    } catch (error) {
      await logger.logError(error, 'Failed to cancel re-import operation', { importId: targetId });
      throw new Error(`Failed to cancel re-import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the count of recipes with source URLs available for re-import
   */
  async getReImportableRecipesCount(): Promise<number> {
    try {
      const count: number = await invoke('get_recipes_with_source_urls_count');
      await logger.debug('Retrieved re-importable recipes count', { count });
      return count;
    } catch (error) {
      await logger.logError(error, 'Failed to get re-importable recipes count');
      return 0;
    }
  }

  /**
   * Add a re-import task to the import queue
   */
  async addToQueue(
    description: string,
    request: ReImportRequest
  ): Promise<string> {
    try {
      await logger.info('Adding re-import task to import queue', { description });

      const taskId: string = await invoke('add_re_import_to_queue', {
        description,
        request,
      });

      await logger.info('Re-import task added to import queue successfully', { taskId, description });
      return taskId;
    } catch (error) {
      await logger.logError(error, 'Failed to add re-import task to import queue', { description });
      throw new Error(`Failed to add re-import task to queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a description for a re-import task
   */
  getTaskDescription(request: ReImportRequest): string {
    if (request.recipeIds && request.recipeIds.length > 0) {
      const count = request.recipeIds.length;
      const maxText = request.maxRecipes ? ` (max ${request.maxRecipes})` : '';
      return `Re-import ${count} specific recipe${count === 1 ? '' : 's'}${maxText}`;
    } else {
      const maxText = request.maxRecipes ? ` (max ${request.maxRecipes})` : '';
      return `Re-import all existing recipes${maxText}`;
    }
  }

  /**
   * Start monitoring progress
   */
  private startProgressMonitoring(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(async () => {
      if (this.currentImportId && this.onProgressCallback) {
        const progress = await this.getProgress(this.currentImportId);
        if (progress) {
          this.onProgressCallback(progress);

          // Stop monitoring if completed or failed
          if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
            this.stopProgressMonitoring();
          }
        }
      }
    }, 1000); // Update every second
  }

  /**
   * Stop monitoring progress
   */
  private stopProgressMonitoring(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopProgressMonitoring();
    this.currentImportId = null;
    this.onProgressCallback = null;
  }
}

// Export a singleton instance
export const reImportService = new ReImportService();
