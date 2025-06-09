export interface BatchImportRequest {
  startUrl: string;
  maxRecipes?: number;
  maxDepth?: number;
  existingUrls?: string[];
}

export interface BatchImportProgress {
  status: BatchImportStatus;
  currentUrl?: string;
  processedRecipes: number;
  totalRecipes: number;
  processedCategories: number;
  totalCategories: number;
  successfulImports: number;
  failedImports: number;
  skippedRecipes: number;
  errors: BatchImportError[];
  startTime: string;
  estimatedTimeRemaining?: number;
}

export interface BatchImportResult {
  success: boolean;
  totalProcessed: number;
  successfulImports: number;
  failedImports: number;
  skippedRecipes: number;
  errors: BatchImportError[];
  importedRecipeIds: string[];
  duration: number;
}

export interface BatchImportError {
  url: string;
  message: string;
  timestamp: string;
  errorType: 'NetworkError' | 'ParseError' | 'ValidationError' | 'ImportError';
}

export interface CategoryInfo {
  name: string;
  url: string;
  processed: boolean;
  recipeCount?: number;
}

export interface RecipeUrlInfo {
  url: string;
  processed: boolean;
  imported: boolean;
  error?: string;
}

export enum BatchImportStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  CRAWLING_CATEGORIES = 'crawlingCategories',
  EXTRACTING_RECIPES = 'extractingRecipes',
  FILTERING_EXISTING = 'filteringExisting',
  IMPORTING_RECIPES = 'importingRecipes',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

// Configuration for batch import behavior
export interface BatchImportConfig {
  maxConcurrentImports: number;
  delayBetweenRequests: number; // milliseconds
  retryAttempts: number;
  skipExistingRecipes: boolean;
  respectRobotsTxt: boolean;
}

export const DEFAULT_BATCH_IMPORT_CONFIG: BatchImportConfig = {
  maxConcurrentImports: 3,
  delayBetweenRequests: 1000, // 1 second
  retryAttempts: 2,
  skipExistingRecipes: true,
  respectRobotsTxt: true,
};
