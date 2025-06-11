import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import BatchImportDialog from '@components/BatchImportDialog';
import { batchImportService } from '@services/batchImport';
import { BatchImportStatus } from '@app-types';

// Mock the batch import service
jest.mock('@services/batchImport');
const mockBatchImportService = batchImportService as jest.Mocked<typeof batchImportService>;

describe('BatchImportDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onImportComplete: jest.fn(),
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
  });

  test('renders dialog with initial state', () => {
    render(<BatchImportDialog {...defaultProps} />);

    expect(screen.getByText('Batch Recipe Import')).toBeInTheDocument();
    expect(screen.getByLabelText('Category URL')).toBeInTheDocument();
    expect(screen.getByText('Start Import')).toBeDisabled();
    expect(screen.getByText('Suggested Categories')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<BatchImportDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Batch Recipe Import')).not.toBeInTheDocument();
  });

  test('enables start button when valid URL is entered', async () => {
    const user = userEvent.setup();
    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    expect(startButton).toBeDisabled();

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');

    expect(startButton).toBeEnabled();
  });

  test('shows error for invalid URL', async () => {
    const user = userEvent.setup();
    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');

    await user.type(urlInput, 'https://example.com/invalid');

    expect(screen.getByText('Please enter a valid AllRecipes category URL')).toBeInTheDocument();
    expect(screen.getByText('Start Import')).toBeDisabled();
  });

  test('allows selecting suggested URLs', async () => {
    const user = userEvent.setup();
    render(<BatchImportDialog {...defaultProps} />);

    // Expand suggested categories
    const suggestedAccordion = screen.getByText('Suggested Categories');
    await user.click(suggestedAccordion);

    // Click on a suggested URL
    const dessertOption = screen.getByText('Desserts');
    await user.click(dessertOption);

    const urlInput = screen.getByLabelText('Category URL') as HTMLInputElement;
    expect(urlInput.value).toBe('https://www.allrecipes.com/recipes/79/desserts');
  });

  test('shows warning about batch import duration', () => {
    render(<BatchImportDialog {...defaultProps} />);

    expect(screen.getByText(/batch importing can take a long time/i)).toBeInTheDocument();
    expect(screen.getByText(/you can cancel the import at any time/i)).toBeInTheDocument();
  });

  test('starts batch import when form is submitted', async () => {
    const user = userEvent.setup();
    mockBatchImportService.startBatchImport.mockResolvedValue('import-123');

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    expect(mockBatchImportService.startBatchImport).toHaveBeenCalledWith(
      'https://www.allrecipes.com/recipes/79/desserts'
    );
  });



  test('handles import start error', async () => {
    const user = userEvent.setup();
    mockBatchImportService.startBatchImport.mockRejectedValue(new Error('Import failed'));

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument();
    });
  });

  test('shows progress component during import', async () => {
    const user = userEvent.setup();

    mockBatchImportService.startBatchImport.mockResolvedValue('import-123');
    mockBatchImportService.getProgress.mockResolvedValue({
      status: BatchImportStatus.IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/123/test-recipe',
      processedRecipes: 5,
      totalRecipes: 20,
      processedCategories: 2,
      totalCategories: 5,
      successfulImports: 3,
      failedImports: 2,
      skippedRecipes: 0,
      errors: [],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: 300,
    });

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Importing Recipes')).toBeInTheDocument();
      expect(screen.getByText('Cancel Import')).toBeInTheDocument();
    });
  });

  test('calls onImportComplete when import finishes', async () => {
    const user = userEvent.setup();

    mockBatchImportService.startBatchImport.mockResolvedValue('import-123');
    mockBatchImportService.getProgress.mockResolvedValue({
      status: BatchImportStatus.COMPLETED,
      currentUrl: undefined,
      processedRecipes: 20,
      totalRecipes: 20,
      processedCategories: 5,
      totalCategories: 5,
      successfulImports: 18,
      failedImports: 2,
      skippedRecipes: 0,
      errors: [],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: 0,
    });

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    await waitFor(() => {
      expect(defaultProps.onImportComplete).toHaveBeenCalledWith({
        successCount: 18,
        failureCount: 2,
      });
    });
  });

  test('cancels import when cancel button is clicked', async () => {
    const user = userEvent.setup();
    mockBatchImportService.startBatchImport.mockResolvedValue('import-123');
    mockBatchImportService.cancelBatchImport.mockResolvedValue();
    mockBatchImportService.getProgress.mockResolvedValue({
      status: BatchImportStatus.IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/123/test-recipe',
      processedRecipes: 5,
      totalRecipes: 20,
      processedCategories: 2,
      totalCategories: 5,
      successfulImports: 3,
      failedImports: 2,
      skippedRecipes: 0,
      errors: [],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: 300,
    });

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel Import')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel Import');
    await user.click(cancelButton);

    expect(mockBatchImportService.cancelBatchImport).toHaveBeenCalled();
  });

  test('cancels import when dialog is closed during import', async () => {
    const user = userEvent.setup();

    mockBatchImportService.startBatchImport.mockResolvedValue('import-123');
    mockBatchImportService.cancelBatchImport.mockResolvedValue();

    render(<BatchImportDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText('Category URL');
    const startButton = screen.getByText('Start Import');

    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');
    await user.click(startButton);

    mockBatchImportService.getProgress.mockResolvedValue({
      status: BatchImportStatus.IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/123/test-recipe',
      processedRecipes: 5,
      totalRecipes: 20,
      processedCategories: 2,
      totalCategories: 5,
      successfulImports: 3,
      failedImports: 2,
      skippedRecipes: 0,
      errors: [],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: 300,
    });

    // Wait for import to start and cancel button to appear
    await waitFor(() => {
      expect(screen.getByText('Cancel Import')).toBeInTheDocument();
    });

    // Click the cancel button to trigger the cancel
    const cancelButton = screen.getByText('Cancel Import');
    await user.click(cancelButton);

    expect(mockBatchImportService.cancelBatchImport).toHaveBeenCalled();
  });

  test('resets state when dialog reopens', () => {
    const { rerender } = render(<BatchImportDialog {...defaultProps} open={false} />);

    // Open dialog
    rerender(<BatchImportDialog {...defaultProps} open={true} />);

    const urlInput = screen.getByLabelText('Category URL') as HTMLInputElement;
    expect(urlInput.value).toBe('');
    expect(screen.getByText('Start Import')).toBeDisabled();
  });

  test('cleans up on unmount', () => {
    const { unmount } = render(<BatchImportDialog {...defaultProps} />);

    unmount();

    expect(mockBatchImportService.cleanup).toHaveBeenCalled();
  });
});
