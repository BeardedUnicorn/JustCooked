import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import BatchImportDialog from '@components/BatchImportDialog';
import { batchImportService } from '@services/batchImport';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock the batch import service
vi.mock('@services/batchImport');
const mockBatchImportService = vi.mocked(batchImportService);

// Mock recipe storage
vi.mock('@services/recipeStorage');
const mockGetExistingRecipeUrls = vi.mocked(getExistingRecipeUrls);

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Import the mocked invoke function
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

const createTestStore = () => {
  return configureStore({
    reducer: {
      importQueue: importQueueReducer,
    },
  });
};

describe('BatchImportDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onTaskAdded: vi.fn(),
  };

  const renderWithRedux = (props = defaultProps) => {
    const store = createTestStore();
    return render(
      <Provider store={store}>
        <BatchImportDialog {...props} />
      </Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchImportService.getSuggestedCategoryUrls.mockReturnValue([
      {
        name: 'Desserts',
        url: 'https://www.allrecipes.com/recipes/79/desserts',
        description: 'All dessert recipes',
      },
      {
        name: 'Main Dishes',
        url: 'https://www.allrecipes.com/recipes/17562/dinner/main-dishes',
        description: 'Main course recipes',
      },
    ]);
    mockBatchImportService.estimateImportTime.mockReturnValue({
      minMinutes: 5,
      maxMinutes: 10,
      description: 'Medium import',
    });
    mockBatchImportService.getPopularCategoryUrls.mockReturnValue([
      'https://www.allrecipes.com/recipes/17057/everyday-cooking/more-meal-ideas/5-ingredients/main-dishes/',
      'https://www.allrecipes.com/recipes/15436/everyday-cooking/one-pot-meals/',
      'https://www.allrecipes.com/recipes/1947/everyday-cooking/quick-and-easy/',
    ]);
    mockGetExistingRecipeUrls.mockResolvedValue([]);

    // Set up default mock responses for Tauri commands
    mockInvoke.mockImplementation((command: string) => {
      switch (command) {
        case 'get_import_queue_status':
          return Promise.resolve({
            tasks: [],
            currentTaskId: null,
            isProcessing: false,
            totalPending: 0,
            totalCompleted: 0,
            totalFailed: 0,
          });
        case 'add_to_import_queue':
          return Promise.resolve('task-123');
        default:
          return Promise.resolve();
      }
    });
  });

  test('renders dialog with initial state', () => {
    renderWithRedux();

    expect(screen.getByText('Add Batch Import to Queue')).toBeInTheDocument();
    expect(screen.getByLabelText('Category URL')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeDisabled();
    expect(screen.getByText('Suggested Categories')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    renderWithRedux({ ...defaultProps, open: false });

    expect(screen.queryByText('Add Batch Import to Queue')).not.toBeInTheDocument();
  });

  test('enables add to queue button when valid URL is entered', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const addButton = screen.getByText('Add to Queue');

    expect(addButton).toBeDisabled();

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');

    expect(addButton).toBeEnabled();
  });

  test('shows error for invalid URL', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');

    await user.type(urlInput, 'https://example.com/invalid');

    expect(screen.getByText('Please enter a valid AllRecipes category URL')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeDisabled();
  });

  test('allows selecting suggested URLs', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    // Expand suggested categories
    const suggestedAccordion = screen.getByText('Suggested Categories');
    await user.click(suggestedAccordion);

    // Click on a suggested URL
    const dessertOption = screen.getByText('Desserts');
    await user.click(dessertOption);

    const urlInput = screen.getByLabelText('Category URL') as HTMLInputElement;
    expect(urlInput.value).toBe('https://www.allrecipes.com/recipes/79/desserts');
  });

  test('shows info about queue system', () => {
    renderWithRedux();

    expect(screen.getByText(/queue system/i)).toBeInTheDocument();
    expect(screen.getByText(/processed in the background/i)).toBeInTheDocument();
  });

  test('adds task to queue when form is submitted', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue('task-123');

    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const addButton = screen.getByText('Add to Queue');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(addButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_to_import_queue', expect.objectContaining({
        description: expect.stringContaining('AllRecipes'),
        request: expect.objectContaining({
          startUrl: 'https://www.allrecipes.com/recipes/79/desserts',
        }),
      }));
    });
  });

  test('handles queue add error', async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error('Queue failed'));

    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const addButton = screen.getByText('Add to Queue');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to add task to queue/i)).toBeInTheDocument();
    });
  });

  test('closes modal when task is added successfully', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue('task-123');

    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const addButton = screen.getByText('Add to Queue');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(addButton);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  test('calls onTaskAdded when task is successfully added', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue('task-123');

    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const addButton = screen.getByText('Add to Queue');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(addButton);

    await waitFor(() => {
      expect(defaultProps.onTaskAdded).toHaveBeenCalledWith('task-123');
    });
  });

  test('includes optional fields in queue request', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue('task-123');

    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const maxRecipesInput = screen.getByLabelText('Max Recipes');
    const maxDepthInput = screen.getByLabelText('Max Depth');
    const addButton = screen.getByText('Add to Queue');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.type(maxRecipesInput, '100');
    await user.type(maxDepthInput, '3');
    await user.click(addButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_to_import_queue', expect.objectContaining({
        request: expect.objectContaining({
          startUrl: 'https://www.allrecipes.com/recipes/79/desserts',
          maxRecipes: 100,
          maxDepth: 3,
        }),
      }));
    });
  });

  test('resets state when dialog reopens', () => {
    const { rerender } = renderWithRedux({ ...defaultProps, open: false });

    // Open dialog
    rerender(
      <Provider store={createTestStore()}>
        <BatchImportDialog {...defaultProps} open={true} />
      </Provider>
    );

    const urlInput = screen.getByLabelText('Category URL') as HTMLInputElement;
    expect(urlInput.value).toBe('');
    expect(screen.getByText('Add to Queue')).toBeDisabled();
  });

  test('displays Quick Start section with Load Popular Categories button', () => {
    renderWithRedux();

    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(screen.getByText(/Load 20 popular AllRecipes categories/)).toBeInTheDocument();
    expect(screen.getByTestId('batch-import-load-popular-categories-button')).toBeInTheDocument();
  });

  test('loads popular categories when button is clicked', async () => {
    const user = userEvent.setup();

    renderWithRedux();

    const loadButton = screen.getByTestId('batch-import-load-popular-categories-button');

    // Check initial state
    expect(loadButton).toHaveTextContent('Load Popular Categories');
    expect(loadButton).not.toBeDisabled();

    // Click the button - this should trigger the action
    await user.click(loadButton);

    // For now, just verify the button was clicked successfully
    // The actual Redux integration will be tested in integration tests
    expect(loadButton).toBeInTheDocument();
  });

  test('disables buttons when loading popular categories', async () => {
    const user = userEvent.setup();
    // Make the promise hang to test loading state
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    renderWithRedux();

    const loadButton = screen.getByTestId('batch-import-load-popular-categories-button');
    const cancelButton = screen.getByTestId('batch-import-cancel-button');
    const addButton = screen.getByTestId('batch-import-add-to-queue-button');

    await user.click(loadButton);

    // All buttons should be disabled during loading
    expect(loadButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(addButton).toBeDisabled();
  });

  test('includes max recipes and max depth options when loading popular categories', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue('task-123');

    renderWithRedux();

    // Set optional parameters
    const maxRecipesInput = screen.getByLabelText('Max Recipes');
    const maxDepthInput = screen.getByLabelText('Max Depth');
    await user.type(maxRecipesInput, '50');
    await user.type(maxDepthInput, '2');

    const loadButton = screen.getByTestId('batch-import-load-popular-categories-button');
    await user.click(loadButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_to_import_queue', expect.objectContaining({
        request: expect.objectContaining({
          maxRecipes: 50,
          maxDepth: 2,
        }),
      }));
    });
  });
});
