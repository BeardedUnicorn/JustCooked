import { invoke } from '@tauri-apps/api/core';
import {
  BatchImportRequest,
  BatchImportProgress,
  BatchImportStatus
} from '@app-types';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import { createLogger } from '@services/loggingService';

const logger = createLogger('BatchImport');

export class BatchImportService {
  private currentImportId: string | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private onProgressCallback: ((progress: BatchImportProgress) => void) | null = null;

  /**
   * Start a batch import operation
   */
  async startBatchImport(
    startUrl: string,
    options?: {
      maxRecipes?: number;
      maxDepth?: number;
      onProgress?: (progress: BatchImportProgress) => void;
    }
  ): Promise<string> {
    try {
      await logger.info('Starting batch import', {
        startUrl,
        maxRecipes: options?.maxRecipes,
        maxDepth: options?.maxDepth
      });

      // Validate URL
      if (!this.isValidAllRecipesUrl(startUrl)) {
        const error = new Error('Invalid AllRecipes URL. Please provide a valid AllRecipes category URL.');
        await logger.error('Invalid URL provided for batch import', { startUrl });
        throw error;
      }

      // Stop any existing import and clean up
      if (this.currentImportId) {
        await logger.warn('Cancelling existing batch import to start new one', {
          existingImportId: this.currentImportId,
          newUrl: startUrl
        });
        try {
          await this.cancelBatchImport();
        } catch (error) {
          await logger.warn('Failed to cancel previous import, continuing with new import', { error: error instanceof Error ? error.message : String(error) });
        }
        // Clear the current import ID to allow new import
        this.currentImportId = null;
      }

      // Get existing recipe URLs to skip
      await logger.debug('Fetching existing recipe URLs for deduplication');
      const existingUrls = await getExistingRecipeUrls();
      await logger.info('Retrieved existing recipe URLs', { count: existingUrls.length });

      const request: BatchImportRequest = {
        startUrl,
        maxRecipes: options?.maxRecipes,
        maxDepth: options?.maxDepth,
        existingUrls,
      };

      await logger.debug('Sending batch import request to backend', {
        startUrl: request.startUrl,
        maxRecipes: request.maxRecipes,
        existingUrlCount: request.existingUrls?.length || 0
      });

      // Start the import
      const importId: string = await invoke('start_batch_import', { request });
      this.currentImportId = importId;

      await logger.info('Batch import started successfully', { importId });

      // Set up progress tracking
      if (options?.onProgress) {
        this.onProgressCallback = options.onProgress;
        this.startProgressTracking();
        await logger.debug('Progress tracking enabled for batch import', { importId });
      }

      return importId;
    } catch (error) {
      await logger.logError(error, 'Failed to start batch import', { startUrl });
      throw new Error(`Failed to start batch import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current progress of the batch import
   */
  async getProgress(): Promise<BatchImportProgress | null> {
    if (!this.currentImportId) {
      return null;
    }

    try {
      const progress: BatchImportProgress = await invoke('get_batch_import_progress', {
        importId: this.currentImportId,
      });
      return progress;
    } catch (error) {
      await logger.warn('Failed to get batch import progress', {
        importId: this.currentImportId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Cancel the current batch import
   */
  async cancelBatchImport(): Promise<void> {
    if (!this.currentImportId) {
      return;
    }

    const importIdToCancel = this.currentImportId;

    try {
      await invoke('cancel_batch_import', { importId: importIdToCancel });
      this.stopProgressTracking();
      this.currentImportId = null;
    } catch (error: any) {
      console.error('Failed to cancel batch import:', error);
      // Don't throw error if session not found - it might have already completed
      if (!error.toString().includes('Import session not found')) {
        throw new Error(`Failed to cancel batch import: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Clean up local state even if backend session not found
      this.stopProgressTracking();
      this.currentImportId = null;
    }
  }

  /**
   * Check if there's an active import
   */
  isImportActive(): boolean {
    return this.currentImportId !== null;
  }

  /**
   * Get the current import ID
   */
  getCurrentImportId(): string | null {
    return this.currentImportId;
  }

  /**
   * Start tracking progress with periodic updates
   */
  private startProgressTracking(): void {
    this.stopProgressTracking(); // Clear any existing interval

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    this.progressInterval = setInterval(async () => {
      try {
        const progress = await this.getProgress();
        if (progress && this.onProgressCallback) {
          consecutiveErrors = 0; // Reset error counter on success
          this.onProgressCallback(progress);

          // Stop tracking if import is complete or cancelled
          // Handle both enum values and string values from Rust backend
          const statusStr = typeof progress.status === 'string' ? progress.status.toLowerCase() : progress.status;
          if (
            statusStr === BatchImportStatus.COMPLETED ||
            statusStr === 'completed' ||
            statusStr === BatchImportStatus.CANCELLED ||
            statusStr === 'cancelled' ||
            statusStr === BatchImportStatus.ERROR ||
            statusStr === 'error'
          ) {
            this.stopProgressTracking();
            // Don't clear currentImportId immediately - let the dialog handle cleanup
            // This prevents "session not found" errors when trying to start a new import
            setTimeout(() => {
              this.currentImportId = null;
            }, 5000); // Clear after 5 seconds
          }
        }
      } catch (error) {
        consecutiveErrors++;
        await logger.logError(error, 'Error tracking progress');

        // Stop tracking after too many consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          logger.error(`Stopping progress tracking after ${maxConsecutiveErrors} consecutive errors`);
          this.stopProgressTracking();
          this.currentImportId = null;
        }
      }
    }, 2000); // Update every 2 seconds
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.onProgressCallback = null;
  }

  /**
   * Validate if URL is a valid AllRecipes category URL
   */
  private isValidAllRecipesUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      return (
        hostname.includes('allrecipes.com') &&
        pathname.includes('/recipes/') &&
        !pathname.includes('/recipe/') // Exclude individual recipes
      );
    } catch {
      return false;
    }
  }

  /**
   * Get suggested category URLs for AllRecipes
   */
  getSuggestedCategoryUrls(): Array<{ name: string; url: string; description: string }> {
    return [
      {
        name: 'Desserts',
        url: 'https://www.allrecipes.com/recipes/79/desserts',
        description: 'All dessert recipes including cakes, cookies, pies, and more',
      },
      {
        name: 'Main Dishes',
        url: 'https://www.allrecipes.com/recipes/17562/dinner/main-dishes',
        description: 'Main course recipes for lunch and dinner',
      },
      {
        name: 'Appetizers',
        url: 'https://www.allrecipes.com/recipes/76/appetizers-and-snacks',
        description: 'Appetizers, snacks, and party foods',
      },
      {
        name: 'Breakfast',
        url: 'https://www.allrecipes.com/recipes/78/breakfast-and-brunch',
        description: 'Breakfast and brunch recipes',
      },
      {
        name: 'Soups & Stews',
        url: 'https://www.allrecipes.com/recipes/94/soups-stews-and-chili',
        description: 'Comforting soups, stews, and chili recipes',
      },
      {
        name: 'Salads',
        url: 'https://www.allrecipes.com/recipes/96/salad',
        description: 'Fresh salads and dressings',
      },
    ];
  }

  /**
   * Get popular category URLs for quick start batch import
   */
  getPopularCategoryUrls(): string[] {
    return [
      'https://www.allrecipes.com/recipes/17057/everyday-cooking/more-meal-ideas/5-ingredients/main-dishes/',
      'https://www.allrecipes.com/recipes/15436/everyday-cooking/one-pot-meals/',
      'https://www.allrecipes.com/recipes/1947/everyday-cooking/quick-and-easy/',
      'https://www.allrecipes.com/recipes/455/everyday-cooking/more-meal-ideas/30-minute-meals/',
      'https://www.allrecipes.com/recipes/17889/everyday-cooking/family-friendly/family-dinners/',
      'https://www.allrecipes.com/recipes/94/soups-stews-and-chili/',
      'https://www.allrecipes.com/recipes/16099/everyday-cooking/comfort-food/',
      'https://www.allrecipes.com/recipes/80/main-dish/',
      'https://www.allrecipes.com/recipes/22992/everyday-cooking/sheet-pan-dinners/',
      'https://www.allrecipes.com/recipes/78/breakfast-and-brunch/',
      'https://www.allrecipes.com/recipes/17561/lunch/',
      'https://www.allrecipes.com/recipes/84/healthy-recipes/',
      'https://www.allrecipes.com/recipes/76/appetizers-and-snacks/',
      'https://www.allrecipes.com/recipes/96/salad/',
      'https://www.allrecipes.com/recipes/81/side-dish/',
      'https://www.allrecipes.com/recipes/16369/soups-stews-and-chili/soup/',
      'https://www.allrecipes.com/recipes/156/bread/',
      'https://www.allrecipes.com/recipes/77/drinks/',
      'https://www.allrecipes.com/recipes/79/desserts/',
      'https://www.allrecipes.com/recipes/85/holidays-and-events/',
    ];
  }

  /**
   * Estimate import time based on number of recipes
   */
  estimateImportTime(estimatedRecipes: number): {
    minMinutes: number;
    maxMinutes: number;
    description: string;
  } {
    // Estimate 3-5 seconds per recipe (including delays)
    const minSeconds = estimatedRecipes * 3;
    const maxSeconds = estimatedRecipes * 5;

    const minMinutes = Math.ceil(minSeconds / 60);
    const maxMinutes = Math.ceil(maxSeconds / 60);

    let description = '';
    if (maxMinutes < 5) {
      description = 'Quick import';
    } else if (maxMinutes < 30) {
      description = 'Medium import';
    } else {
      description = 'Long import - consider limiting the number of recipes';
    }

    return { minMinutes, maxMinutes, description };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopProgressTracking();
    this.currentImportId = null;
  }
}

// Export a singleton instance
export const batchImportService = new BatchImportService();

// Export utility functions
export {
  BatchImportStatus,
} from '@app-types';
