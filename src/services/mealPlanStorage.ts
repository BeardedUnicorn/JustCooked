import { invoke } from '@tauri-apps/api/core';
import { MealPlan, MealPlanRecipe } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Meal Plan CRUD operations
export async function saveMealPlan(mealPlan: MealPlan): Promise<void> {
  try {
    await invoke('db_save_meal_plan', { mealPlan });
  } catch (error) {
    console.error('Failed to save meal plan:', error);
    throw error;
  }
}

export async function getAllMealPlans(): Promise<MealPlan[]> {
  try {
    return await invoke<MealPlan[]>('db_get_all_meal_plans');
  } catch (error) {
    console.error('Failed to get all meal plans:', error);
    return [];
  }
}

export async function getMealPlanById(id: string): Promise<MealPlan | null> {
  try {
    return await invoke<MealPlan | null>('db_get_meal_plan_by_id', { id });
  } catch (error) {
    console.error('Failed to get meal plan by id:', error);
    return null;
  }
}

export async function deleteMealPlan(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_meal_plan', { id });
  } catch (error) {
    console.error('Failed to delete meal plan:', error);
    return false;
  }
}

// Meal Plan Recipe CRUD operations
export async function saveMealPlanRecipe(mealPlanRecipe: MealPlanRecipe): Promise<void> {
  try {
    await invoke('db_save_meal_plan_recipe', { mealPlanRecipe });
  } catch (error) {
    console.error('Failed to save meal plan recipe:', error);
    throw error;
  }
}

export async function getMealPlanRecipes(mealPlanId: string): Promise<MealPlanRecipe[]> {
  try {
    return await invoke<MealPlanRecipe[]>('db_get_meal_plan_recipes', { mealPlanId });
  } catch (error) {
    console.error('Failed to get meal plan recipes:', error);
    return [];
  }
}

export async function deleteMealPlanRecipe(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_meal_plan_recipe', { id });
  } catch (error) {
    console.error('Failed to delete meal plan recipe:', error);
    return false;
  }
}

// Helper functions for creating new meal plans and recipes
export function createNewMealPlan(
  name: string,
  startDate: string,
  endDate: string,
  description?: string
): MealPlan {
  const currentTime = getCurrentTimestamp();
  
  return {
    id: crypto.randomUUID(),
    name,
    description,
    startDate,
    endDate,
    settings: {
      enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
      defaultServings: 4,
    },
    dateCreated: currentTime,
    dateModified: currentTime,
  };
}

export function createNewMealPlanRecipe(
  mealPlanId: string,
  recipeId: string,
  date: string,
  mealType: string,
  servingMultiplier: number = 1.0,
  notes?: string
): MealPlanRecipe {
  return {
    id: crypto.randomUUID(),
    mealPlanId,
    recipeId,
    date,
    mealType,
    servingMultiplier,
    notes,
    dateCreated: getCurrentTimestamp(),
  };
}

// Utility functions for meal plan management
export function getMealPlanDuration(mealPlan: MealPlan): number {
  const startDate = new Date(mealPlan.startDate);
  const endDate = new Date(mealPlan.endDate);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

export function getMealPlanDates(mealPlan: MealPlan): string[] {
  const dates: string[] = [];
  const startDate = new Date(mealPlan.startDate);
  const endDate = new Date(mealPlan.endDate);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    dates.push(date.toISOString().split('T')[0]); // Format as YYYY-MM-DD
  }
  
  return dates;
}

export function isMealPlanActive(mealPlan: MealPlan): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today >= mealPlan.startDate && today <= mealPlan.endDate;
}

export function isMealPlanUpcoming(mealPlan: MealPlan): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today < mealPlan.startDate;
}

export function isMealPlanPast(mealPlan: MealPlan): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today > mealPlan.endDate;
}

// Group meal plan recipes by date and meal type for calendar display
export function groupMealPlanRecipesByDate(recipes: MealPlanRecipe[]): Record<string, Record<string, MealPlanRecipe[]>> {
  const grouped: Record<string, Record<string, MealPlanRecipe[]>> = {};
  
  recipes.forEach(recipe => {
    if (!grouped[recipe.date]) {
      grouped[recipe.date] = {};
    }
    if (!grouped[recipe.date][recipe.mealType]) {
      grouped[recipe.date][recipe.mealType] = [];
    }
    grouped[recipe.date][recipe.mealType].push(recipe);
  });
  
  return grouped;
}

// Get recipes for a specific date and meal type
export function getRecipesForDateAndMealType(
  recipes: MealPlanRecipe[],
  date: string,
  mealType: string
): MealPlanRecipe[] {
  return recipes.filter(recipe => recipe.date === date && recipe.mealType === mealType);
}

// Calculate total servings for a meal plan recipe considering multiplier
export function calculateAdjustedServings(originalServings: number, multiplier: number): number {
  return Math.round(originalServings * multiplier);
}
