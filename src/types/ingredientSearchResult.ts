import { IngredientDatabase } from './ingredientDatabase';

export interface IngredientSearchResult {
  ingredient: IngredientDatabase;
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}
