import { invoke } from '@tauri-apps/api/core';
import { ShoppingList, ShoppingListItem, Recipe, MealPlanRecipe, categorizeIngredient } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Shopping List CRUD operations
export async function saveShoppingList(shoppingList: ShoppingList): Promise<void> {
  try {
    await invoke('db_save_shopping_list', { shoppingList });
  } catch (error) {
    console.error('Failed to save shopping list:', error);
    throw error;
  }
}

export async function getAllShoppingLists(): Promise<ShoppingList[]> {
  try {
    return await invoke<ShoppingList[]>('db_get_all_shopping_lists');
  } catch (error) {
    console.error('Failed to get all shopping lists:', error);
    return [];
  }
}

export async function getShoppingListsByMealPlan(mealPlanId: string): Promise<ShoppingList[]> {
  try {
    return await invoke<ShoppingList[]>('db_get_shopping_lists_by_meal_plan', { mealPlanId });
  } catch (error) {
    console.error('Failed to get shopping lists by meal plan:', error);
    return [];
  }
}

export async function getShoppingListById(id: string): Promise<ShoppingList | null> {
  try {
    return await invoke<ShoppingList | null>('db_get_shopping_list_by_id', { id });
  } catch (error) {
    console.error('Failed to get shopping list by id:', error);
    return null;
  }
}

export async function deleteShoppingList(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_shopping_list', { id });
  } catch (error) {
    console.error('Failed to delete shopping list:', error);
    return false;
  }
}

// Shopping List Item CRUD operations
export async function saveShoppingListItem(item: ShoppingListItem): Promise<void> {
  try {
    await invoke('db_save_shopping_list_item', { item });
  } catch (error) {
    console.error('Failed to save shopping list item:', error);
    throw error;
  }
}

export async function getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]> {
  try {
    return await invoke<ShoppingListItem[]>('db_get_shopping_list_items', { shoppingListId });
  } catch (error) {
    console.error('Failed to get shopping list items:', error);
    return [];
  }
}

export async function updateShoppingListItemChecked(id: string, isChecked: boolean): Promise<void> {
  try {
    await invoke('db_update_shopping_list_item_checked', { id, isChecked });
  } catch (error) {
    console.error('Failed to update shopping list item checked status:', error);
    throw error;
  }
}

export async function deleteShoppingListItem(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_shopping_list_item', { id });
  } catch (error) {
    console.error('Failed to delete shopping list item:', error);
    return false;
  }
}

// Helper functions for creating shopping lists
export function createNewShoppingList(
  mealPlanId: string,
  name: string,
  dateRangeStart: string,
  dateRangeEnd: string
): ShoppingList {
  const currentTime = getCurrentTimestamp();
  
  return {
    id: crypto.randomUUID(),
    mealPlanId,
    name,
    dateRangeStart,
    dateRangeEnd,
    dateCreated: currentTime,
    dateModified: currentTime,
  };
}

export function createNewShoppingListItem(
  shoppingListId: string,
  ingredientName: string,
  quantity: number,
  unit: string,
  category?: string,
  notes?: string
): ShoppingListItem {
  return {
    id: crypto.randomUUID(),
    shoppingListId,
    ingredientName,
    quantity,
    unit,
    category: category || categorizeIngredient(ingredientName),
    isChecked: false,
    notes,
    dateCreated: getCurrentTimestamp(),
  };
}

// Shopping list generation from meal plan recipes
export interface ConsolidatedIngredient {
  name: string;
  totalQuantity: number;
  unit: string;
  category: string;
  sources: string[]; // Recipe names that contributed to this ingredient
}

export function consolidateIngredients(
  recipes: Recipe[],
  mealPlanRecipes: MealPlanRecipe[]
): ConsolidatedIngredient[] {
  const ingredientMap = new Map<string, ConsolidatedIngredient>();
  
  mealPlanRecipes.forEach(mealPlanRecipe => {
    const recipe = recipes.find(r => r.id === mealPlanRecipe.recipeId);
    if (!recipe) return;
    
    recipe.ingredients.forEach(ingredient => {
      const adjustedQuantity = ingredient.amount * mealPlanRecipe.servingMultiplier;
      const key = `${ingredient.name.toLowerCase()}-${ingredient.unit.toLowerCase()}`;
      
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalQuantity += adjustedQuantity;
        if (!existing.sources.includes(recipe.title)) {
          existing.sources.push(recipe.title);
        }
      } else {
        ingredientMap.set(key, {
          name: ingredient.name,
          totalQuantity: adjustedQuantity,
          unit: ingredient.unit,
          category: categorizeIngredient(ingredient.name),
          sources: [recipe.title],
        });
      }
    });
  });
  
  return Array.from(ingredientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function generateShoppingListFromMealPlan(
  mealPlanId: string,
  name: string,
  dateRangeStart: string,
  dateRangeEnd: string,
  recipes: Recipe[],
  mealPlanRecipes: MealPlanRecipe[]
): Promise<string> {
  // Filter meal plan recipes to the specified date range
  const filteredMealPlanRecipes = mealPlanRecipes.filter(mpr => 
    mpr.date >= dateRangeStart && mpr.date <= dateRangeEnd
  );
  
  // Create the shopping list
  const shoppingList = createNewShoppingList(mealPlanId, name, dateRangeStart, dateRangeEnd);
  await saveShoppingList(shoppingList);
  
  // Consolidate ingredients
  const consolidatedIngredients = consolidateIngredients(recipes, filteredMealPlanRecipes);
  
  // Create shopping list items
  for (const ingredient of consolidatedIngredients) {
    const item = createNewShoppingListItem(
      shoppingList.id,
      ingredient.name,
      ingredient.totalQuantity,
      ingredient.unit,
      ingredient.category,
      `From: ${ingredient.sources.join(', ')}`
    );
    await saveShoppingListItem(item);
  }
  
  return shoppingList.id;
}

// Group shopping list items by category for display
export function groupShoppingListItemsByCategory(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
  const grouped: Record<string, ShoppingListItem[]> = {};
  
  items.forEach(item => {
    const category = item.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });
  
  // Sort items within each category
  Object.keys(grouped).forEach(category => {
    grouped[category].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  });
  
  return grouped;
}

// Calculate shopping list completion percentage
export function calculateShoppingListProgress(items: ShoppingListItem[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = items.length;
  const completed = items.filter(item => item.isChecked).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
}

// Export shopping list as text for sharing/printing
export function exportShoppingListAsText(
  shoppingList: ShoppingList,
  items: ShoppingListItem[]
): string {
  const groupedItems = groupShoppingListItemsByCategory(items);
  const progress = calculateShoppingListProgress(items);
  
  let text = `${shoppingList.name}\n`;
  text += `Date Range: ${shoppingList.dateRangeStart} to ${shoppingList.dateRangeEnd}\n`;
  text += `Progress: ${progress.completed}/${progress.total} items (${progress.percentage}%)\n\n`;
  
  Object.entries(groupedItems).forEach(([category, categoryItems]) => {
    text += `${category.toUpperCase()}\n`;
    text += '─'.repeat(category.length + 10) + '\n';
    
    categoryItems.forEach(item => {
      const checkbox = item.isChecked ? '☑' : '☐';
      text += `${checkbox} ${item.quantity} ${item.unit} ${item.ingredientName}\n`;
      if (item.notes) {
        text += `   Note: ${item.notes}\n`;
      }
    });
    
    text += '\n';
  });
  
  return text;
}
