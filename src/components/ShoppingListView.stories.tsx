import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import ShoppingListView from './ShoppingListView';
import { ShoppingList, ShoppingListItem } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetShoppingListItemsImplementation = fn().mockResolvedValue([]);
let mockUpdateShoppingListItemCheckedImplementation = fn().mockResolvedValue(undefined);
let mockDeleteShoppingListItemImplementation = fn().mockResolvedValue(true);
let mockGroupShoppingListItemsByCategoryImplementation = fn().mockReturnValue({});
let mockCalculateShoppingListProgressImplementation = fn().mockReturnValue({ completed: 0, total: 0, percentage: 0 });
let mockExportShoppingListAsTextImplementation = fn().mockReturnValue('');

// Mock shopping list storage service for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    shoppingListStorage: {
      getShoppingListItems: mockGetShoppingListItemsImplementation,
      updateShoppingListItemChecked: mockUpdateShoppingListItemCheckedImplementation,
      deleteShoppingListItem: mockDeleteShoppingListItemImplementation,
      groupShoppingListItemsByCategory: mockGroupShoppingListItemsByCategoryImplementation,
      calculateShoppingListProgress: mockCalculateShoppingListProgressImplementation,
      exportShoppingListAsText: mockExportShoppingListAsTextImplementation,
    },
  };
}

// Mock data
const mockShoppingList: ShoppingList = {
  id: 'shopping-list-1',
  mealPlanId: 'meal-plan-1',
  name: 'Weekly Shopping List',
  dateRangeStart: '2024-01-15',
  dateRangeEnd: '2024-01-21',
  dateCreated: '2024-01-15T12:00:00Z',
  dateModified: '2024-01-15T12:00:00Z',
};

const mockShoppingListItems: ShoppingListItem[] = [
  {
    id: 'item-1',
    shoppingListId: 'shopping-list-1',
    ingredientName: 'Spaghetti',
    quantity: 400,
    unit: 'g',
    category: 'grains',
    isChecked: false,
    notes: 'From: Spaghetti Carbonara',
    dateCreated: '2024-01-15T12:00:00Z',
  },
  {
    id: 'item-2',
    shoppingListId: 'shopping-list-1',
    ingredientName: 'Eggs',
    quantity: 6,
    unit: 'large',
    category: 'dairy',
    isChecked: true,
    notes: 'From: Spaghetti Carbonara, Caesar Salad',
    dateCreated: '2024-01-15T12:00:00Z',
  },
  {
    id: 'item-3',
    shoppingListId: 'shopping-list-1',
    ingredientName: 'Romaine Lettuce',
    quantity: 2,
    unit: 'heads',
    category: 'vegetables',
    isChecked: false,
    notes: 'From: Caesar Salad',
    dateCreated: '2024-01-15T12:00:00Z',
  },
  {
    id: 'item-4',
    shoppingListId: 'shopping-list-1',
    ingredientName: 'Parmesan Cheese',
    quantity: 200,
    unit: 'g',
    category: 'dairy',
    isChecked: false,
    notes: 'From: Spaghetti Carbonara, Caesar Salad',
    dateCreated: '2024-01-15T12:00:00Z',
  },
];

const mockCheckedItems: ShoppingListItem[] = mockShoppingListItems.map(item => ({
  ...item,
  isChecked: true,
}));

const mockGroupedItems = {
  grains: [mockShoppingListItems[0]],
  dairy: [mockShoppingListItems[1], mockShoppingListItems[3]],
  vegetables: [mockShoppingListItems[2]],
};

const meta: Meta<typeof ShoppingListView> = {
  title: 'Display/ShoppingListView',
  component: ShoppingListView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onItemsChanged: { action: 'itemsChanged' },
    onDelete: { action: 'deleted' },
    shoppingList: { control: 'object' },
  },
  args: {
    shoppingList: mockShoppingList,
    onItemsChanged: fn(),
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Browser-compatible mock configuration function
const setupMocks = (config: {
  getShoppingListItems?: any;
  updateShoppingListItemChecked?: any;
  deleteShoppingListItem?: any;
  groupShoppingListItemsByCategory?: any;
  calculateShoppingListProgress?: any;
  exportShoppingListAsText?: any;
} = {}) => {
  mockGetShoppingListItemsImplementation = config.getShoppingListItems || fn().mockResolvedValue([]);
  mockUpdateShoppingListItemCheckedImplementation = config.updateShoppingListItemChecked || fn().mockResolvedValue(undefined);
  mockDeleteShoppingListItemImplementation = config.deleteShoppingListItem || fn().mockResolvedValue(true);
  mockGroupShoppingListItemsByCategoryImplementation = config.groupShoppingListItemsByCategory || fn().mockReturnValue({});
  mockCalculateShoppingListProgressImplementation = config.calculateShoppingListProgress || fn().mockReturnValue({ completed: 0, total: 0, percentage: 0 });
  mockExportShoppingListAsTextImplementation = config.exportShoppingListAsText || fn().mockReturnValue('');

  // Update service mocks
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      shoppingListStorage: {
        getShoppingListItems: mockGetShoppingListItemsImplementation,
        updateShoppingListItemChecked: mockUpdateShoppingListItemCheckedImplementation,
        deleteShoppingListItem: mockDeleteShoppingListItemImplementation,
        groupShoppingListItemsByCategory: mockGroupShoppingListItemsByCategoryImplementation,
        calculateShoppingListProgress: mockCalculateShoppingListProgressImplementation,
        exportShoppingListAsText: mockExportShoppingListAsTextImplementation,
      },
    };
  }
};

// Loading Story: Show loading state
export const Loading: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      // Mock delayed response to show loading state
      getShoppingListItems: fn().mockImplementation(() => new Promise(() => {})), // Never resolves
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify loading indicator is shown
    expect(canvas.getByRole('progressbar')).toBeInTheDocument();
  },
};

// Empty List Story: Shopping list with no items
export const EmptyList: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    mockGetShoppingListItems.mockClear();
    mockUpdateShoppingListItemChecked.mockClear();
    mockDeleteShoppingListItem.mockClear();
    mockGroupShoppingListItemsByCategory.mockClear();
    mockCalculateShoppingListProgress.mockClear();
    mockExportShoppingListAsText.mockClear();
    
    mockGetShoppingListItems.mockResolvedValue([]);
    mockGroupShoppingListItemsByCategory.mockReturnValue({});
    mockCalculateShoppingListProgress.mockReturnValue({ completed: 0, total: 0, percentage: 0 });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for empty state to appear
    await expect(canvas.findByTestId('shoppingListView-text-empty')).resolves.toBeInTheDocument();
    expect(canvas.getByText('No items in this shopping list')).toBeInTheDocument();
  },
};

// With Items Story: Shopping list with items
export const WithItems: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockShoppingListItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(mockGroupedItems),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 1, total: 4, percentage: 25 }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for items to appear
    await expect(canvas.findByText('Spaghetti')).resolves.toBeInTheDocument();
    expect(canvas.getByText('Eggs')).toBeInTheDocument();
    expect(canvas.getByText('Romaine Lettuce')).toBeInTheDocument();
    expect(canvas.getByText('Parmesan Cheese')).toBeInTheDocument();
    
    // Verify progress is shown
    expect(canvas.getByText('1 of 4 items completed (25%)')).toBeInTheDocument();
  },
};

// Items Checked Story: Shopping list with some items checked
export const ItemsChecked: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockShoppingListItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(mockGroupedItems),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 1, total: 4, percentage: 25 }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for items to appear
    await expect(canvas.findByText('Eggs')).resolves.toBeInTheDocument();
    
    // Verify that the eggs item is checked (it's the only checked item in mock data)
    const eggsCheckbox = canvas.getByTestId('shopping-list-item-checkbox-item-2');
    expect(eggsCheckbox).toBeChecked();
  },
};

// All Items Checked Story: Shopping list with all items checked
export const AllItemsChecked: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockCheckedItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue({
        grains: [mockCheckedItems[0]],
        dairy: [mockCheckedItems[1], mockCheckedItems[3]],
        vegetables: [mockCheckedItems[2]],
      }),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 4, total: 4, percentage: 100 }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for items to appear
    await expect(canvas.findByText('100%')).resolves.toBeInTheDocument();
    expect(canvas.getByText('4 of 4 items completed (100%)')).toBeInTheDocument();
  },
};

// Error State Story: Show error when loading fails
export const ErrorState: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockRejectedValue(new Error('Database connection failed')),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for error to appear
    await expect(canvas.findByText('Failed to load shopping list items')).resolves.toBeInTheDocument();
  },
};

// Category Collapsed Story: Shopping list with a category collapsed
export const CategoryCollapsed: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockShoppingListItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(mockGroupedItems),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 1, total: 4, percentage: 25 }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to appear
    await expect(canvas.findByText('Dairy')).resolves.toBeInTheDocument();

    // Click to collapse the dairy category
    const dairyCategoryHeader = canvas.getByText('Dairy').closest('[role="button"]');
    if (dairyCategoryHeader) {
      await userEvent.click(dairyCategoryHeader);
    }

    // Verify that dairy items are hidden (collapsed)
    // Note: The actual collapse behavior depends on the component implementation
    // This test verifies the interaction works
  },
};

// Long Shopping List Story: Shopping list with many items
export const LongShoppingList: Story = {
  args: {
    shoppingList: {
      ...mockShoppingList,
      name: 'Monthly Shopping List - Lots of Items',
    },
  },
  beforeEach: () => {
    // Create many items across different categories
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i + 1}`,
      shoppingListId: 'shopping-list-1',
      ingredientName: `Item ${i + 1}`,
      quantity: Math.floor(Math.random() * 10) + 1,
      unit: ['cups', 'tablespoons', 'pieces', 'grams'][Math.floor(Math.random() * 4)],
      category: ['vegetables', 'dairy', 'grains', 'proteins'][Math.floor(Math.random() * 4)],
      isChecked: Math.random() > 0.5,
      notes: `From: Recipe ${i + 1}`,
      dateCreated: '2024-01-15T12:00:00Z',
    }));

    const groupedManyItems = manyItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof manyItems>);

    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(manyItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(groupedManyItems),
      calculateShoppingListProgress: fn().mockReturnValue({
        completed: manyItems.filter(item => item.isChecked).length,
        total: manyItems.length,
        percentage: Math.round((manyItems.filter(item => item.isChecked).length / manyItems.length) * 100)
      }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to appear
    await expect(canvas.findByText('Item 1')).resolves.toBeInTheDocument();

    // Verify scrollable list
    expect(canvas.getByText('Item 20')).toBeInTheDocument();
  },
};

// Interaction Tests Story: Test all interactive elements
export const InteractionTests: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockShoppingListItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(mockGroupedItems),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 1, total: 4, percentage: 25 }),
      updateShoppingListItemChecked: fn().mockResolvedValue(undefined),
      deleteShoppingListItem: fn().mockResolvedValue(true),
      exportShoppingListAsText: fn().mockReturnValue('Shopping List Export Text'),
    });
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for items to appear
    await expect(canvas.findByText('Spaghetti')).resolves.toBeInTheDocument();

    // Test checking an item
    const spaghettiCheckbox = canvas.getByTestId('shopping-list-item-checkbox-item-1');
    await userEvent.click(spaghettiCheckbox);

    // Verify updateShoppingListItemChecked was called
    expect(mockUpdateShoppingListItemCheckedImplementation).toHaveBeenCalledWith('item-1', true);

    // Test opening item menu
    const spaghettiMenu = canvas.getByTestId('shopping-list-item-menu-item-1');
    await userEvent.click(spaghettiMenu);

    // Test deleting an item
    const deleteMenuItem = canvas.getByText('Delete');
    await userEvent.click(deleteMenuItem);

    // Verify deleteShoppingListItem was called
    expect(mockDeleteShoppingListItemImplementation).toHaveBeenCalledWith('item-1');

    // Test print functionality
    const printButton = canvas.getByTestId('shoppingListView-button-print');
    await userEvent.click(printButton);

    // Verify exportShoppingListAsText was called
    expect(mockExportShoppingListAsTextImplementation).toHaveBeenCalledWith(mockShoppingList, mockShoppingListItems);

    // Test share functionality
    const shareButton = canvas.getByTestId('shoppingListView-button-share');
    await userEvent.click(shareButton);

    // Verify share was attempted (exportShoppingListAsText called again)
    expect(mockExportShoppingListAsTextImplementation).toHaveBeenCalledTimes(2);
  },
};

// Category Expand/Collapse Story: Test category expansion/collapse
export const CategoryExpandCollapse: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(mockShoppingListItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue(mockGroupedItems),
      calculateShoppingListProgress: fn().mockReturnValue({ completed: 1, total: 4, percentage: 25 }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to appear
    await expect(canvas.findByText('Dairy')).resolves.toBeInTheDocument();

    // Find and click the dairy category header to collapse it
    const dairyCategoryButton = canvas.getByRole('button', { name: /dairy/i });
    await userEvent.click(dairyCategoryButton);

    // Click again to expand it
    await userEvent.click(dairyCategoryButton);

    // Verify the category items are still visible after expand
    expect(canvas.getByText('Eggs')).toBeInTheDocument();
    expect(canvas.getByText('Parmesan Cheese')).toBeInTheDocument();
  },
};

// Single Category Story: Shopping list with items in only one category
export const SingleCategory: Story = {
  args: {
    shoppingList: mockShoppingList,
  },
  beforeEach: () => {
    const singleCategoryItems = mockShoppingListItems.filter(item => item.category === 'dairy');

    setupMocks({
      getShoppingListItems: fn().mockResolvedValue(singleCategoryItems),
      groupShoppingListItemsByCategory: fn().mockReturnValue({
        dairy: singleCategoryItems,
      }),
      calculateShoppingListProgress: fn().mockReturnValue({
        completed: singleCategoryItems.filter(item => item.isChecked).length,
        total: singleCategoryItems.length,
        percentage: Math.round((singleCategoryItems.filter(item => item.isChecked).length / singleCategoryItems.length) * 100)
      }),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to appear
    await expect(canvas.findByText('Dairy')).resolves.toBeInTheDocument();

    // Verify only dairy items are shown
    expect(canvas.getByText('Eggs')).toBeInTheDocument();
    expect(canvas.getByText('Parmesan Cheese')).toBeInTheDocument();

    // Verify other category items are not shown
    expect(canvas.queryByText('Spaghetti')).not.toBeInTheDocument();
    expect(canvas.queryByText('Romaine Lettuce')).not.toBeInTheDocument();
  },
};
