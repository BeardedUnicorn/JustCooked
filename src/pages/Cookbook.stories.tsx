import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import Cookbook from './Cookbook';
import { mockRecipe, mockPantryItems } from '@/__tests__/fixtures/recipes';
import { Recipe, RecipeCollection, PantryItem } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetRecipesPaginatedImplementation = fn();
let mockGetRecipeCountImplementation = fn();
let mockSearchRecipesPaginatedImplementation = fn();
let mockGetSearchRecipesCountImplementation = fn();
let mockGetAllRecipesImplementation = fn();
let mockGetAllCollectionsImplementation = fn();
let mockCreateCollectionImplementation = fn();
let mockDeleteCollectionImplementation = fn();
let mockSaveCollectionImplementation = fn();
let mockGetPantryItemsImplementation = fn();
let mockImportRecipeFromUrlImplementation = fn();
let mockSaveSearchImplementation = fn();

// Browser-compatible service mocks configuration function
const configureServiceMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      recipeStorage: {
        getRecipesPaginated: mockGetRecipesPaginatedImplementation,
        getRecipeCount: mockGetRecipeCountImplementation,
        searchRecipesPaginated: mockSearchRecipesPaginatedImplementation,
        getSearchRecipesCount: mockGetSearchRecipesCountImplementation,
        getAllRecipes: mockGetAllRecipesImplementation,
      },
      recipeCollectionStorage: {
        getAllCollections: mockGetAllCollectionsImplementation,
        createCollection: mockCreateCollectionImplementation,
        deleteCollection: mockDeleteCollectionImplementation,
        saveCollection: mockSaveCollectionImplementation,
      },
      pantryStorage: {
        getPantryItems: mockGetPantryItemsImplementation,
      },
      recipeImport: {
        importRecipeFromUrl: mockImportRecipeFromUrlImplementation,
      },
      searchHistoryStorage: {
        saveSearch: mockSaveSearchImplementation,
      },
    };
  }
};

// Browser-compatible component mocks
const configureComponentMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_COMPONENT_MOCKS__ = {
      BatchImportDialog: function MockBatchImportDialog({
        open,
        onClose,
        onTaskAdded,
      }: {
        open: boolean;
        onClose: () => void;
        onTaskAdded: () => void;
      }) {
        if (!open) return null;
        return (
          <div data-testid="batch-import-dialog">
            <h2>Batch Import</h2>
            <button data-testid="batch-import-cancel" onClick={onClose}>
              Cancel
            </button>
            <button data-testid="batch-import-add" onClick={onTaskAdded}>
              Add to Queue
            </button>
          </div>
        );
      },
    };
  }
};

// Initialize mocks
configureServiceMocks();
configureComponentMocks();

// Extended mock data
const mockRecipes: Recipe[] = [
  mockRecipe,
  {
    ...mockRecipe,
    id: 'recipe-2',
    title: 'Vanilla Cupcakes',
    description: 'Light and fluffy vanilla cupcakes',
    tags: ['dessert', 'cupcakes', 'vanilla'],
    ingredients: [
      { name: 'flour', amount: 1.5, unit: 'cups' },
      { name: 'sugar', amount: 1, unit: 'cup' },
      { name: 'eggs', amount: 2, unit: '' },
      { name: 'vanilla extract', amount: 1, unit: 'tsp' },
    ],
  },
  {
    ...mockRecipe,
    id: 'recipe-3',
    title: 'Chocolate Brownies',
    description: 'Rich and fudgy chocolate brownies',
    tags: ['dessert', 'chocolate', 'brownies'],
    ingredients: [
      { name: 'flour', amount: 1, unit: 'cup' },
      { name: 'cocoa powder', amount: 0.5, unit: 'cup' },
      { name: 'sugar', amount: 1.5, unit: 'cups' },
      { name: 'eggs', amount: 3, unit: '' },
    ],
  },
];

const mockCollections: RecipeCollection[] = [
  {
    id: 'collection-1',
    name: 'Favorites',
    description: 'My favorite recipes',
    recipeIds: ['test-recipe-123', 'recipe-2'],
    dateCreated: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'collection-2',
    name: 'Quick Desserts',
    description: 'Fast and easy dessert recipes',
    recipeIds: ['recipe-3'],
    dateCreated: '2024-01-02T00:00:00.000Z',
    dateModified: '2024-01-02T00:00:00.000Z',
  },
];

const meta: Meta<typeof Cookbook> = {
  title: 'Pages/Cookbook',
  component: Cookbook,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The Cookbook page manages recipe browsing, collections, and smart cookbook functionality with import capabilities.',
      },
    },
    router: {
      initialEntries: ['/cookbook'],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Cookbook>;

export const AllRecipesTabActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default view showing the All Recipes tab with paginated recipe list.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page title and tabs
    await expect(canvas.getByTestId('cookbook-title')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookbook-tab-all-recipes')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookbook-tab-collections')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookbook-tab-smart')).toBeInTheDocument();

    // Verify search bar is present
    await expect(canvas.getByTestId('cookbook-search-bar')).toBeInTheDocument();

    // Verify FAB is present
    await expect(canvas.getByTestId('cookbook-import-fab')).toBeInTheDocument();

    // Wait for recipes to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  },
};

export const AllRecipesTabWithSearchResults: Story = {
  parameters: {
    docs: {
      description: {
        story: 'All Recipes tab showing search results.',
      },
    },
    router: {
      initialEntries: ['/cookbook?q=chocolate'],
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    const searchResults = mockRecipes.filter(r => r.title.toLowerCase().includes('chocolate'));
    mockSearchRecipesPaginatedImplementation = fn().mockResolvedValue(searchResults);
    mockGetSearchRecipesCountImplementation = fn().mockResolvedValue(searchResults.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for search results to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
    await expect(canvas.getByText('Chocolate Brownies')).toBeInTheDocument();

    // Verify search was called with the query
    await expect(mockSearchRecipesPaginatedImplementation).toHaveBeenCalledWith('chocolate', 1, 12);
  },
};

export const CollectionsTabActiveList: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Collections tab showing the list of recipe collections.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue([]);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(0);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue(mockCollections);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Collections tab
    const collectionsTab = canvas.getByTestId('cookbook-tab-collections');
    await userEvent.click(collectionsTab);

    // Wait for collections to load
    await expect(canvas.getByText('Favorites')).toBeInTheDocument();
    await expect(canvas.getByText('Quick Desserts')).toBeInTheDocument();

    // Verify create collection button is present
    await expect(canvas.getByText('Create Collection')).toBeInTheDocument();
  },
};

export const CollectionsTabActiveViewCollection: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Collections tab showing recipes within a selected collection.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue([]);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(0);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue(mockCollections);
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Collections tab
    const collectionsTab = canvas.getByTestId('cookbook-tab-collections');
    await userEvent.click(collectionsTab);

    // Wait for collections to load and click on first collection
    await expect(canvas.getByText('Favorites')).toBeInTheDocument();
    const favoritesCollection = canvas.getByText('Favorites');
    await userEvent.click(favoritesCollection);

    // Verify we're viewing the collection recipes
    await expect(canvas.getByText('← Back to Collections')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookbookPage-collections-grid-recipes')).toBeInTheDocument();
  },
};

export const CollectionsTabEmpty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Collections tab when no collections exist.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue([]);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(0);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Collections tab
    const collectionsTab = canvas.getByTestId('cookbook-tab-collections');
    await userEvent.click(collectionsTab);

    // Verify empty state
    await expect(canvas.getByText('No collections yet')).toBeInTheDocument();
    await expect(canvas.getByText('Create your first collection to organize your recipes.')).toBeInTheDocument();
  },
};

export const SmartCookbookTabActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Smart Cookbook tab showing recipes based on pantry items.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue([]);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(0);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetPantryItemsImplementation = fn().mockResolvedValue(mockPantryItems);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Smart Cookbook tab
    const smartTab = canvas.getByTestId('cookbook-tab-smart');
    await userEvent.click(smartTab);

    // Wait for smart cookbook data to load
    await expect(canvas.getByText('Smart Cookbook')).toBeInTheDocument();
    await expect(canvas.getByText('Recipes you can make with your pantry items')).toBeInTheDocument();

    // Verify recipes are shown with ingredient availability info
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  },
};

export const ImportDialogUrlOpen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Cookbook with the URL import dialog open.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);
    mockImportRecipeFromUrlImplementation = fn().mockResolvedValue();

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for page to load
    await expect(canvas.getByTestId('cookbook-import-fab')).toBeInTheDocument();

    // Click FAB to open menu
    const fab = canvas.getByTestId('cookbook-import-fab');
    await userEvent.click(fab);

    // Verify menu is open and click Import from URL
    await expect(canvas.getByTestId('cookbook-import-menu')).toBeInTheDocument();
    const importUrlOption = canvas.getByTestId('cookbook-import-url-menu-item');
    await userEvent.click(importUrlOption);

    // Verify import dialog is open
    await expect(canvas.getByText('Import Recipe from URL')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Enter recipe URL...')).toBeInTheDocument();
  },
};

export const BatchImportDialogOpen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Cookbook with the batch import dialog open.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for page to load
    await expect(canvas.getByTestId('cookbook-import-fab')).toBeInTheDocument();

    // Click FAB to open menu
    const fab = canvas.getByTestId('cookbook-import-fab');
    await userEvent.click(fab);

    // Click Batch Import option
    const batchImportOption = canvas.getByTestId('cookbook-batch-import-menu-item');
    await userEvent.click(batchImportOption);

    // Verify batch import dialog is open
    await expect(canvas.getByTestId('batch-import-dialog')).toBeInTheDocument();
    await expect(canvas.getByText('Batch Import')).toBeInTheDocument();
  },
};

// Interaction Tests
export const TabSwitchingInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test switching between different tabs.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue(mockCollections);
    mockGetAllRecipesImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetPantryItemsImplementation = fn().mockResolvedValue(mockPantryItems);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Start on All Recipes tab
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Switch to Collections tab
    const collectionsTab = canvas.getByTestId('cookbook-tab-collections');
    await userEvent.click(collectionsTab);
    await expect(canvas.getByText('Favorites')).toBeInTheDocument();

    // Switch to Smart Cookbook tab
    const smartTab = canvas.getByTestId('cookbook-tab-smart');
    await userEvent.click(smartTab);
    await expect(canvas.getByText('Recipes you can make with your pantry items')).toBeInTheDocument();

    // Switch back to All Recipes tab
    const allRecipesTab = canvas.getByTestId('cookbook-tab-all-recipes');
    await userEvent.click(allRecipesTab);
    await expect(canvas.getByTestId('cookbook-search-bar')).toBeInTheDocument();
  },
};

export const SearchInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test searching for recipes.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    const searchResults = mockRecipes.filter(r => r.title.toLowerCase().includes('chocolate'));
    mockSearchRecipesPaginatedImplementation = fn().mockResolvedValue(searchResults);
    mockGetSearchRecipesCountImplementation = fn().mockResolvedValue(searchResults.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initial load
    await expect(canvas.getByTestId('cookbook-search-bar')).toBeInTheDocument();

    // Find and interact with search input
    const searchInput = canvas.getByPlaceholderText('Search recipes...');
    await userEvent.type(searchInput, 'chocolate');
    await userEvent.keyboard('{Enter}');

    // Verify search was called
    await expect(mockSearchRecipesPaginatedImplementation).toHaveBeenCalledWith('chocolate', 1, 12);
  },
};

export const ImportRecipeInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test importing a recipe from URL.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue(mockRecipes);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(mockRecipes.length);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue([]);
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);
    mockImportRecipeFromUrlImplementation = fn().mockResolvedValue();

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open FAB menu
    const fab = canvas.getByTestId('cookbook-import-fab');
    await userEvent.click(fab);

    // Click Import from URL
    const importUrlOption = canvas.getByTestId('cookbook-import-url-menu-item');
    await userEvent.click(importUrlOption);

    // Fill in URL and submit
    const urlInput = canvas.getByPlaceholderText('Enter recipe URL...');
    await userEvent.type(urlInput, 'https://example.com/recipe');

    const submitButton = canvas.getByTestId('cookbook-import-submit-button');
    await userEvent.click(submitButton);

    // Verify import service was called
    await expect(mockImportRecipeFromUrlImplementation).toHaveBeenCalledWith('https://example.com/recipe');
  },
};

export const CreateCollectionInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test creating a new recipe collection.',
      },
    },
  },
  beforeEach: () => {
    // Reset and configure mock implementations
    mockGetRecipesPaginatedImplementation = fn().mockResolvedValue([]);
    mockGetRecipeCountImplementation = fn().mockResolvedValue(0);
    mockGetAllCollectionsImplementation = fn().mockResolvedValue(mockCollections);
    mockCreateCollectionImplementation = fn().mockResolvedValue({
      id: 'new-collection',
      name: 'New Collection',
      description: 'A new collection',
      recipeIds: [],
      dateCreated: '2024-01-01T00:00:00.000Z',
      dateModified: '2024-01-01T00:00:00.000Z',
    });
    mockGetPantryItemsImplementation = fn().mockResolvedValue([]);

    // Update service mocks
    configureServiceMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Switch to Collections tab
    const collectionsTab = canvas.getByTestId('cookbook-tab-collections');
    await userEvent.click(collectionsTab);

    // Wait for collections to load and click Create Collection
    await expect(canvas.getByText('Create Collection')).toBeInTheDocument();
    const createButton = canvas.getByText('Create Collection');
    await userEvent.click(createButton);

    // Fill in collection details
    const nameInput = canvas.getByLabelText('Collection Name');
    await userEvent.type(nameInput, 'New Collection');

    const descriptionInput = canvas.getByLabelText('Description (optional)');
    await userEvent.type(descriptionInput, 'A new collection');

    // Submit form
    const submitButton = canvas.getByTestId('cookbook-collections-create-submit-button');
    await userEvent.click(submitButton);

    // Verify create service was called
    await expect(mockCreateCollectionImplementation).toHaveBeenCalledWith('New Collection', 'A new collection');
  },
};
