import { invoke } from '@tauri-apps/api/core';
import {
  BatchImportRequest,
  BatchImportProgress,
  BatchImportStatus
} from '@app-types';
import { getExistingRecipeUrls } from '@services/recipeStorage';

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
      // Validate URL
      if (!this.isValidAllRecipesUrl(startUrl)) {
        throw new Error('Invalid AllRecipes URL. Please provide a valid AllRecipes category URL.');
      }

      // Stop any existing import
      if (this.currentImportId) {
        await this.cancelBatchImport();
      }

      // Get existing recipe URLs to skip
      console.log('Getting existing recipe URLs...');
      const existingUrls = await getExistingRecipeUrls();
      console.log(`Found ${existingUrls.length} existing recipe URLs`);

      const request: BatchImportRequest = {
        startUrl,
        maxRecipes: options?.maxRecipes,
        maxDepth: options?.maxDepth,
        existingUrls,
      };

      console.log('Starting batch import:', request);

      // Start the import
      const importId: string = await invoke('start_batch_import', { request });
      this.currentImportId = importId;

      // Set up progress tracking
      if (options?.onProgress) {
        this.onProgressCallback = options.onProgress;
        this.startProgressTracking();
      }

      return importId;
    } catch (error) {
      console.error('Failed to start batch import:', error);
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
      console.error('Failed to get batch import progress:', error);
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

    try {
      await invoke('cancel_batch_import', { importId: this.currentImportId });
      this.stopProgressTracking();
      this.currentImportId = null;
    } catch (error) {
      console.error('Failed to cancel batch import:', error);
      throw new Error(`Failed to cancel batch import: ${error instanceof Error ? error.message : String(error)}`);
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

    this.progressInterval = setInterval(async () => {
      try {
        const progress = await this.getProgress();
        if (progress && this.onProgressCallback) {
          this.onProgressCallback(progress);

          // Stop tracking if import is complete or cancelled
          if (
            progress.status === BatchImportStatus.COMPLETED ||
            progress.status === BatchImportStatus.CANCELLED ||
            progress.status === BatchImportStatus.ERROR
          ) {
            this.stopProgressTracking();
            this.currentImportId = null;
          }
        }
      } catch (error) {
        console.error('Error tracking progress:', error);
        this.stopProgressTracking();
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
