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
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  expiryDate?: string;
}
