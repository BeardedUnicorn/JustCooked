import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import Planner from './Planner';
import { MealPlan, ShoppingList } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetAllMealPlansImplementation = fn();
let mockGetAllShoppingListsImplementation = fn();

// Browser-compatible mock configuration function
const configureServiceMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      mealPlanStorage: { getAllMealPlans: mockGetAllMealPlansImplementation },
      shoppingListStorage: { getAllShoppingLists: mockGetAllShoppingListsImplementation },
    };
  }
};

// Browser-compatible component mocks
const configureComponentMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_COMPONENT_MOCKS__ = {
      MealPlanView: ({ mealPlan }: { mealPlan: MealPlan }) => (
        <div data-testid="mock-meal-plan-view">
          <h3>Meal Plan View: {mealPlan.name}</h3>
          <p>Date Range: {mealPlan.startDate} to {mealPlan.endDate}</p>
        </div>
      ),
      ShoppingListView: ({ shoppingList }: { shoppingList: ShoppingList }) => (
        <div data-testid="mock-shopping-list-view">
          <h3>Shopping List View: {shoppingList.name}</h3>
          <p>Date Range: {shoppingList.dateRangeStart} to {shoppingList.dateRangeEnd}</p>
        </div>
      ),
    };
  }
};

// Initialize mocks
configureServiceMocks();
configureComponentMocks();

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

const mockMealPlanUpcoming: MealPlan = {
  id: 'meal-plan-2',
  name: 'Next Week Meal Plan',
  description: 'Upcoming meal plan',
  startDate: '2024-01-22',
  endDate: '2024-01-28',
  settings: {
    enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
    defaultServings: 4,
  },
  dateCreated: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
};

const mockShoppingList: ShoppingList = {
  id: 'shopping-list-1',
  mealPlanId: 'meal-plan-1',
  name: 'Weekly Shopping List',
  dateRangeStart: '2024-01-15',
  dateRangeEnd: '2024-01-21',
  dateCreated: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
};

const mockShoppingList2: ShoppingList = {
  id: 'shopping-list-2',
  mealPlanId: 'meal-plan-2',
  name: 'Next Week Shopping List',
  dateRangeStart: '2024-01-22',
  dateRangeEnd: '2024-01-28',
  dateCreated: '2024-01-16T12:00:00Z',
  dateModified: '2024-01-16T12:00:00Z',
};

const meta: Meta<typeof Planner> = {
  title: 'Pages/Planner',
  component: Planner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story - Meal Plan Tab Active with selected meal plan
export const MealPlanTabActive: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan, mockMealPlanUpcoming]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([mockShoppingList, mockShoppingList2]);

    // Mock current date to be within the meal plan range
    const originalDate = Date;
    // @ts-ignore
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super('2024-01-16');
        } else {
          super(...args);
        }
      }
      static now() {
        return new Date('2024-01-16').getTime();
      }
    };

    // Update service mocks
    configureServiceMocks();
  },
};

// Meal Plan Tab with no meal plans
export const MealPlanTabNoPlans: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
};

// Shopping Lists Tab showing list of shopping lists
export const ShoppingListsTabActiveList: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan, mockMealPlanUpcoming]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([mockShoppingList, mockShoppingList2]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Shopping Lists tab
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);

    // Wait for shopping lists to load
    await expect(canvas.getByTestId('plannerPage-shoppingLists-list-main')).toBeInTheDocument();
  },
};

// Shopping Lists Tab showing a specific shopping list view
export const ShoppingListsTabActiveViewList: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan, mockMealPlanUpcoming]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([mockShoppingList, mockShoppingList2]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Shopping Lists tab
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);

    // Wait for shopping lists to load and click on first shopping list
    await expect(canvas.getByTestId('plannerPage-shoppingLists-list-main')).toBeInTheDocument();
    const firstShoppingList = canvas.getByTestId(`plannerPage-shoppingLists-listItem-${mockShoppingList.id}`);
    await userEvent.click(firstShoppingList);

    // Verify shopping list view is shown
    await expect(canvas.getByTestId('mock-shopping-list-view')).toBeInTheDocument();
  },
};

// Shopping Lists Tab with no shopping lists
export const ShoppingListsTabEmpty: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Shopping Lists tab
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);

    // Verify empty state is shown
    await expect(canvas.getByText('No shopping lists found')).toBeInTheDocument();
  },
};

// Loading states
export const MealPlanTabLoading: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    // Mock slow loading by returning a promise that doesn't resolve immediately
    mockGetAllMealPlansImplementation = fn().mockImplementation(() => new Promise(() => {}));
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
};

export const ShoppingListsTabLoading: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan]);
    mockGetAllShoppingListsImplementation = fn().mockImplementation(() => new Promise(() => {}));

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Shopping Lists tab to trigger loading
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);
  },
};

// Error states
export const MealPlanTabError: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockRejectedValue(new Error('Failed to load meal plans'));
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
};

export const ShoppingListsTabError: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan]);
    mockGetAllShoppingListsImplementation = fn().mockRejectedValue(new Error('Failed to load shopping lists'));

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Shopping Lists tab to trigger error
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);

    // Wait for error to appear
    await expect(canvas.getByTestId('plannerPage-shoppingLists-alert-error')).toBeInTheDocument();
  },
};

// Comprehensive interaction tests
export const InteractionTests: Story = {
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetAllMealPlansImplementation = fn().mockResolvedValue([mockMealPlan, mockMealPlanUpcoming]);
    mockGetAllShoppingListsImplementation = fn().mockResolvedValue([mockShoppingList, mockShoppingList2]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test 1: Verify initial state (Meal Plan tab active)
    await expect(canvas.getByTestId('plannerPage-title-main')).toHaveTextContent('Planner');
    await expect(canvas.getByTestId('mock-meal-plan-view')).toBeInTheDocument();

    // Test 2: Switch to Shopping Lists tab
    const shoppingListsTab = canvas.getByTestId('plannerPage-tab-shoppingLists');
    await userEvent.click(shoppingListsTab);

    // Verify shopping lists are loaded
    await expect(canvas.getByTestId('plannerPage-shoppingLists-list-main')).toBeInTheDocument();

    // Test 3: Click on a shopping list to view it
    const firstShoppingList = canvas.getByTestId(`plannerPage-shoppingLists-listItem-${mockShoppingList.id}`);
    await userEvent.click(firstShoppingList);

    // Verify shopping list view is shown
    await expect(canvas.getByTestId('mock-shopping-list-view')).toBeInTheDocument();

    // Test 4: Go back to shopping lists list
    const backButton = canvas.getByTestId('plannerPage-shoppingLists-button-back');
    await userEvent.click(backButton);

    // Verify we're back to the list
    await expect(canvas.getByTestId('plannerPage-shoppingLists-list-main')).toBeInTheDocument();

    // Test 5: Switch back to Meal Plan tab
    const mealPlanTab = canvas.getByTestId('plannerPage-tab-mealPlan');
    await userEvent.click(mealPlanTab);

    // Verify meal plan view is shown
    await expect(canvas.getByTestId('mock-meal-plan-view')).toBeInTheDocument();
  },
};
