import { Ingredient } from './basicIngredient';
import { NutritionalInfo } from './NutritionalInfo';

export interface Recipe {
  id: string;
  title: string;
  description: string;
  image: string;
  sourceUrl: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  dateAdded: string;
  dateModified: string;
  // New fields for enhanced features
  rating?: number; // 1-5 stars
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  isFavorite?: boolean;
  personalNotes?: string;
  collections?: string[]; // Array of collection IDs
  nutritionalInfo?: NutritionalInfo;
}
