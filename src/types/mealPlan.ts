export interface MealPlanSettings {
  enabledMealTypes: string[]; // ["breakfast", "lunch", "dinner", "snacks"]
  defaultServings: number;
}

export interface MealPlan {
  id: string;
  name: string;
  description?: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
  settings: MealPlanSettings;
  dateCreated: string;
  dateModified: string;
}

export interface MealPlanRecipe {
  id: string;
  mealPlanId: string;
  recipeId: string;
  date: string;      // ISO date string (YYYY-MM-DD)
  mealType: string;  // "breakfast", "lunch", "dinner", "snacks"
  servingMultiplier: number; // 1.0 = original servings, 2.0 = double, etc.
  notes?: string;
  dateCreated: string;
}

// Meal type constants for consistency
export const MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACKS: 'snacks',
} as const;

export type MealType = typeof MEAL_TYPES[keyof typeof MEAL_TYPES];

// Default meal plan settings
export const DEFAULT_MEAL_PLAN_SETTINGS: MealPlanSettings = {
  enabledMealTypes: [MEAL_TYPES.BREAKFAST, MEAL_TYPES.LUNCH, MEAL_TYPES.DINNER],
  defaultServings: 4,
};

// Helper function to get meal type display name
export function getMealTypeDisplayName(mealType: string): string {
  switch (mealType) {
    case MEAL_TYPES.BREAKFAST:
      return 'Breakfast';
    case MEAL_TYPES.LUNCH:
      return 'Lunch';
    case MEAL_TYPES.DINNER:
      return 'Dinner';
    case MEAL_TYPES.SNACKS:
      return 'Snacks';
    default:
      return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  }
}

// Helper function to get meal type order for sorting
export function getMealTypeOrder(mealType: string): number {
  switch (mealType) {
    case MEAL_TYPES.BREAKFAST:
      return 0;
    case MEAL_TYPES.LUNCH:
      return 1;
    case MEAL_TYPES.DINNER:
      return 2;
    case MEAL_TYPES.SNACKS:
      return 3;
    default:
      return 999;
  }
}
