import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import IngredientAssociationModal from './IngredientAssociationModal';
import { IngredientDatabase } from '@app-types/ingredientDatabase';

// Create a mock invoke function that can be configured per story
let mockInvokeImplementation: any = fn();

// Mock the Tauri invoke function globally for Storybook
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__TAURI__ = {
    core: {
      invoke: (...args: any[]) => mockInvokeImplementation(...args)
    },
  };
}

// Mock ingredient data
const mockIngredients: IngredientDatabase[] = [
  {
    id: '1',
    name: 'All-purpose flour',
    category: 'Grains & Cereals',
    aliases: ['flour', 'white flour', 'plain flour'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Granulated sugar',
    category: 'Sweeteners',
    aliases: ['sugar', 'white sugar', 'caster sugar'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Whole milk',
    category: 'Dairy',
    aliases: ['milk', 'fresh milk'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
];

const meta: Meta<typeof IngredientAssociationModal> = {
  title: 'Modals/IngredientAssociationModal',
  component: IngredientAssociationModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onAssociate: { action: 'associated' },
    open: { control: 'boolean' },
    productName: { control: 'text' },
  },
  args: {
    open: true,
    onClose: fn(),
    onAssociate: fn(),
    productName: 'Test Product',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Open Story: Modal with auto-search based on product name
export const DefaultOpen: Story = {
  args: {
    open: true,
    productName: 'All-purpose flour',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
};

// Closed State Story: Modal in closed state
export const Closed: Story = {
  args: {
    open: false,
    productName: 'Test Product',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn();
  },
};

// Searching State Story: Modal showing loading indicator
export const Searching: Story = {
  args: {
    open: true,
    productName: 'Searching ingredient',
  },
  beforeEach: () => {
    // Mock a delayed response to show loading state
    mockInvokeImplementation = fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockIngredients), 5000))
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait a moment for the search to trigger, then verify loading indicator is shown
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(canvas.getByTestId('ingredientAssocModal-loading-search')).toBeInTheDocument();
  },
};

// With Search Results Story: Modal with search results displayed
export const WithSearchResults: Story = {
  args: {
    open: true,
    productName: 'flour',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for search results to appear
    await expect(canvas.findByText('Search Results (3)')).resolves.toBeInTheDocument();
    expect(canvas.getByText('All-purpose flour')).toBeInTheDocument();
    expect(canvas.getByText('Granulated sugar')).toBeInTheDocument();
    expect(canvas.getByText('Whole milk')).toBeInTheDocument();
  },
};

// No Search Results Story: Modal with empty search results
export const NoSearchResults: Story = {
  args: {
    open: true,
    productName: 'nonexistent ingredient',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue([]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for search to complete and verify no results message
    await expect(canvas.findByText(/No ingredients found for ".*"\. Try a different search term\./)).resolves.toBeInTheDocument();
  },
};

// Search Error Story: Modal showing error state
export const SearchError: Story = {
  args: {
    open: true,
    productName: 'error test',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockRejectedValue(new Error('Database connection failed'));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for error to appear
    await expect(canvas.findByTestId('ingredientAssocModal-alert-error')).resolves.toBeInTheDocument();
    expect(canvas.getByText('Failed to search ingredients. Please try again.')).toBeInTheDocument();
  },
};

// Ingredient Selected Story: Modal with an ingredient pre-selected
export const IngredientSelected: Story = {
  args: {
    open: true,
    productName: 'flour',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for search results and select the first ingredient
    await expect(canvas.findByText('All-purpose flour')).resolves.toBeInTheDocument();

    const firstIngredient = canvas.getByTestId('ingredient-result-1');
    await userEvent.click(firstIngredient);

    // Verify selected ingredient display appears
    await expect(canvas.findByTestId('ingredientAssocModal-display-selected')).resolves.toBeInTheDocument();
    await expect(canvas.findByText('Selected Ingredient')).resolves.toBeInTheDocument();

    // Verify ingredient is selected (button should be enabled)
    const associateButton = canvas.getByTestId('ingredient-associate-button');
    expect(associateButton).not.toBeDisabled();
  },
};

// Long Product Name Story: Modal with a very long product name
export const LongProductName: Story = {
  args: {
    open: true,
    productName: 'Organic Extra Virgin Cold-Pressed Unrefined Coconut Oil with Natural Vanilla Extract and Sea Salt',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue([
      {
        id: '4',
        name: 'Coconut oil',
        category: 'Oils & Fats',
        aliases: ['coconut oil', 'virgin coconut oil'],
        dateAdded: '2024-01-01T00:00:00Z',
        dateModified: '2024-01-01T00:00:00Z',
      },
    ]);
  },
};

// Many Results Story: Modal with many search results
export const ManyResults: Story = {
  args: {
    open: true,
    productName: 'flour',
  },
  beforeEach: () => {
    const manyIngredients = Array.from({ length: 15 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Flour type ${i + 1}`,
      category: 'Grains & Cereals',
      aliases: [`flour${i + 1}`],
      dateAdded: '2024-01-01T00:00:00Z',
      dateModified: '2024-01-01T00:00:00Z',
    }));
    mockInvokeImplementation = fn().mockResolvedValue(manyIngredients);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for search results to appear
    await expect(canvas.findByText('Search Results (15)')).resolves.toBeInTheDocument();
    
    // Verify scrollable list
    const resultsList = canvas.getByRole('list');
    expect(resultsList).toBeInTheDocument();
  },
};

// Interaction Tests Story: Test all interactive elements
export const InteractionTests: Story = {
  args: {
    open: true,
    productName: 'test product',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for initial search to complete
    await expect(canvas.findByText('Search Results (3)')).resolves.toBeInTheDocument();

    // Test search input
    const searchInput = canvas.getByTestId('ingredient-search-input').querySelector('input');
    if (searchInput) {
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, 'sugar');

      // Wait for debounced search to trigger
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify search was called
      expect(mockInvokeImplementation).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'sugar',
        limit: 20,
      });
    }

    // Wait for search results
    await expect(canvas.findByText('Granulated sugar')).resolves.toBeInTheDocument();

    // Test ingredient selection
    const sugarIngredient = canvas.getByTestId('ingredient-result-2');
    await userEvent.click(sugarIngredient);

    // Verify selected ingredient display appears
    await expect(canvas.findByTestId('ingredientAssocModal-display-selected')).resolves.toBeInTheDocument();

    // Verify associate button is enabled
    const associateButton = canvas.getByTestId('ingredient-associate-button');
    expect(associateButton).not.toBeDisabled();

    // Test associate button
    await userEvent.click(associateButton);

    // Verify onAssociate was called with correct data
    expect(args.onAssociate).toHaveBeenCalledWith({
      ingredient_id: '2',
      ingredient_name: 'Granulated sugar',
    });
  },
};

// Skip Association Story: Test skip functionality
export const SkipAssociation: Story = {
  args: {
    open: true,
    productName: 'unknown product',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue([]);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Click skip button
    const skipButton = canvas.getByTestId('ingredient-skip-button');
    await userEvent.click(skipButton);
    
    // Verify onAssociate was called with null
    expect(args.onAssociate).toHaveBeenCalledWith(null);
  },
};

// Search Query Change Story: Test changing search query
export const SearchQueryChange: Story = {
  args: {
    open: true,
    productName: 'initial product',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initial search
    await expect(canvas.findByText('Search Results (3)')).resolves.toBeInTheDocument();

    // Clear and type new search
    const searchInput = canvas.getByTestId('ingredient-search-input').querySelector('input');
    if (searchInput) {
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, 'milk');

      // Wait for debounced search to trigger
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify new search was triggered
      expect(mockInvokeImplementation).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'milk',
        limit: 20,
      });
    }
  },
};

// Empty Search Query Story: Test clearing search query
export const EmptySearchQuery: Story = {
  args: {
    open: true,
    productName: 'test',
  },
  beforeEach: () => {
    mockInvokeImplementation = fn().mockResolvedValue(mockIngredients);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for initial search results
    await expect(canvas.findByText('Search Results (3)')).resolves.toBeInTheDocument();
    
    // Clear search input
    const searchInput = canvas.getByTestId('ingredient-search-input').querySelector('input');
    if (searchInput) {
      await userEvent.clear(searchInput);
      
      // Verify search results are cleared
      expect(canvas.queryByText('Search Results')).not.toBeInTheDocument();
    }
  },
};
