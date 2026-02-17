import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import QueueManagementPopup from './QueueManagementPopup';
import importQueueReducer from '@store/slices/importQueueSlice';
import { ImportQueueTaskStatus, ImportQueueTask } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetEstimatedTimeRemainingImplementation = fn().mockReturnValue('5 minutes');
let mockCanRemoveTaskImplementation = fn().mockReturnValue(true);
let mockGetStatusDisplayTextImplementation = fn().mockReturnValue('Importing recipes (15/50)');
let mockGetCategoryProgressImplementation = fn();
let mockGetRecipeProgressImplementation = fn();
let mockGetCurrentPhaseDescriptionImplementation = fn().mockReturnValue('Importing individual recipes...');
let mockGetProgressPercentageImplementation = fn().mockReturnValue(30);

// Mock the importQueueService for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    importQueueService: {
      getEstimatedTimeRemaining: mockGetEstimatedTimeRemainingImplementation,
      canRemoveTask: mockCanRemoveTaskImplementation,
      getStatusDisplayText: mockGetStatusDisplayTextImplementation,
      getCategoryProgress: mockGetCategoryProgressImplementation,
      getRecipeProgress: mockGetRecipeProgressImplementation,
      getCurrentPhaseDescription: mockGetCurrentPhaseDescriptionImplementation,
      getProgressPercentage: mockGetProgressPercentageImplementation,
    },
  };
}

// Mock task data
const createMockTask = (overrides: Partial<ImportQueueTask> = {}): ImportQueueTask => ({
  id: 'test-task-1',
  description: 'Test AllRecipes Import',
  request: {
    startUrl: 'https://www.allrecipes.com/recipes/main-dish/',
    maxRecipes: 50,
  },
  status: ImportQueueTaskStatus.PENDING,
  addedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const runningTask = createMockTask({
  id: 'running-task',
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
  startedAt: '2023-01-01T00:01:00Z',
});

const completedTask = createMockTask({
  id: 'completed-task',
  status: ImportQueueTaskStatus.COMPLETED,
  progress: {
    status: 'completed' as any,
    processedRecipes: 50,
    totalRecipes: 50,
    processedCategories: 5,
    totalCategories: 5,
    successfulImports: 45,
    failedImports: 5,
    skippedRecipes: 0,
    errors: [],
    startTime: '2023-01-01T00:00:00Z',
  },
  startedAt: '2023-01-01T00:01:00Z',
  completedAt: '2023-01-01T00:15:00Z',
});

const failedTask = createMockTask({
  id: 'failed-task',
  status: ImportQueueTaskStatus.FAILED,
  error: 'Network connection failed',
  startedAt: '2023-01-01T00:01:00Z',
  completedAt: '2023-01-01T00:02:00Z',
});

// Redux store creator
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

// Browser-compatible mock configuration function
const setupDefaultMocks = () => {
  mockGetEstimatedTimeRemainingImplementation = fn().mockReturnValue('5 minutes');
  mockCanRemoveTaskImplementation = fn().mockReturnValue(true);
  mockGetStatusDisplayTextImplementation = fn().mockReturnValue('Importing recipes (15/50)');
  mockGetProgressPercentageImplementation = fn().mockReturnValue(30);
  mockGetCategoryProgressImplementation = fn().mockReturnValue({
    current: 3,
    total: 5,
    percentage: 60,
    isActive: false,
  });
  mockGetRecipeProgressImplementation = fn().mockReturnValue({
    current: 15,
    total: 50,
    percentage: 30,
    isActive: true,
  });
  mockGetCurrentPhaseDescriptionImplementation = fn().mockReturnValue('Importing individual recipes...');

  // Update service mocks
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      importQueueService: {
        getEstimatedTimeRemaining: mockGetEstimatedTimeRemainingImplementation,
        canRemoveTask: mockCanRemoveTaskImplementation,
        getStatusDisplayText: mockGetStatusDisplayTextImplementation,
        getCategoryProgress: mockGetCategoryProgressImplementation,
        getRecipeProgress: mockGetRecipeProgressImplementation,
        getCurrentPhaseDescription: mockGetCurrentPhaseDescriptionImplementation,
        getProgressPercentage: mockGetProgressPercentageImplementation,
      },
    };
  }
};

const meta: Meta<typeof QueueManagementPopup> = {
  title: 'Modals/QueueManagementPopup',
  component: QueueManagementPopup,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    onClose: { action: 'closed' },
  },
  args: {
    onClose: fn(),
  },
  decorators: [
    (Story, context) => {
      setupDefaultMocks();
      const store = context.parameters.redux?.store || createMockStore();
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyQueue: Story = {
  args: {
    open: true,
    onClose: fn(),
  },
  parameters: {
    redux: {
      store: createMockStore(),
    },
  },
};

export const SingleTaskRunning: Story = {
  args: {
    open: true,
    onClose: fn(),
  },
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [runningTask],
        currentTaskId: runningTask.id,
        isProcessing: true,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
};

export const MultipleTasks: Story = {
  args: {
    open: true,
    onClose: fn(),
  },
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          createMockTask({ id: 'pending-1', status: ImportQueueTaskStatus.PENDING }),
          createMockTask({ id: 'pending-2', status: ImportQueueTaskStatus.PENDING }),
          runningTask,
          completedTask,
        ],
        currentTaskId: runningTask.id,
        isProcessing: true,
        totalPending: 2,
        totalCompleted: 1,
        totalFailed: 0,
      }),
    },
  },
};

export const TaskWithError: Story = {
  args: {
    open: true,
    onClose: fn(),
  },
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [failedTask, completedTask],
        currentTaskId: undefined,
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 1,
        totalFailed: 1,
      }),
    },
  },
  beforeEach: () => {
    mockGetStatusDisplayTextImplementation = fn().mockImplementation((task) => {
      if (task.status === ImportQueueTaskStatus.FAILED) {
        return task.error || 'Failed';
      }
      return 'Completed: 45 imported, 5 failed';
    });
    mockCanRemoveTaskImplementation = fn().mockImplementation((task) => {
      return task.status === ImportQueueTaskStatus.FAILED;
    });

    // Update service mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        importQueueService: {
          getEstimatedTimeRemaining: mockGetEstimatedTimeRemainingImplementation,
          canRemoveTask: mockCanRemoveTaskImplementation,
          getStatusDisplayText: mockGetStatusDisplayTextImplementation,
          getCategoryProgress: mockGetCategoryProgressImplementation,
          getRecipeProgress: mockGetRecipeProgressImplementation,
          getCurrentPhaseDescription: mockGetCurrentPhaseDescriptionImplementation,
          getProgressPercentage: mockGetProgressPercentageImplementation,
        },
      };
    }
  },
};

// Interaction tests
export const InteractionTests: Story = {
  args: {
    open: true,
    onClose: fn(),
  },
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [runningTask, createMockTask({ id: 'pending-task', status: ImportQueueTaskStatus.PENDING })],
        currentTaskId: runningTask.id,
        isProcessing: true,
        totalPending: 1,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Test closing the popup
    const closeButton = canvas.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);
    await expect(args.onClose).toHaveBeenCalled();
    
    // Test remove button on a task (if visible)
    const removeButtons = canvas.queryAllByTestId(/remove-task-/);
    if (removeButtons.length > 0) {
      await userEvent.click(removeButtons[0]);
      // Note: In a real test, we'd verify the Redux action was dispatched
    }
  },
};
