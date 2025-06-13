import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import BatchImportDialog from '@components/BatchImportDialog';
import { batchImportService } from '@services/batchImport';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock the batch import service
jest.mock('@services/batchImport');
const mockBatchImportService = batchImportService as jest.Mocked<typeof batchImportService>;

// Mock recipe storage
jest.mock('@services/recipeStorage');
const mockGetExistingRecipeUrls = getExistingRecipeUrls as jest.MockedFunction<typeof getExistingRecipeUrls>;

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

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
    onClose: jest.fn(),
    onTaskAdded: jest.fn(),
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
    jest.clearAllMocks();
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
    mockGetExistingRecipeUrls.mockResolvedValue([]);

    // Set up default mock responses for Tauri commands
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
    const mockInvoke = require('@tauri-apps/api/core').invoke;
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
});
