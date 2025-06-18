import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import QueueManagementPopup from '../QueueManagementPopup';
import importQueueReducer from '@store/slices/importQueueSlice';
import { ImportQueueTaskStatus } from '@app-types';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock the importQueueService
vi.mock('@services/importQueue', () => ({
  importQueueService: {
    getEstimatedTimeRemaining: vi.fn(),
    canRemoveTask: vi.fn(),
    getStatusDisplayText: vi.fn(),
    getCategoryProgress: vi.fn(),
    getRecipeProgress: vi.fn(),
    getCurrentPhaseDescription: vi.fn(),
    getProgressPercentage: vi.fn(),
  },
}));

// Import the mocked service
import { importQueueService } from '@services/importQueue';
const mockImportQueueService = vi.mocked(importQueueService);

const createMockStore = (initialState: any = {}) => {
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
        isMonitoring: false,
        ...initialState,
      },
    },
  });
};

const mockTask = {
  id: 'test-task-1',
  description: 'Test AllRecipes Import',
  request: {
    startUrl: 'https://www.allrecipes.com/recipes/main-dish/',
    maxRecipes: 50,
  },
  status: ImportQueueTaskStatus.RUNNING,
  progress: {
    status: 'importingRecipes' as any,
    currentUrl: 'https://www.allrecipes.com/recipe/123/test-recipe/',
    processedRecipes: 15,
    totalRecipes: 50,
    processedCategories: 3,
    totalCategories: 5,
    successfulImports: 12,
    failedImports: 3,
    skippedRecipes: 0,
    errors: [],
    startTime: '2023-01-01T00:00:00Z',
    estimatedTimeRemaining: 300,
  },
  addedAt: '2023-01-01T00:00:00Z',
  startedAt: '2023-01-01T00:01:00Z',
};

describe('QueueManagementPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockImportQueueService.getEstimatedTimeRemaining.mockReturnValue('5 minutes');
    mockImportQueueService.canRemoveTask.mockReturnValue(true);
    mockImportQueueService.getStatusDisplayText.mockReturnValue('Importing recipes (15/50)');
    mockImportQueueService.getProgressPercentage.mockReturnValue(30);
    mockImportQueueService.getCategoryProgress.mockReturnValue({
      current: 3,
      total: 5,
      percentage: 60,
      isActive: false,
    });
    mockImportQueueService.getRecipeProgress.mockReturnValue({
      current: 15,
      total: 50,
      percentage: 30,
      isActive: true,
    });
    mockImportQueueService.getCurrentPhaseDescription.mockReturnValue('Importing individual recipes...');
  });

  test('renders empty queue message when no tasks', () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByTestId('empty-queue-message')).toBeInTheDocument();
    expect(screen.getByText('No import tasks in queue')).toBeInTheDocument();
  });

  test('displays running task with detailed progress bars', () => {
    const store = createMockStore({
      tasks: [mockTask],
      currentTaskId: mockTask.id,
      isProcessing: true,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    // Check that current task section is displayed
    expect(screen.getByTestId('current-task-section')).toBeInTheDocument();
    expect(screen.getByTestId(`queue-task-item-${mockTask.id}`)).toBeInTheDocument();

    // Check that progress bars are displayed
    expect(screen.getByTestId(`category-progress-bar-${mockTask.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`recipe-progress-bar-${mockTask.id}`)).toBeInTheDocument();

    // Check progress text
    expect(screen.getByText('Scraping categories')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Importing recipes')).toBeInTheDocument();
    expect(screen.getByText('15/50')).toBeInTheDocument();

    // Check phase description
    expect(screen.getByText('Importing individual recipes...')).toBeInTheDocument();
  });

  test('shows category progress as active during category scraping phase', () => {
    const categoryScrapingTask = {
      ...mockTask,
      progress: {
        ...mockTask.progress,
        status: 'crawlingCategories' as any,
        processedCategories: 2,
        totalCategories: 5,
      },
    };

    mockImportQueueService.getCategoryProgress.mockReturnValue({
      current: 2,
      total: 5,
      percentage: 40,
      isActive: true,
    });
    mockImportQueueService.getRecipeProgress.mockReturnValue({
      current: 0,
      total: 0,
      percentage: 0,
      isActive: false,
    });
    mockImportQueueService.getCurrentPhaseDescription.mockReturnValue('Discovering recipe categories...');

    const store = createMockStore({
      tasks: [categoryScrapingTask],
      currentTaskId: categoryScrapingTask.id,
      isProcessing: true,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByText('Discovering recipe categories...')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  test('handles task removal', async () => {
    const removableTask = {
      ...mockTask,
      status: ImportQueueTaskStatus.PENDING, // Pending tasks can be removed
    };

    mockImportQueueService.canRemoveTask.mockReturnValue(true);

    const store = createMockStore({
      tasks: [removableTask],
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    const removeButton = screen.getByTestId(`remove-task-button-${removableTask.id}`);
    fireEvent.click(removeButton);

    // Note: In a real test, you'd want to mock the dispatch and verify the action was called
    // This is a basic test to ensure the button is clickable
    expect(removeButton).toBeInTheDocument();
  });

  test('displays queue summary correctly', () => {
    const completedTask = {
      ...mockTask,
      id: 'completed-task',
      status: ImportQueueTaskStatus.COMPLETED,
    };

    const store = createMockStore({
      tasks: [mockTask, completedTask],
      currentTaskId: mockTask.id,
      isProcessing: true,
      totalPending: 0,
      totalCompleted: 1,
      totalFailed: 0,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByTestId('queue-summary')).toBeInTheDocument();
    expect(screen.getByText('0 Pending')).toBeInTheDocument();
    expect(screen.getByText('1 Running')).toBeInTheDocument();
    expect(screen.getByText('1 Completed')).toBeInTheDocument();
  });

  test('closes popup when close button is clicked', () => {
    const onClose = vi.fn();
    const store = createMockStore();

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={onClose} />
      </Provider>
    );

    const closeButton = screen.getByTestId('queue-popup-close-button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  test('displays overall progress percentage', () => {
    const store = createMockStore({
      tasks: [mockTask],
      currentTaskId: mockTask.id,
      isProcessing: true,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByText('Overall: 30% complete')).toBeInTheDocument();
  });

  test('handles tasks without progress data gracefully', () => {
    const taskWithoutProgress = {
      ...mockTask,
      progress: undefined,
    };

    mockImportQueueService.getCategoryProgress.mockReturnValue({
      current: 0,
      total: 0,
      percentage: 0,
      isActive: false,
    });
    mockImportQueueService.getRecipeProgress.mockReturnValue({
      current: 0,
      total: 0,
      percentage: 0,
      isActive: false,
    });
    mockImportQueueService.getCurrentPhaseDescription.mockReturnValue('');
    mockImportQueueService.getProgressPercentage.mockReturnValue(0);

    const store = createMockStore({
      tasks: [taskWithoutProgress],
      currentTaskId: taskWithoutProgress.id,
      isProcessing: true,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    // Should render without crashing
    expect(screen.getByTestId(`queue-task-item-${taskWithoutProgress.id}`)).toBeInTheDocument();
  });

  test('shows general progress bar when no specific progress is available', () => {
    const taskWithMinimalProgress = {
      ...mockTask,
      progress: {
        status: 'unknown' as any,
        currentUrl: undefined,
        processedRecipes: 0,
        totalRecipes: 0,
        processedCategories: 0,
        totalCategories: 0,
        successfulImports: 0,
        failedImports: 0,
        skippedRecipes: 0,
        errors: [],
        startTime: '2023-01-01T00:00:00Z',
      },
    };

    mockImportQueueService.getCategoryProgress.mockReturnValue({
      current: 0,
      total: 0,
      percentage: 0,
      isActive: false,
    });
    mockImportQueueService.getRecipeProgress.mockReturnValue({
      current: 0,
      total: 0,
      percentage: 0,
      isActive: false,
    });
    mockImportQueueService.getCurrentPhaseDescription.mockReturnValue('');
    mockImportQueueService.getProgressPercentage.mockReturnValue(0);

    const store = createMockStore({
      tasks: [taskWithMinimalProgress],
      currentTaskId: taskWithMinimalProgress.id,
      isProcessing: true,
    });

    render(
      <Provider store={store}>
        <QueueManagementPopup open={true} onClose={vi.fn()} />
      </Provider>
    );

    // Should show general progress bar when no specific progress is available
    expect(screen.getByTestId(`general-progress-bar-${taskWithMinimalProgress.id}`)).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});
