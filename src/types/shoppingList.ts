export interface ShoppingList {
  id: string;
  mealPlanId: string;
  name: string;
  dateRangeStart: string; // ISO date string (YYYY-MM-DD)
  dateRangeEnd: string;   // ISO date string (YYYY-MM-DD)
  dateCreated: string;
  dateModified: string;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  category?: string;
  isChecked: boolean;
  notes?: string;
  dateCreated: string;
}

// Shopping list item categories for organization
export const SHOPPING_CATEGORIES = {
  PRODUCE: 'produce',
  DAIRY: 'dairy',
  MEAT: 'meat',
  SEAFOOD: 'seafood',
  PANTRY: 'pantry',
  BAKERY: 'bakery',
  FROZEN: 'frozen',
  BEVERAGES: 'beverages',
  CONDIMENTS: 'condiments',
  SPICES: 'spices',
  OTHER: 'other',
} as const;

export type ShoppingCategory = typeof SHOPPING_CATEGORIES[keyof typeof SHOPPING_CATEGORIES];

// Helper function to get category display name
export function getCategoryDisplayName(category: string): string {
  switch (category) {
    case SHOPPING_CATEGORIES.PRODUCE:
      return 'Produce';
    case SHOPPING_CATEGORIES.DAIRY:
      return 'Dairy';
    case SHOPPING_CATEGORIES.MEAT:
      return 'Meat';
    case SHOPPING_CATEGORIES.SEAFOOD:
      return 'Seafood';
    case SHOPPING_CATEGORIES.PANTRY:
      return 'Pantry';
    case SHOPPING_CATEGORIES.BAKERY:
      return 'Bakery';
    case SHOPPING_CATEGORIES.FROZEN:
      return 'Frozen';
    case SHOPPING_CATEGORIES.BEVERAGES:
      return 'Beverages';
    case SHOPPING_CATEGORIES.CONDIMENTS:
      return 'Condiments';
    case SHOPPING_CATEGORIES.SPICES:
      return 'Spices';
    case SHOPPING_CATEGORIES.OTHER:
      return 'Other';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

// Helper function to get category order for sorting
export function getCategoryOrder(category: string): number {
  switch (category) {
    case SHOPPING_CATEGORIES.PRODUCE:
      return 0;
    case SHOPPING_CATEGORIES.DAIRY:
      return 1;
    case SHOPPING_CATEGORIES.MEAT:
      return 2;
    case SHOPPING_CATEGORIES.SEAFOOD:
      return 3;
    case SHOPPING_CATEGORIES.PANTRY:
      return 4;
    case SHOPPING_CATEGORIES.BAKERY:
      return 5;
    case SHOPPING_CATEGORIES.FROZEN:
      return 6;
    case SHOPPING_CATEGORIES.BEVERAGES:
      return 7;
    case SHOPPING_CATEGORIES.CONDIMENTS:
      return 8;
    case SHOPPING_CATEGORIES.SPICES:
      return 9;
    case SHOPPING_CATEGORIES.OTHER:
      return 10;
    default:
      return 999;
  }
}

// Helper function to automatically categorize ingredients
export function categorizeIngredient(ingredientName: string): string {
  const name = ingredientName.toLowerCase();
  
  // Produce
  if (name.includes('onion') || name.includes('garlic') || name.includes('tomato') || 
      name.includes('lettuce') || name.includes('carrot') || name.includes('potato') ||
      name.includes('pepper') || name.includes('apple') || name.includes('banana') ||
      name.includes('lemon') || name.includes('lime') || name.includes('herb') ||
      name.includes('spinach') || name.includes('broccoli') || name.includes('celery')) {
    return SHOPPING_CATEGORIES.PRODUCE;
  }
  
  // Dairy
  if (name.includes('milk') || name.includes('cheese') || name.includes('butter') ||
      name.includes('cream') || name.includes('yogurt') || name.includes('egg')) {
    return SHOPPING_CATEGORIES.DAIRY;
  }
  
  // Meat
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
      name.includes('turkey') || name.includes('bacon') || name.includes('sausage') ||
      name.includes('ham') || name.includes('ground')) {
    return SHOPPING_CATEGORIES.MEAT;
  }
  
  // Seafood
  if (name.includes('fish') || name.includes('salmon') || name.includes('tuna') ||
      name.includes('shrimp') || name.includes('crab') || name.includes('lobster')) {
    return SHOPPING_CATEGORIES.SEAFOOD;
  }
  
  // Pantry
  if (name.includes('flour') || name.includes('sugar') || name.includes('rice') ||
      name.includes('pasta') || name.includes('bread') || name.includes('oil') ||
      name.includes('vinegar') || name.includes('can') || name.includes('jar')) {
    return SHOPPING_CATEGORIES.PANTRY;
  }
  
  // Spices
  if (name.includes('salt') || name.includes('pepper') || name.includes('spice') ||
      name.includes('seasoning') || name.includes('oregano') || name.includes('basil') ||
      name.includes('thyme') || name.includes('rosemary') || name.includes('cumin')) {
    return SHOPPING_CATEGORIES.SPICES;
  }
  
  return SHOPPING_CATEGORIES.OTHER;
}
