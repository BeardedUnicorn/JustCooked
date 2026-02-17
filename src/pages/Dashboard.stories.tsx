import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import recipesReducer from '@store/slices/recipesSlice';
import { Recipe, MealPlan, MealPlanRecipe, PantryItem, ShoppingList } from '@app-types';
import { vi } from 'vitest';

// Mock all service functions
vi.mock('@services/mealPlanStorage', () => ({
  getAllMealPlans: vi.fn(),
  getMealPlanRecipes: vi.fn(),
  groupMealPlanRecipesByDate: vi.fn(),
}));

vi.mock('@services/shoppingListStorage', () => ({
  getAllShoppingLists: vi.fn(),
}));

vi.mock('@services/pantryStorage', () => ({
  getExpiringItems: vi.fn(),
}));

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Import mocked services
import { getAllMealPlans, getMealPlanRecipes, groupMealPlanRecipesByDate } from '@services/mealPlanStorage';
import { getAllShoppingLists } from '@services/shoppingListStorage';
import { getExpiringItems } from '@services/pantryStorage';

const mockGetAllMealPlans = vi.mocked(getAllMealPlans);
const mockGetMealPlanRecipes = vi.mocked(getMealPlanRecipes);
const mockGroupMealPlanRecipesByDate = vi.mocked(groupMealPlanRecipesByDate);
const mockGetAllShoppingLists = vi.mocked(getAllShoppingLists);
const mockGetExpiringItems = vi.mocked(getExpiringItems);

// Mock data
const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'recipe-1',
  title: 'Delicious Pasta',
  description: 'A wonderful pasta dish',
  image: 'https://example.com/pasta.jpg',
  sourceUrl: 'https://example.com/recipe',
  prepTime: 'PT15M',
  cookTime: 'PT30M',
  totalTime: 'PT45M',
  servings: 4,
  ingredients: [
    { name: 'pasta', amount: 1, unit: 'lb', section: '' },
    { name: 'tomato sauce', amount: 2, unit: 'cups', section: '' },
  ],
  instructions: ['Cook pasta', 'Add sauce', 'Serve hot'],
  tags: ['italian', 'dinner'],
  dateAdded: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
  ...overrides,
});

const createMockMealPlan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
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
  ...overrides,
});

const createMockMealPlanRecipe = (overrides: Partial<MealPlanRecipe> = {}): MealPlanRecipe => ({
  id: 'meal-plan-recipe-1',
  mealPlanId: 'meal-plan-1',
  recipeId: 'recipe-1',
  date: '2024-01-15',
  mealType: 'dinner',
  servingMultiplier: 1.0,
  dateCreated: '2024-01-15T12:00:00Z',
  ...overrides,
});

const createMockPantryItem = (overrides: Partial<PantryItem> = {}): PantryItem => ({
  id: 'pantry-1',
  name: 'Milk',
  amount: 1,
  unit: 'gallon',
  category: 'dairy',
  expiryDate: '2024-01-17',
  location: 'Refrigerator',
  dateAdded: '2024-01-10T12:00:00Z',
  dateModified: '2024-01-10T12:00:00Z',
  ...overrides,
});

const createMockShoppingList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'shopping-list-1',
  mealPlanId: 'meal-plan-1',
  name: 'Weekly Shopping',
  dateRangeStart: '2024-01-15',
  dateRangeEnd: '2024-01-21',
  dateCreated: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
  ...overrides,
});

// Redux store creator
const createMockStore = (initialState: any = {}) => {
  return configureStore({
    reducer: {
      recipes: recipesReducer,
    },
    preloadedState: {
      recipes: {
        recipes: [],
        loading: false,
        error: null,
        ...initialState,
      },
    },
  });
};

// Setup default mocks
const setupDefaultMocks = () => {
  mockGetAllMealPlans.mockResolvedValue([]);
  mockGetMealPlanRecipes.mockResolvedValue([]);
  mockGroupMealPlanRecipesByDate.mockReturnValue({});
  mockGetAllShoppingLists.mockResolvedValue([]);
  mockGetExpiringItems.mockResolvedValue([]);
  mockNavigate.mockClear();
};

const meta: Meta<typeof Dashboard> = {
  title: 'Pages/Dashboard',
  component: Dashboard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main dashboard page showing recent recipes, today\'s meal plan, and expiring pantry items.',
      },
    },
  },
  decorators: [
    (Story, context) => {
      setupDefaultMocks();
      const store = context.parameters.redux?.store || createMockStore();
      
      // Apply story-specific mocks
      if (context.parameters.mocks) {
        const { mocks } = context.parameters;
        if (mocks.getAllMealPlans) mockGetAllMealPlans.mockResolvedValue(mocks.getAllMealPlans);
        if (mocks.getMealPlanRecipes) mockGetMealPlanRecipes.mockResolvedValue(mocks.getMealPlanRecipes);
        if (mocks.groupMealPlanRecipesByDate) mockGroupMealPlanRecipesByDate.mockReturnValue(mocks.groupMealPlanRecipesByDate);
        if (mocks.getAllShoppingLists) mockGetAllShoppingLists.mockResolvedValue(mocks.getAllShoppingLists);
        if (mocks.getExpiringItems) mockGetExpiringItems.mockResolvedValue(mocks.getExpiringItems);
      }
      
      return (
        <Provider store={store}>
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </Provider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDashboard: Story = {
  parameters: {
    redux: {
      store: createMockStore(),
    },
  },
};

export const WithRecentRecipes: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        recipes: [
          createMockRecipe({ 
            id: 'recipe-1', 
            title: 'Spaghetti Carbonara', 
            dateAdded: '2024-01-15T12:00:00Z' 
          }),
          createMockRecipe({ 
            id: 'recipe-2', 
            title: 'Chicken Tikka Masala', 
            dateAdded: '2024-01-14T12:00:00Z' 
          }),
          createMockRecipe({ 
            id: 'recipe-3', 
            title: 'Caesar Salad', 
            dateAdded: '2024-01-13T12:00:00Z' 
          }),
          createMockRecipe({ 
            id: 'recipe-4', 
            title: 'Chocolate Cake', 
            dateAdded: '2024-01-12T12:00:00Z' 
          }),
        ],
      }),
    },
  },
};

export const WithMealPlan: Story = {
  parameters: {
    redux: {
      store: createMockStore(),
    },
    mocks: {
      getAllMealPlans: [createMockMealPlan()],
      getMealPlanRecipes: [
        createMockMealPlanRecipe({ 
          id: 'breakfast-recipe',
          mealType: 'breakfast',
          recipeId: 'recipe-breakfast'
        }),
        createMockMealPlanRecipe({ 
          id: 'dinner-recipe',
          mealType: 'dinner',
          recipeId: 'recipe-dinner'
        }),
      ],
      groupMealPlanRecipesByDate: {
        '2024-01-15': {
          breakfast: [createMockMealPlanRecipe({ mealType: 'breakfast' })],
          dinner: [createMockMealPlanRecipe({ mealType: 'dinner' })],
        },
      },
    },
  },
  beforeEach: () => {
    // Mock current date to match meal plan
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  },
  afterEach: () => {
    vi.useRealTimers();
  },
};

export const WithExpiringItems: Story = {
  parameters: {
    redux: {
      store: createMockStore(),
    },
    mocks: {
      getExpiringItems: [
        createMockPantryItem({ 
          id: 'milk', 
          name: 'Milk', 
          expiryDate: '2024-01-17' 
        }),
        createMockPantryItem({ 
          id: 'bread', 
          name: 'Bread', 
          expiryDate: '2024-01-18' 
        }),
        createMockPantryItem({ 
          id: 'yogurt', 
          name: 'Greek Yogurt', 
          expiryDate: '2024-01-16' 
        }),
      ],
    },
  },
};

export const FullDashboard: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        recipes: [
          createMockRecipe({ 
            id: 'recipe-1', 
            title: 'Spaghetti Carbonara', 
            dateAdded: '2024-01-15T12:00:00Z' 
          }),
          createMockRecipe({ 
            id: 'recipe-2', 
            title: 'Chicken Tikka Masala', 
            dateAdded: '2024-01-14T12:00:00Z' 
          }),
        ],
      }),
    },
    mocks: {
      getAllMealPlans: [createMockMealPlan()],
      getMealPlanRecipes: [
        createMockMealPlanRecipe({ mealType: 'breakfast' }),
        createMockMealPlanRecipe({ mealType: 'dinner' }),
      ],
      groupMealPlanRecipesByDate: {
        '2024-01-15': {
          breakfast: [createMockMealPlanRecipe({ mealType: 'breakfast' })],
          dinner: [createMockMealPlanRecipe({ mealType: 'dinner' })],
        },
      },
      getExpiringItems: [
        createMockPantryItem({ name: 'Milk', expiryDate: '2024-01-17' }),
        createMockPantryItem({ name: 'Bread', expiryDate: '2024-01-18' }),
      ],
    },
  },
  beforeEach: () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  },
  afterEach: () => {
    vi.useRealTimers();
  },
};

export const LoadingState: Story = {
  parameters: {
    redux: {
      store: createMockStore({ loading: true }),
    },
    mocks: {
      // Simulate slow loading by not resolving immediately
      getAllMealPlans: new Promise(() => {}), // Never resolves
    },
  },
};

export const ErrorState: Story = {
  parameters: {
    redux: {
      store: createMockStore(),
    },
    mocks: {
      getAllMealPlans: Promise.reject(new Error('Failed to load meal plans')),
    },
  },
};

// Interaction tests
export const InteractionTests: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        recipes: [
          createMockRecipe({ 
            id: 'recipe-1', 
            title: 'Test Recipe', 
            dateAdded: '2024-01-15T12:00:00Z' 
          }),
        ],
      }),
    },
    mocks: {
      getExpiringItems: [
        createMockPantryItem({ name: 'Milk', expiryDate: '2024-01-17' }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for component to load
    await canvas.findByText('Dashboard');
    
    // Test navigation to cookbook
    const viewAllButton = canvas.getByTestId('dashboardPage-widget-recentRecipes-button-viewAll');
    await userEvent.click(viewAllButton);
    await expect(mockNavigate).toHaveBeenCalledWith('/cookbook');
    
    // Test navigation to pantry from expiring items
    const pantryButton = canvas.getByTestId('dashboardPage-widget-expiringItems-button-managePantry');
    await userEvent.click(pantryButton);
    await expect(mockNavigate).toHaveBeenCalledWith('/pantry');
  },
};
