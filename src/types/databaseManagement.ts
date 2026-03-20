import { Recipe } from './recipeType';
import { IngredientDatabase } from './ingredientDatabase';
import { PantryItem } from './pantryItem';
import { RecipeCollection } from './recipeCollection';
import { RecentSearch } from './recentSearch';
import { RawIngredient } from './rawIngredient';

export interface DatabaseExport {
  version: string;
  export_date: string;
  recipes: Recipe[];
  ingredients: IngredientDatabase[];
  pantry_items: PantryItem[];
  recipe_collections: RecipeCollection[];
  recent_searches: RecentSearch[];
  raw_ingredients: RawIngredient[];
}

export interface DatabaseImportResult {
  recipes_imported: number;
  recipes_failed: number;
  ingredients_imported: number;
  ingredients_failed: number;
  pantry_items_imported: number;
  pantry_items_failed: number;
  collections_imported: number;
  collections_failed: number;
  searches_imported: number;
  searches_failed: number;
  raw_ingredients_imported: number;
  raw_ingredients_failed: number;
  errors: string[];
}

export interface IngredientCatalogRepairResult {
  scanned: number;
  updated: number;
  merged: number;
  removed: number;
}

export interface DatabaseStats {
  total_recipes: number;
  total_ingredients: number;
  total_pantry_items: number;
  total_collections: number;
  total_searches: number;
  total_raw_ingredients: number;
}

export enum DatabaseOperation {
  EXPORT = 'export',
  IMPORT = 'import',
  RESET = 'reset'
}

export interface DatabaseOperationProgress {
  operation: DatabaseOperation;
  status: 'idle' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  message?: string;
  error?: string;
}
