import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import ShoppingListGenerator from './ShoppingListGenerator';
import { MealPlan, Recipe, MealPlanRecipe } from '@app-types';
import { ConsolidatedIngredient } from '@services/shoppingListStorage';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Browser-compatible mock implementation variables
let mockGetAllRecipesImplementation = fn();
let mockGetMealPlanRecipesImplementation = fn();
let mockGenerateShoppingListFromMealPlanImplementation = fn();
let mockConsolidateIngredientsImplementation = fn();

// Browser-compatible mock configuration function
const configureServiceMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      recipeStorage: { getAllRecipes: mockGetAllRecipesImplementation },
      mealPlanStorage: { getMealPlanRecipes: mockGetMealPlanRecipesImplementation },
      shoppingListStorage: {
        generateShoppingListFromMealPlan: mockGenerateShoppingListFromMealPlanImplementation,
        consolidateIngredients: mockConsolidateIngredientsImplementation,
      },
    };
  }
};

// Initialize mocks
configureServiceMocks();

// Mock data
const mockMealPlan: MealPlan = {
  id: 'meal-plan-1',
  name: 'Weekly Meal Plan',
  description: 'This week\'s meal plan',
  startDate: '2024-01-15',
  endDate: '2024-01-21',
  settings: {
    enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
    defaultServings: 4,
  },
  dateCreated: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
};

const mockRecipes: Recipe[] = [
  {
    id: 'recipe-1',
    title: 'Spaghetti Carbonara',
    description: 'Classic Italian pasta dish',
    image: 'https://example.com/carbonara.jpg',
    sourceUrl: 'https://example.com/carbonara',
    prepTime: 'PT15M',
    cookTime: 'PT15M',
    totalTime: 'PT30M',
    servings: 4,
    ingredients: [
      { name: 'spaghetti', amount: 400, unit: 'g', section: '' },
      { name: 'eggs', amount: 3, unit: 'large', section: '' },
      { name: 'pancetta', amount: 150, unit: 'g', section: '' },
      { name: 'parmesan cheese', amount: 100, unit: 'g', section: '' },
    ],
    instructions: ['Boil pasta', 'Cook pancetta', 'Mix with eggs'],
    tags: ['Italian', 'Pasta'],
    dateAdded: '2024-01-10T10:00:00.000Z',
    dateModified: '2024-01-10T10:00:00.000Z',
  },
  {
    id: 'recipe-2',
    title: 'Caesar Salad',
    description: 'Fresh Caesar salad with homemade dressing',
    image: 'https://example.com/caesar.jpg',
    sourceUrl: 'https://example.com/caesar',
    prepTime: 'PT10M',
    cookTime: 'PT0M',
    totalTime: 'PT10M',
    servings: 2,
    ingredients: [
      { name: 'romaine lettuce', amount: 1, unit: 'head', section: '' },
      { name: 'parmesan cheese', amount: 50, unit: 'g', section: '' },
      { name: 'croutons', amount: 1, unit: 'cup', section: '' },
      { name: 'caesar dressing', amount: 3, unit: 'tablespoons', section: '' },
    ],
    instructions: ['Chop lettuce', 'Add dressing', 'Top with cheese and croutons'],
    tags: ['Salad', 'Quick'],
    dateAdded: '2024-01-11T10:00:00.000Z',
    dateModified: '2024-01-11T10:00:00.000Z',
  },
];

const mockMealPlanRecipes: MealPlanRecipe[] = [
  {
    id: 'mpr-1',
    mealPlanId: 'meal-plan-1',
    recipeId: 'recipe-1',
    date: '2024-01-15',
    mealType: 'dinner',
    servingMultiplier: 1.0,
    dateCreated: '2024-01-15T12:00:00Z',
  },
  {
    id: 'mpr-2',
    mealPlanId: 'meal-plan-1',
    recipeId: 'recipe-2',
    date: '2024-01-16',
    mealType: 'lunch',
    servingMultiplier: 2.0,
    dateCreated: '2024-01-15T12:00:00Z',
  },
];

const mockConsolidatedIngredients: ConsolidatedIngredient[] = [
  {
    name: 'spaghetti',
    totalQuantity: 400,
    unit: 'g',
    category: 'grains',
    sources: ['Spaghetti Carbonara'],
  },
  {
    name: 'eggs',
    totalQuantity: 3,
    unit: 'large',
    category: 'dairy',
    sources: ['Spaghetti Carbonara'],
  },
  {
    name: 'parmesan cheese',
    totalQuantity: 200,
    unit: 'g',
    category: 'dairy',
    sources: ['Spaghetti Carbonara', 'Caesar Salad'],
  },
  {
    name: 'romaine lettuce',
    totalQuantity: 2,
    unit: 'head',
    category: 'vegetables',
    sources: ['Caesar Salad'],
  },
];

const meta: Meta<typeof ShoppingListGenerator> = {
  title: 'Modals/ShoppingListGenerator',
  component: ShoppingListGenerator,
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Story />
      </LocalizationProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onShoppingListCreated: { action: 'shoppingListCreated' },
    open: { control: 'boolean' },
    mealPlan: { control: 'object' },
  },
  args: {
    open: true,
    onClose: fn(),
    onShoppingListCreated: fn(),
    mealPlan: mockMealPlan,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Open Story: Basic modal display
export const DefaultOpen: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn();
    mockGetMealPlanRecipesImplementation = fn();
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
};

// Closed State Story: Modal in closed state
export const Closed: Story = {
  args: {
    open: false,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn();
    mockGetMealPlanRecipesImplementation = fn();
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
};

// Preview Loading Story: Show loading state when generating preview
export const PreviewLoading: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Mock delayed responses to show loading state
    mockGetAllRecipesImplementation = fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    mockGetMealPlanRecipesImplementation = fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    // Update service mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        recipeStorage: { getAllRecipes: mockGetAllRecipesImplementation },
        mealPlanStorage: { getMealPlanRecipes: mockGetMealPlanRecipesImplementation },
        shoppingListStorage: {
          generateShoppingListFromMealPlan: mockGenerateShoppingListFromMealPlanImplementation,
          consolidateIngredients: mockConsolidateIngredientsImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click preview button to trigger loading
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Verify loading indicator is shown
    expect(canvas.getByTestId('shoppingListGenerator-loading-preview')).toBeInTheDocument();
  },
};

// Preview Shown Story: Modal with preview displayed
export const PreviewShown: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue(mockMealPlanRecipes);
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn().mockReturnValue(mockConsolidatedIngredients);

    // Update service mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        recipeStorage: { getAllRecipes: mockGetAllRecipesImplementation },
        mealPlanStorage: { getMealPlanRecipes: mockGetMealPlanRecipesImplementation },
        shoppingListStorage: {
          generateShoppingListFromMealPlan: mockGenerateShoppingListFromMealPlanImplementation,
          consolidateIngredients: mockConsolidateIngredientsImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click preview button
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for preview to appear
    await expect(canvas.findByText('Shopping List Preview')).resolves.toBeInTheDocument();

    // Verify ingredients are displayed
    expect(canvas.getByText('spaghetti')).toBeInTheDocument();
    expect(canvas.getByText('eggs')).toBeInTheDocument();
    expect(canvas.getByText('parmesan cheese')).toBeInTheDocument();
    expect(canvas.getByText('romaine lettuce')).toBeInTheDocument();
  },
};

// Creating List Story: Show loading state when creating shopping list
export const CreatingList: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Setup for preview first
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue(mockMealPlanRecipes);
    mockConsolidateIngredientsImplementation = fn().mockReturnValue(mockConsolidatedIngredients);

    // Mock delayed shopping list creation
    mockGenerateShoppingListFromMealPlanImplementation = fn().mockImplementation(() => new Promise(() => {})); // Never resolves

    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First generate preview
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for preview to appear
    await expect(canvas.findByText('Shopping List Preview')).resolves.toBeInTheDocument();

    // Click create button to trigger loading
    const createButton = canvas.getByTestId('shopping-list-generator-create-button');
    await userEvent.click(createButton);

    // Verify loading indicator is shown
    expect(canvas.getByTestId('shoppingListGenerator-loading-main')).toBeInTheDocument();
    expect(canvas.getByText('Creating...')).toBeInTheDocument();
  },
};

// Error State Story: Show error when preview generation fails
export const ErrorState: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Mock service failure
    mockGetAllRecipesImplementation = fn().mockRejectedValue(new Error('Database connection failed'));
    mockGetMealPlanRecipesImplementation = fn().mockRejectedValue(new Error('Database connection failed'));
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click preview button to trigger error
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for error to appear
    await expect(canvas.findByTestId('shoppingListGenerator-alert-error')).resolves.toBeInTheDocument();
    expect(canvas.getByText('Failed to generate shopping list preview')).toBeInTheDocument();
  },
};

// No Recipes in Date Range Story: Show error when no recipes found
export const NoRecipesInDateRange: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue([]); // No recipes in date range
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click preview button
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for error to appear
    await expect(canvas.findByTestId('shoppingListGenerator-alert-error')).resolves.toBeInTheDocument();
    expect(canvas.getByText('No recipes found in the selected date range')).toBeInTheDocument();
  },
};

// Long Meal Plan Name Story: Test with long meal plan name
export const LongMealPlanName: Story = {
  args: {
    open: true,
    mealPlan: {
      ...mockMealPlan,
      name: 'Super Long Meal Plan Name That Goes On And On For Multiple Weeks With Detailed Planning',
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn();
    mockGetMealPlanRecipesImplementation = fn();
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
};

// Many Ingredients Story: Test with many consolidated ingredients
export const ManyIngredients: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    const manyIngredients = Array.from({ length: 20 }, (_, i) => ({
      name: `Ingredient ${i + 1}`,
      totalQuantity: Math.floor(Math.random() * 10) + 1,
      unit: ['cups', 'tablespoons', 'pieces', 'grams'][Math.floor(Math.random() * 4)],
      category: ['vegetables', 'dairy', 'grains', 'proteins'][Math.floor(Math.random() * 4)],
      sources: [`Recipe ${i + 1}`],
    }));

    // Reset mock implementations
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue(mockMealPlanRecipes);
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn().mockReturnValue(manyIngredients);

    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click preview button
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for preview to appear
    await expect(canvas.findByText('Shopping List Preview')).resolves.toBeInTheDocument();

    // Verify scrollable list
    expect(canvas.getByText('Ingredient 1')).toBeInTheDocument();
    expect(canvas.getByText('Ingredient 20')).toBeInTheDocument();
  },
};

// Interaction Tests Story: Test all interactive elements
export const InteractionTests: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue(mockMealPlanRecipes);
    mockGenerateShoppingListFromMealPlanImplementation = fn().mockResolvedValue('shopping-list-123');
    mockConsolidateIngredientsImplementation = fn().mockReturnValue(mockConsolidatedIngredients);

    configureServiceMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Test shopping list name input
    const nameInput = canvas.getByTestId('shopping-list-name-input').querySelector('input');
    if (nameInput) {
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Custom Shopping List Name');
      expect(nameInput).toHaveValue('Custom Shopping List Name');
    }

    // Test date picker interactions (basic test - date pickers are complex in tests)
    const startDateInput = canvas.getByTestId('shopping-list-start-date').querySelector('input');
    const endDateInput = canvas.getByTestId('shopping-list-end-date').querySelector('input');

    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();

    // Test preview generation
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for preview to appear
    await expect(canvas.findByText('Shopping List Preview')).resolves.toBeInTheDocument();

    // Test create shopping list
    const createButton = canvas.getByTestId('shopping-list-generator-create-button');
    await userEvent.click(createButton);

    // Verify onShoppingListCreated was called
    expect(args.onShoppingListCreated).toHaveBeenCalledWith('shopping-list-123');
  },
};

// Cancel Functionality Story: Test cancel button
export const CancelFunctionality: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn();
    mockGetMealPlanRecipesImplementation = fn();
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn();

    configureServiceMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click cancel button
    const cancelButton = canvas.getByTestId('shopping-list-generator-cancel-button');
    await userEvent.click(cancelButton);

    // Verify onClose was called
    expect(args.onClose).toHaveBeenCalled();
  },
};

// Date Range Change Story: Test changing date range
export const DateRangeChange: Story = {
  args: {
    open: true,
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetMealPlanRecipesImplementation = fn().mockResolvedValue(mockMealPlanRecipes);
    mockGenerateShoppingListFromMealPlanImplementation = fn();
    mockConsolidateIngredientsImplementation = fn().mockReturnValue(mockConsolidatedIngredients);

    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Generate initial preview
    const previewButton = canvas.getByTestId('shopping-list-preview-button');
    await userEvent.click(previewButton);

    // Wait for preview to appear
    await expect(canvas.findByText('Shopping List Preview')).resolves.toBeInTheDocument();

    // Note: Date picker interaction is complex in tests, so we just verify the inputs exist
    const startDateInput = canvas.getByTestId('shopping-list-start-date');
    const endDateInput = canvas.getByTestId('shopping-list-end-date');

    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();
  },
};
