import { BatchImportProgress, BatchImportResult } from './batchImport';

export interface ReImportRequest {
  maxRecipes?: number;
  recipeIds?: string[]; // Optional: specific recipes to re-import
}

export interface ReImportProgress extends BatchImportProgress {
  // Re-import uses the same progress structure as batch import
}

export interface ReImportResult extends BatchImportResult {
  // Re-import uses the same result structure as batch import
}

export interface ReImportOptions {
  maxRecipes?: number;
  recipeIds?: string[];
  onProgress?: (progress: ReImportProgress) => void;
}
