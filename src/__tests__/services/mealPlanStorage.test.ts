import {
  createNewMealPlan,
  createNewMealPlanRecipe,
  getMealPlanDuration,
  getMealPlanDates,
  isMealPlanActive,
  isMealPlanUpcoming,
  isMealPlanPast,
  groupMealPlanRecipesByDate,
  getRecipesForDateAndMealType,
  calculateAdjustedServings,
} from '@services/mealPlanStorage';
import { MealPlan, MealPlanRecipe } from '@app-types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock getCurrentTimestamp
vi.mock('@utils/timeUtils', () => ({
  getCurrentTimestamp: vi.fn(() => '2024-01-15T12:00:00Z'),
  formatLocalDate: vi.fn((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }),
  parseDateOnly: vi.fn((dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }),
  getTodayLocalDateString: vi.fn(() => '2024-01-15'),
}));

describe('mealPlanStorage', () => {
  describe('createNewMealPlan', () => {
    it('creates a new meal plan with correct properties', () => {
      const mealPlan = createNewMealPlan(
        'Test Meal Plan',
        '2024-01-15',
        '2024-01-21',
        'A test meal plan'
      );

      expect(mealPlan).toMatchObject({
        name: 'Test Meal Plan',
        description: 'A test meal plan',
        startDate: '2024-01-15',
        endDate: '2024-01-21',
        settings: {
          enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
          defaultServings: 4,
        },
        dateCreated: '2024-01-15T12:00:00Z',
        dateModified: '2024-01-15T12:00:00Z',
      });

      expect(mealPlan.id).toBeDefined();
      expect(typeof mealPlan.id).toBe('string');
    });

    it('creates a meal plan without description', () => {
      const mealPlan = createNewMealPlan('Test Meal Plan', '2024-01-15', '2024-01-21');

      expect(mealPlan.description).toBeUndefined();
    });
  });

  describe('createNewMealPlanRecipe', () => {
    it('creates a new meal plan recipe with correct properties', () => {
      const mealPlanRecipe = createNewMealPlanRecipe(
        'meal-plan-1',
        'recipe-1',
        '2024-01-15',
        'dinner',
        2.0,
        'Special notes'
      );

      expect(mealPlanRecipe).toMatchObject({
        mealPlanId: 'meal-plan-1',
        recipeId: 'recipe-1',
        date: '2024-01-15',
        mealType: 'dinner',
        servingMultiplier: 2.0,
        notes: 'Special notes',
        dateCreated: '2024-01-15T12:00:00Z',
      });

      expect(mealPlanRecipe.id).toBeDefined();
      expect(typeof mealPlanRecipe.id).toBe('string');
    });

    it('creates a meal plan recipe with default serving multiplier', () => {
      const mealPlanRecipe = createNewMealPlanRecipe(
        'meal-plan-1',
        'recipe-1',
        '2024-01-15',
        'dinner'
      );

      expect(mealPlanRecipe.servingMultiplier).toBe(1.0);
      expect(mealPlanRecipe.notes).toBeUndefined();
    });
  });

  describe('getMealPlanDuration', () => {
    it('calculates duration correctly for single day', () => {
      const mealPlan: MealPlan = {
        id: '1',
        name: 'Test',
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        settings: { enabledMealTypes: [], defaultServings: 4 },
        dateCreated: '2024-01-15T12:00:00Z',
        dateModified: '2024-01-15T12:00:00Z',
      };

      expect(getMealPlanDuration(mealPlan)).toBe(1);
    });

    it('calculates duration correctly for multiple days', () => {
      const mealPlan: MealPlan = {
        id: '1',
        name: 'Test',
        startDate: '2024-01-15',
        endDate: '2024-01-21',
        settings: { enabledMealTypes: [], defaultServings: 4 },
        dateCreated: '2024-01-15T12:00:00Z',
        dateModified: '2024-01-15T12:00:00Z',
      };

      expect(getMealPlanDuration(mealPlan)).toBe(7);
    });
  });

  describe('getMealPlanDates', () => {
    it('returns correct dates for a meal plan', () => {
      const mealPlan: MealPlan = {
        id: '1',
        name: 'Test',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        settings: { enabledMealTypes: [], defaultServings: 4 },
        dateCreated: '2024-01-15T12:00:00Z',
        dateModified: '2024-01-15T12:00:00Z',
      };

      const dates = getMealPlanDates(mealPlan);
      expect(dates).toEqual(['2024-01-15', '2024-01-16', '2024-01-17']);
    });

    it('returns single date for single-day meal plan', () => {
      const mealPlan: MealPlan = {
        id: '1',
        name: 'Test',
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        settings: { enabledMealTypes: [], defaultServings: 4 },
        dateCreated: '2024-01-15T12:00:00Z',
        dateModified: '2024-01-15T12:00:00Z',
      };

      const dates = getMealPlanDates(mealPlan);
      expect(dates).toEqual(['2024-01-15']);
    });
  });

  describe('meal plan status functions', () => {
    // Mock current date to 2024-01-15
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    const createMealPlan = (startDate: string, endDate: string): MealPlan => ({
      id: '1',
      name: 'Test',
      startDate,
      endDate,
      settings: { enabledMealTypes: [], defaultServings: 4 },
      dateCreated: '2024-01-15T12:00:00Z',
      dateModified: '2024-01-15T12:00:00Z',
    });

    describe('isMealPlanActive', () => {
      it('returns true for active meal plan', () => {
        const mealPlan = createMealPlan('2024-01-10', '2024-01-20');
        expect(isMealPlanActive(mealPlan)).toBe(true);
      });

      it('returns true for meal plan starting today', () => {
        const mealPlan = createMealPlan('2024-01-15', '2024-01-20');
        expect(isMealPlanActive(mealPlan)).toBe(true);
      });

      it('returns true for meal plan ending today', () => {
        const mealPlan = createMealPlan('2024-01-10', '2024-01-15');
        expect(isMealPlanActive(mealPlan)).toBe(true);
      });

      it('returns false for future meal plan', () => {
        const mealPlan = createMealPlan('2024-01-20', '2024-01-25');
        expect(isMealPlanActive(mealPlan)).toBe(false);
      });

      it('returns false for past meal plan', () => {
        const mealPlan = createMealPlan('2024-01-01', '2024-01-10');
        expect(isMealPlanActive(mealPlan)).toBe(false);
      });
    });

    describe('isMealPlanUpcoming', () => {
      it('returns true for future meal plan', () => {
        const mealPlan = createMealPlan('2024-01-20', '2024-01-25');
        expect(isMealPlanUpcoming(mealPlan)).toBe(true);
      });

      it('returns false for active meal plan', () => {
        const mealPlan = createMealPlan('2024-01-10', '2024-01-20');
        expect(isMealPlanUpcoming(mealPlan)).toBe(false);
      });

      it('returns false for past meal plan', () => {
        const mealPlan = createMealPlan('2024-01-01', '2024-01-10');
        expect(isMealPlanUpcoming(mealPlan)).toBe(false);
      });
    });

    describe('isMealPlanPast', () => {
      it('returns true for past meal plan', () => {
        const mealPlan = createMealPlan('2024-01-01', '2024-01-10');
        expect(isMealPlanPast(mealPlan)).toBe(true);
      });

      it('returns false for active meal plan', () => {
        const mealPlan = createMealPlan('2024-01-10', '2024-01-20');
        expect(isMealPlanPast(mealPlan)).toBe(false);
      });

      it('returns false for future meal plan', () => {
        const mealPlan = createMealPlan('2024-01-20', '2024-01-25');
        expect(isMealPlanPast(mealPlan)).toBe(false);
      });
    });
  });

  describe('groupMealPlanRecipesByDate', () => {
    it('groups recipes correctly by date and meal type', () => {
      const recipes: MealPlanRecipe[] = [
        {
          id: '1',
          mealPlanId: 'mp1',
          recipeId: 'r1',
          date: '2024-01-15',
          mealType: 'breakfast',
          servingMultiplier: 1,
          dateCreated: '2024-01-15T12:00:00Z',
        },
        {
          id: '2',
          mealPlanId: 'mp1',
          recipeId: 'r2',
          date: '2024-01-15',
          mealType: 'dinner',
          servingMultiplier: 1,
          dateCreated: '2024-01-15T12:00:00Z',
        },
        {
          id: '3',
          mealPlanId: 'mp1',
          recipeId: 'r3',
          date: '2024-01-16',
          mealType: 'breakfast',
          servingMultiplier: 1,
          dateCreated: '2024-01-15T12:00:00Z',
        },
      ];

      const grouped = groupMealPlanRecipesByDate(recipes);

      expect(grouped).toEqual({
        '2024-01-15': {
          breakfast: [recipes[0]],
          dinner: [recipes[1]],
        },
        '2024-01-16': {
          breakfast: [recipes[2]],
        },
      });
    });

    it('handles empty recipe list', () => {
      const grouped = groupMealPlanRecipesByDate([]);
      expect(grouped).toEqual({});
    });
  });

  describe('getRecipesForDateAndMealType', () => {
    const recipes: MealPlanRecipe[] = [
      {
        id: '1',
        mealPlanId: 'mp1',
        recipeId: 'r1',
        date: '2024-01-15',
        mealType: 'breakfast',
        servingMultiplier: 1,
        dateCreated: '2024-01-15T12:00:00Z',
      },
      {
        id: '2',
        mealPlanId: 'mp1',
        recipeId: 'r2',
        date: '2024-01-15',
        mealType: 'dinner',
        servingMultiplier: 1,
        dateCreated: '2024-01-15T12:00:00Z',
      },
    ];

    it('returns recipes for specific date and meal type', () => {
      const result = getRecipesForDateAndMealType(recipes, '2024-01-15', 'breakfast');
      expect(result).toEqual([recipes[0]]);
    });

    it('returns empty array for non-matching criteria', () => {
      const result = getRecipesForDateAndMealType(recipes, '2024-01-15', 'lunch');
      expect(result).toEqual([]);
    });
  });

  describe('calculateAdjustedServings', () => {
    it('calculates adjusted servings correctly', () => {
      expect(calculateAdjustedServings(4, 1.5)).toBe(6);
      expect(calculateAdjustedServings(6, 0.5)).toBe(3);
      expect(calculateAdjustedServings(4, 1.0)).toBe(4);
    });

    it('rounds to nearest integer', () => {
      expect(calculateAdjustedServings(3, 1.4)).toBe(4); // 4.2 rounds to 4
      expect(calculateAdjustedServings(3, 1.6)).toBe(5); // 4.8 rounds to 5
    });
  });
});
