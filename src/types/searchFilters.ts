export interface SearchFilters {
  query?: string;
  tags?: string[];
  difficulty?: string[];
  maxPrepTime?: number;
  maxCookTime?: number;
  maxTotalTime?: number;
  minRating?: number;
  dietaryRestrictions?: string[];
}
