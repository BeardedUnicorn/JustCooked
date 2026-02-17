import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import PantryHub from './PantryHub';
import { PantryItem, IngredientDatabase } from '@app-types';
import { vi } from 'vitest';

// Mock services
const mockGetPantryItems = vi.fn();
const mockAddPantryItem = vi.fn();
const mockUpdatePantryItem = vi.fn();
const mockDeletePantryItem = vi.fn();

const mockLoadIngredients = vi.fn();
const mockSearchIngredients = vi.fn();
const mockAddIngredient = vi.fn();
const mockUpdateIngredient = vi.fn();
const mockDeleteIngredient = vi.fn();

vi.mock('@services/pantryStorage', () => ({
  getPantryItems: mockGetPantryItems,
  addPantryItem: mockAddPantryItem,
  updatePantryItem: mockUpdatePantryItem,
  deletePantryItem: mockDeletePantryItem,
}));

vi.mock('@services/ingredientStorage', () => ({
  loadIngredients: mockLoadIngredients,
  searchIngredients: mockSearchIngredients,
  addIngredient: mockAddIngredient,
  updateIngredient: mockUpdateIngredient,
  deleteIngredient: mockDeleteIngredient,
}));

// Mock PantryManager component
vi.mock('@components/PantryManager', () => ({
  default: ({ items, onAddItem, onUpdateItem, onDeleteItem }: {
    items: PantryItem[];
    onAddItem: (item: PantryItem) => void;
    onUpdateItem: (item: PantryItem) => void;
    onDeleteItem: (id: string) => void;
  }) => (
    <div data-testid="mock-pantry-manager">
      <h3>Pantry Manager</h3>
      <p>Items count: {items.length}</p>
      {items.length === 0 ? (
        <p>No pantry items found</p>
      ) : (
        <ul>
          {items.map(item => (
            <li key={item.id} data-testid={`pantry-item-${item.id}`}>
              {item.name} - {item.amount} {item.unit}
            </li>
          ))}
        </ul>
      )}
    </div>
  ),
}));

// Mock data
const mockPantryItems: PantryItem[] = [
  {
    id: 'pantry-1',
    name: 'Flour',
    amount: 5,
    unit: 'lbs',
    category: 'baking',
    expiryDate: '2024-12-31',
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'pantry-2',
    name: 'Sugar',
    amount: 2,
    unit: 'lbs',
    category: 'baking',
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
];

const mockIngredientDatabase: IngredientDatabase[] = [
  {
    id: 'ing-1',
    name: 'All-Purpose Flour',
    category: 'baking',
    aliases: ['flour', 'AP flour', 'plain flour'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ing-2',
    name: 'Sugar',
    category: 'baking',
    aliases: ['white sugar', 'granulated sugar', 'caster sugar'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ing-3',
    name: 'Eggs',
    category: 'dairy',
    aliases: ['egg', 'large eggs', 'chicken eggs'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
];

const meta: Meta<typeof PantryHub> = {
  title: 'Pages/PantryHub',
  component: PantryHub,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story - My Pantry Tab Active with items
export const MyPantryTabActive: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();
    
    mockGetPantryItems.mockResolvedValue(mockPantryItems);
    mockLoadIngredients.mockResolvedValue(mockIngredientDatabase);
  },
};

// My Pantry Tab with no items (empty state)
export const MyPantryTabEmpty: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();
    
    mockGetPantryItems.mockResolvedValue([]);
    mockLoadIngredients.mockResolvedValue(mockIngredientDatabase);
  },
};

// Ingredient Database Tab Active with ingredients
export const IngredientDatabaseTabActive: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();
    
    mockGetPantryItems.mockResolvedValue(mockPantryItems);
    mockLoadIngredients.mockResolvedValue(mockIngredientDatabase);
    mockSearchIngredients.mockResolvedValue(
      mockIngredientDatabase.map(ingredient => ({ ingredient, score: 1.0 }))
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click on Ingredient Database tab
    const ingredientDbTab = canvas.getByTestId('pantryHubPage-tab-ingredientDb');
    await userEvent.click(ingredientDbTab);
    
    // Wait for ingredient database table to load
    await expect(canvas.getByTestId('pantryHubPage-ingredientDb-table-main')).toBeInTheDocument();
  },
};

// Ingredient Database Tab with no ingredients (empty state)
export const IngredientDatabaseTabEmpty: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();

    mockGetPantryItems.mockResolvedValue(mockPantryItems);
    mockLoadIngredients.mockResolvedValue([]);
    mockSearchIngredients.mockResolvedValue([]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Ingredient Database tab
    const ingredientDbTab = canvas.getByTestId('pantryHubPage-tab-ingredientDb');
    await userEvent.click(ingredientDbTab);

    // Wait for ingredient database table to load (should be empty)
    await expect(canvas.getByTestId('pantryHubPage-ingredientDb-table-main')).toBeInTheDocument();
  },
};

// Loading states
export const MyPantryTabLoading: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();

    // Mock slow loading by returning a promise that doesn't resolve immediately
    mockGetPantryItems.mockImplementation(() => new Promise(() => {}));
    mockLoadIngredients.mockResolvedValue(mockIngredientDatabase);
  },
};

export const IngredientDatabaseTabLoading: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();

    mockGetPantryItems.mockResolvedValue(mockPantryItems);
    mockLoadIngredients.mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Ingredient Database tab to trigger loading
    const ingredientDbTab = canvas.getByTestId('pantryHubPage-tab-ingredientDb');
    await userEvent.click(ingredientDbTab);
  },
};

// Comprehensive interaction tests
export const InteractionTests: Story = {
  beforeEach: () => {
    mockGetPantryItems.mockClear();
    mockLoadIngredients.mockClear();
    mockSearchIngredients.mockClear();
    mockAddPantryItem.mockClear();
    mockUpdatePantryItem.mockClear();
    mockDeletePantryItem.mockClear();
    mockAddIngredient.mockClear();
    mockUpdateIngredient.mockClear();
    mockDeleteIngredient.mockClear();

    mockGetPantryItems.mockResolvedValue(mockPantryItems);
    mockLoadIngredients.mockResolvedValue(mockIngredientDatabase);
    mockSearchIngredients.mockResolvedValue(
      mockIngredientDatabase.map(ingredient => ({ ingredient, score: 1.0 }))
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test 1: Verify initial state (My Pantry tab active)
    await expect(canvas.getByTestId('pantryHubPage-title-main')).toHaveTextContent('Pantry');
    await expect(canvas.getByTestId('mock-pantry-manager')).toBeInTheDocument();

    // Test 2: Switch to Ingredient Database tab
    const ingredientDbTab = canvas.getByTestId('pantryHubPage-tab-ingredientDb');
    await userEvent.click(ingredientDbTab);

    // Verify ingredient database is loaded
    await expect(canvas.getByTestId('pantryHubPage-ingredientDb-table-main')).toBeInTheDocument();

    // Test 3: Search for ingredients
    const searchInput = canvas.getByTestId('pantryHubPage-ingredientDb-input-search');
    await userEvent.type(searchInput, 'flour');

    // Test 4: Verify FAB is present for adding ingredients
    await expect(canvas.getByTestId('pantryHubPage-ingredientDb-fab-add')).toBeInTheDocument();

    // Test 5: Switch back to My Pantry tab
    const myPantryTab = canvas.getByTestId('pantryHubPage-tab-myPantry');
    await userEvent.click(myPantryTab);

    // Verify pantry manager is shown
    await expect(canvas.getByTestId('mock-pantry-manager')).toBeInTheDocument();
  },
};
