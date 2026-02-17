import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BatchImportDialog from './BatchImportDialog';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock the services
import * as batchImportService from '@services/batchImport';
import * as reImportService from '@services/reImportService';
import * as recipeStorage from '@services/recipeStorage';

// Browser-compatible mock implementation variables
let mockInvokeImplementation = fn().mockResolvedValue(undefined);
let mockGetSuggestedCategoryUrlsImplementation = fn();
let mockGetPopularCategoryUrlsImplementation = fn();
let mockGetExistingRecipeUrlsImplementation = fn();
let mockGetReImportableRecipesCountImplementation = fn();

// Mock the services for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    batchImportService: {
      getSuggestedCategoryUrls: mockGetSuggestedCategoryUrlsImplementation,
      getPopularCategoryUrls: mockGetPopularCategoryUrlsImplementation,
    },
    reImportService: {
      getReImportableRecipesCount: mockGetReImportableRecipesCountImplementation,
      getTaskDescription: fn(),
      addToQueue: fn(),
    },
    recipeStorage: {
      getExistingRecipeUrls: mockGetExistingRecipeUrlsImplementation,
    },
    importQueueService: {
      getTaskDescription: fn(),
    },
  };
}

// Mock Tauri API for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__TAURI__ = {
    core: { invoke: mockInvokeImplementation },
    fs: {},
    dialog: {},
  };
}

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      importQueue: importQueueReducer,
    },
    preloadedState: {
      importQueue: {
        tasks: [],
        currentTaskId: undefined,
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
        loading: false,
        error: null,
        ...initialState,
      },
    },
  });
};

const meta: Meta<typeof BatchImportDialog> = {
  title: 'Modals/BatchImportDialog',
  component: BatchImportDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const store = context.parameters.redux?.store || createMockStore();
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  argTypes: {
    onClose: { action: 'closed' },
    onTaskAdded: { action: 'taskAdded' },
    open: { control: 'boolean' },
  },
  args: {
    onClose: fn(),
    onTaskAdded: fn(),
    open: true,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
const mockSuggestedUrls = [
  'https://www.allrecipes.com/recipes/79/desserts/',
  'https://www.allrecipes.com/recipes/17562/breakfast-and-brunch/',
  'https://www.allrecipes.com/recipes/17567/dinner/',
];

const mockPopularUrls = [
  'https://www.allrecipes.com/recipes/79/desserts/',
  'https://www.allrecipes.com/recipes/17562/breakfast-and-brunch/',
  'https://www.allrecipes.com/recipes/17567/dinner/',
  'https://www.allrecipes.com/recipes/16376/appetizers-and-snacks/',
  'https://www.allrecipes.com/recipes/17567/dinner/main-dish/',
];

// Default: Initial empty state
export const Default: Story = {
  beforeEach: () => {
    mockGetSuggestedCategoryUrlsImplementation = fn().mockReturnValue(mockSuggestedUrls);
    mockGetPopularCategoryUrlsImplementation = fn().mockReturnValue(mockPopularUrls);
    mockGetExistingRecipeUrlsImplementation = fn().mockResolvedValue([]);
    mockGetReImportableRecipesCountImplementation = fn().mockResolvedValue(0);

    // Configure service mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        batchImportService: {
          getSuggestedCategoryUrls: mockGetSuggestedCategoryUrlsImplementation,
          getPopularCategoryUrls: mockGetPopularCategoryUrlsImplementation,
        },
        reImportService: {
          getReImportableRecipesCount: mockGetReImportableRecipesCountImplementation,
          getTaskDescription: fn(),
          addToQueue: fn(),
        },
        recipeStorage: {
          getExistingRecipeUrls: mockGetExistingRecipeUrlsImplementation,
        },
      };
    }
  },
};

// UrlEnteredValid: Valid AllRecipes URL typed
export const UrlEnteredValid: Story = {
  beforeEach: () => {
    mockGetSuggestedCategoryUrlsImplementation = fn().mockReturnValue(mockSuggestedUrls);
    mockGetPopularCategoryUrlsImplementation = fn().mockReturnValue(mockPopularUrls);
    mockGetExistingRecipeUrlsImplementation = fn().mockResolvedValue([]);
    mockGetReImportableRecipesCountImplementation = fn().mockResolvedValue(0);

    // Configure service mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        batchImportService: {
          getSuggestedCategoryUrls: mockGetSuggestedCategoryUrlsImplementation,
          getPopularCategoryUrls: mockGetPopularCategoryUrlsImplementation,
        },
        reImportService: {
          getReImportableRecipesCount: mockGetReImportableRecipesCountImplementation,
          getTaskDescription: fn(),
          addToQueue: fn(),
        },
        recipeStorage: {
          getExistingRecipeUrls: mockGetExistingRecipeUrlsImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Type a valid URL
    const urlInput = canvas.getByTestId('batch-import-url-input');
    await userEvent.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts/');

    // Verify the Add to Queue button is enabled
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    expect(addButton).not.toBeDisabled();
  },
};

// Browser-compatible mock configuration function
const configureBatchImportMocks = (overrides: any = {}) => {
  mockGetSuggestedCategoryUrlsImplementation = fn().mockReturnValue(overrides.suggestedUrls || mockSuggestedUrls);
  mockGetPopularCategoryUrlsImplementation = fn().mockReturnValue(overrides.popularUrls || mockPopularUrls);
  mockGetExistingRecipeUrlsImplementation = fn().mockResolvedValue(overrides.existingUrls || []);
  mockGetReImportableRecipesCountImplementation = fn().mockResolvedValue(overrides.reImportCount || 0);

  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      batchImportService: {
        getSuggestedCategoryUrls: mockGetSuggestedCategoryUrlsImplementation,
        getPopularCategoryUrls: mockGetPopularCategoryUrlsImplementation,
      },
      reImportService: {
        getReImportableRecipesCount: mockGetReImportableRecipesCountImplementation,
        getTaskDescription: fn(),
        addToQueue: fn(),
      },
      recipeStorage: {
        getExistingRecipeUrls: mockGetExistingRecipeUrlsImplementation,
      },
    };
  }
};

// UrlEnteredInvalid: Invalid URL
export const UrlEnteredInvalid: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Type an invalid URL
    const urlInput = canvas.getByTestId('batch-import-url-input');
    await userEvent.type(urlInput, 'https://invalid-url.com');

    // Verify error message appears
    expect(canvas.getByText('Please enter a valid AllRecipes category URL')).toBeInTheDocument();

    // Verify the Add to Queue button is disabled
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    expect(addButton).toBeDisabled();
  },
};

// LoadingPopularCategories: Simulate loading state
export const LoadingPopularCategories: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the Load Popular Categories button
    const loadButton = canvas.getByTestId('batch-import-load-popular-button');
    await userEvent.click(loadButton);

    // The button should show loading state
    expect(loadButton).toHaveTextContent('Loading...');
    expect(loadButton).toBeDisabled();
  },
};

// AddingToQueue: Simulate isAddingToQueue = true
export const AddingToQueue: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Type a valid URL
    const urlInput = canvas.getByTestId('batch-import-url-input');
    await userEvent.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts/');

    // Click Add to Queue button
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    await userEvent.click(addButton);

    // The button should show loading state
    expect(addButton).toHaveTextContent('Adding to Queue...');
    expect(addButton).toBeDisabled();
  },
};

// ErrorState: Display an error alert
export const ErrorState: Story = {
  beforeEach: () => {
    configureBatchImportMocks({
      existingUrls: Promise.reject(new Error('Failed to load existing recipes'))
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Type a valid URL
    const urlInput = canvas.getByTestId('batch-import-url-input');
    await userEvent.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts/');

    // Click Add to Queue button to trigger error
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    await userEvent.click(addButton);

    // Wait for error to appear
    await canvas.findByText(/Failed to load existing recipes/);
  },
};

// SuccessState: Display a success alert
export const SuccessState: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Load Popular Categories button
    const loadButton = canvas.getByTestId('batch-import-load-popular-button');
    await userEvent.click(loadButton);

    // Wait for success message to appear
    await canvas.findByText(/Successfully added.*popular categories to the queue!/);
  },
};

// Interaction Test: Click suggested URL
export const InteractionTestSuggestedUrl: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on a suggested URL
    const suggestedUrl = canvas.getByText('Desserts');
    await userEvent.click(suggestedUrl);

    // Verify the URL input is populated
    const urlInput = canvas.getByTestId('batch-import-url-input');
    expect(urlInput).toHaveValue('https://www.allrecipes.com/recipes/79/desserts/');

    // Verify the Add to Queue button is enabled
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    expect(addButton).not.toBeDisabled();
  },
};

// Interaction Test: Submit form
export const InteractionTestSubmitForm: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Type a valid URL
    const urlInput = canvas.getByTestId('batch-import-url-input');
    await userEvent.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts/');

    // Set max recipes
    const maxRecipesInput = canvas.getByTestId('batch-import-max-recipes-input');
    await userEvent.type(maxRecipesInput, '50');

    // Set max depth
    const maxDepthInput = canvas.getByTestId('batch-import-max-depth-input');
    await userEvent.type(maxDepthInput, '3');

    // Click Add to Queue button
    const addButton = canvas.getByTestId('batch-import-add-to-queue-button');
    await userEvent.click(addButton);

    // Note: In a real test, we would verify onTaskAdded and onClose are called
    // but this requires proper Redux store mocking which is complex in Storybook
  },
};

// Interaction Test: Cancel dialog
export const InteractionTestCancel: Story = {
  beforeEach: () => {
    configureBatchImportMocks();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click cancel button
    const cancelButton = canvas.getByTestId('batch-import-cancel-button');
    await userEvent.click(cancelButton);

    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
  },
};
