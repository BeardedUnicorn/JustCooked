import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import RecipeAssignmentDialog from './RecipeAssignmentDialog';
import { Recipe, MEAL_TYPES } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetAllRecipesImplementation = fn().mockResolvedValue([]);
let mockSaveMealPlanRecipeImplementation = fn().mockResolvedValue(undefined);

// Mock the services for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    recipeStorage: {
      getAllRecipes: mockGetAllRecipesImplementation,
    },
    mealPlanStorage: {
      saveMealPlanRecipe: mockSaveMealPlanRecipeImplementation,
    },
  };
}

const meta: Meta<typeof RecipeAssignmentDialog> = {
  title: 'Modals/RecipeAssignmentDialog',
  component: RecipeAssignmentDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onRecipeAssigned: { action: 'recipeAssigned' },
    open: { control: 'boolean' },
    mealPlanId: { control: 'text' },
    selectedDate: { control: 'text' },
    selectedMealType: { 
      control: 'select',
      options: [MEAL_TYPES.BREAKFAST, MEAL_TYPES.LUNCH, MEAL_TYPES.DINNER, MEAL_TYPES.SNACKS]
    },
    enabledMealTypes: { control: 'object' },
  },
  args: {
    onClose: fn(),
    onRecipeAssigned: fn(),
    open: true,
    mealPlanId: 'test-meal-plan-123',
    selectedDate: '2024-01-15',
    selectedMealType: MEAL_TYPES.DINNER,
    enabledMealTypes: [MEAL_TYPES.BREAKFAST, MEAL_TYPES.LUNCH, MEAL_TYPES.DINNER],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock recipes data
const mockRecipes: Recipe[] = [
  {
    id: 'recipe-1',
    title: 'Spaghetti Carbonara',
    description: 'Classic Italian pasta dish with eggs, cheese, and pancetta',
    image: 'https://via.placeholder.com/300x200?text=Carbonara',
    sourceUrl: 'https://example.com/carbonara',
    prepTime: 'PT15M',
    cookTime: 'PT15M',
    totalTime: 'PT30M',
    servings: 4,
    ingredients: [
      { name: 'spaghetti', amount: 400, unit: 'g' },
      { name: 'eggs', amount: 3, unit: 'large' },
      { name: 'pancetta', amount: 150, unit: 'g' },
    ],
    instructions: ['Boil pasta', 'Cook pancetta', 'Mix with eggs'],
    tags: ['Italian', 'Pasta', 'Quick'],
    dateAdded: '2024-01-10T10:00:00.000Z',
    dateModified: '2024-01-10T10:00:00.000Z',
    rating: 4.5,
    difficulty: 'Medium',
    isFavorite: false,
  },
  {
    id: 'recipe-2',
    title: 'Chicken Stir Fry',
    description: 'Quick and healthy chicken stir fry with vegetables',
    image: 'https://via.placeholder.com/300x200?text=Stir+Fry',
    sourceUrl: 'https://example.com/stirfry',
    prepTime: 'PT10M',
    cookTime: 'PT10M',
    totalTime: 'PT20M',
    servings: 2,
    ingredients: [
      { name: 'chicken breast', amount: 300, unit: 'g' },
      { name: 'mixed vegetables', amount: 200, unit: 'g' },
    ],
    instructions: ['Cut chicken', 'Stir fry everything'],
    tags: ['Asian', 'Healthy', 'Quick'],
    dateAdded: '2024-01-12T14:00:00.000Z',
    dateModified: '2024-01-12T14:00:00.000Z',
    rating: 4.0,
    difficulty: 'Easy',
    isFavorite: true,
  },
  {
    id: 'recipe-3',
    title: 'Chocolate Chip Cookies',
    description: 'Classic homemade chocolate chip cookies',
    image: 'https://via.placeholder.com/300x200?text=Cookies',
    sourceUrl: 'https://example.com/cookies',
    prepTime: 'PT15M',
    cookTime: 'PT12M',
    totalTime: 'PT27M',
    servings: 24,
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cups' },
      { name: 'chocolate chips', amount: 1, unit: 'cup' },
    ],
    instructions: ['Mix ingredients', 'Bake cookies'],
    tags: ['Dessert', 'Baking', 'Sweet'],
    dateAdded: '2024-01-08T16:00:00.000Z',
    dateModified: '2024-01-08T16:00:00.000Z',
    rating: 5.0,
    difficulty: 'Easy',
    isFavorite: true,
  },
];

// Browser-compatible mock configuration function
const configureRecipeAssignmentMocks = (overrides: any = {}) => {
  mockGetAllRecipesImplementation = fn().mockResolvedValue(overrides.recipes || mockRecipes);
  mockSaveMealPlanRecipeImplementation = fn().mockResolvedValue(overrides.saveResult || undefined);

  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      recipeStorage: {
        getAllRecipes: mockGetAllRecipesImplementation,
      },
      mealPlanStorage: {
        saveMealPlanRecipe: mockSaveMealPlanRecipeImplementation,
      },
    };
  }
};

// Default Story: Dialog open with basic props
export const Default: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks();
  },
};

// Loading Recipes Story: getAllRecipes promise doesn't resolve immediately
export const LoadingRecipes: Story = {
  beforeEach: () => {
    // Create a promise that never resolves to simulate loading
    mockGetAllRecipesImplementation = fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    mockSaveMealPlanRecipeImplementation = fn().mockResolvedValue(undefined);

    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        recipeStorage: { getAllRecipes: mockGetAllRecipesImplementation },
        mealPlanStorage: { saveMealPlanRecipe: mockSaveMealPlanRecipeImplementation },
      };
    }
  },
};

// No Recipes Story: getAllRecipes returns empty array
export const NoRecipes: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks({ recipes: [] });
  },
};

// Error Loading Story: getAllRecipes rejects
export const ErrorLoading: Story = {
  beforeEach: () => {
    mockGetAllRecipesImplementation = fn().mockRejectedValue(new Error('Failed to load recipes'));
    mockSaveMealPlanRecipeImplementation = fn().mockResolvedValue(undefined);

    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        recipeStorage: { getAllRecipes: mockGetAllRecipesImplementation },
        mealPlanStorage: { saveMealPlanRecipe: mockSaveMealPlanRecipeImplementation },
      };
    }
  },
};

// Recipe Selected Story: Pre-select a recipe
export const RecipeSelected: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipes to load
    await canvas.findByText('Spaghetti Carbonara');

    // Click on the first recipe to select it
    const firstRecipeCard = canvas.getByTestId('recipe-card-recipe-1');
    await userEvent.click(firstRecipeCard);
  },
};

// Interaction Test: Search filtering
export const InteractionTestSearch: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipes to load
    await canvas.findByText('Spaghetti Carbonara');

    // Type in search box to filter recipes
    const searchInput = canvas.getByTestId('recipe-search-input');
    await userEvent.type(searchInput, 'chicken');

    // Verify only chicken recipe is visible
    expect(canvas.getByText('Chicken Stir Fry')).toBeInTheDocument();
    expect(canvas.queryByText('Spaghetti Carbonara')).not.toBeInTheDocument();
    expect(canvas.queryByText('Chocolate Chip Cookies')).not.toBeInTheDocument();
  },
};

// Interaction Test: Recipe assignment flow
export const InteractionTestAssignment: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for recipes to load
    await canvas.findByText('Spaghetti Carbonara');

    // Select a recipe
    const recipeCard = canvas.getByTestId('recipe-card-recipe-1');
    await userEvent.click(recipeCard);

    // Change meal type
    const mealTypeSelect = canvas.getByTestId('meal-type-select');
    await userEvent.click(mealTypeSelect);
    const breakfastOption = canvas.getByText('Breakfast');
    await userEvent.click(breakfastOption);

    // Change serving multiplier
    const servingInput = canvas.getByTestId('serving-multiplier-input');
    await userEvent.clear(servingInput);
    await userEvent.type(servingInput, '2');

    // Add notes
    const notesInput = canvas.getByTestId('recipe-assignment-notes-input');
    await userEvent.type(notesInput, 'Special breakfast version');

    // Click assign button
    const assignButton = canvas.getByTestId('assign-recipe-button');
    await userEvent.click(assignButton);

    // Verify callbacks were called
    await expect(args.onRecipeAssigned).toHaveBeenCalled();
    await expect(args.onClose).toHaveBeenCalled();
  },
};

// Interaction Test: Cancel dialog
export const InteractionTestCancel: Story = {
  beforeEach: () => {
    configureRecipeAssignmentMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for recipes to load
    await canvas.findByText('Spaghetti Carbonara');

    // Click cancel button
    const cancelButton = canvas.getByTestId('cancel-button');
    await userEvent.click(cancelButton);

    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
  },
};
