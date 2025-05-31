export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface IngredientDatabase {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  nutritionalInfo?: NutritionalInfo;
  storageInfo?: StorageInfo;
  dateAdded: string;
  dateModified: string;
}

export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  // All values per 100g/100ml
}

export interface StorageInfo {
  shelfLife?: string;
  storageMethod?: string;
  temperature?: string;
}

export interface IngredientCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// Predefined categories
export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  { id: 'vegetables', name: 'Vegetables', color: '#4CAF50' },
  { id: 'fruits', name: 'Fruits', color: '#FF9800' },
  { id: 'meat', name: 'Meat & Poultry', color: '#F44336' },
  { id: 'seafood', name: 'Seafood', color: '#2196F3' },
  { id: 'dairy', name: 'Dairy & Eggs', color: '#FFEB3B' },
  { id: 'grains', name: 'Grains & Cereals', color: '#8BC34A' },
  { id: 'legumes', name: 'Legumes & Nuts', color: '#795548' },
  { id: 'herbs', name: 'Herbs & Spices', color: '#4CAF50' },
  { id: 'oils', name: 'Oils & Fats', color: '#FFC107' },
  { id: 'condiments', name: 'Condiments & Sauces', color: '#9C27B0' },
  { id: 'baking', name: 'Baking Ingredients', color: '#E91E63' },
  { id: 'beverages', name: 'Beverages', color: '#00BCD4' },
  { id: 'other', name: 'Other', color: '#9E9E9E' },
];

export interface IngredientSearchResult {
  ingredient: IngredientDatabase;
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}
