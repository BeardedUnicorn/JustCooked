export interface SearchFilters {
  query?: string;
  tags?: string[];
  difficulty?: string[];
  maxPrepTime?: number;
  maxCookTime?: number;
  maxTotalTime?: number;
  minRating?: number;
  dietaryRestrictions?: string[];
  // Additional properties for AdvancedSearchModal
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: number[];
  rating?: number;
}
