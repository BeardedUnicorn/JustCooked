export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbs?: number;           // From recipe context
  carbohydrates?: number;   // From ingredient context (alias for carbs)
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;          // Additional field from ingredient context
  // All values per 100g/100ml
}
