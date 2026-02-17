import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import QueueStatusButton from './QueueStatusButton';
import importQueueReducer, { ImportQueueState } from '@store/slices/importQueueSlice';
import { ImportQueueTaskStatus } from '@app-types';

// Create a mock store factory
const createMockStore = (initialState: Partial<ImportQueueState> = {}) => {
  const defaultState: ImportQueueState = {
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
  };

  return configureStore({
    reducer: {
      importQueue: () => defaultState,
    },
  });
};

const meta: Meta<typeof QueueStatusButton> = {
  title: 'Buttons/QueueStatusButton',
  component: QueueStatusButton,
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
    onClick: { action: 'queueButtonClicked' },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// IdleEmpty: No tasks
export const IdleEmpty: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [],
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
};

// ProcessingOne: One task running
export const ProcessingOne: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          {
            id: 'task-1',
            description: 'Importing AllRecipes category',
            request: { categoryUrl: 'https://allrecipes.com/recipes/123/' },
            status: ImportQueueTaskStatus.RUNNING,
            addedAt: '2024-01-15T10:30:00.000Z',
            startedAt: '2024-01-15T10:31:00.000Z',
          },
        ],
        currentTaskId: 'task-1',
        isProcessing: true,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
};

// ProcessingWithPending: One running, multiple pending (test badge count)
export const ProcessingWithPending: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          {
            id: 'task-1',
            description: 'Importing AllRecipes category',
            request: { categoryUrl: 'https://allrecipes.com/recipes/123/' },
            status: ImportQueueTaskStatus.RUNNING,
            addedAt: '2024-01-15T10:30:00.000Z',
            startedAt: '2024-01-15T10:31:00.000Z',
          },
          {
            id: 'task-2',
            description: 'Importing another category',
            request: { categoryUrl: 'https://allrecipes.com/recipes/456/' },
            status: ImportQueueTaskStatus.PENDING,
            addedAt: '2024-01-15T10:32:00.000Z',
          },
          {
            id: 'task-3',
            description: 'Importing third category',
            request: { categoryUrl: 'https://allrecipes.com/recipes/789/' },
            status: ImportQueueTaskStatus.PENDING,
            addedAt: '2024-01-15T10:33:00.000Z',
          },
        ],
        currentTaskId: 'task-1',
        isProcessing: true,
        totalPending: 2,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
};

// CompletedWithPending: Some completed, some pending
export const CompletedWithPending: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          {
            id: 'task-1',
            description: 'Completed import',
            request: { categoryUrl: 'https://allrecipes.com/recipes/123/' },
            status: ImportQueueTaskStatus.COMPLETED,
            addedAt: '2024-01-15T10:30:00.000Z',
            startedAt: '2024-01-15T10:31:00.000Z',
            completedAt: '2024-01-15T10:35:00.000Z',
          },
          {
            id: 'task-2',
            description: 'Pending import',
            request: { categoryUrl: 'https://allrecipes.com/recipes/456/' },
            status: ImportQueueTaskStatus.PENDING,
            addedAt: '2024-01-15T10:32:00.000Z',
          },
        ],
        isProcessing: false,
        totalPending: 1,
        totalCompleted: 1,
        totalFailed: 0,
      }),
    },
  },
};

// WithError: Task failed
export const WithError: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          {
            id: 'task-1',
            description: 'Failed import',
            request: { categoryUrl: 'https://allrecipes.com/recipes/123/' },
            status: ImportQueueTaskStatus.FAILED,
            addedAt: '2024-01-15T10:30:00.000Z',
            startedAt: '2024-01-15T10:31:00.000Z',
            completedAt: '2024-01-15T10:32:00.000Z',
            error: 'Network error: Failed to fetch category page',
          },
        ],
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 1,
      }),
    },
  },
};

// LoadingState: queueState.loading = true
export const LoadingState: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [],
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
        loading: true,
      }),
    },
  },
};

// AllCompleted: All tasks completed successfully
export const AllCompleted: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [
          {
            id: 'task-1',
            description: 'Completed import 1',
            request: { categoryUrl: 'https://allrecipes.com/recipes/123/' },
            status: ImportQueueTaskStatus.COMPLETED,
            addedAt: '2024-01-15T10:30:00.000Z',
            startedAt: '2024-01-15T10:31:00.000Z',
            completedAt: '2024-01-15T10:35:00.000Z',
          },
          {
            id: 'task-2',
            description: 'Completed import 2',
            request: { categoryUrl: 'https://allrecipes.com/recipes/456/' },
            status: ImportQueueTaskStatus.COMPLETED,
            addedAt: '2024-01-15T10:32:00.000Z',
            startedAt: '2024-01-15T10:36:00.000Z',
            completedAt: '2024-01-15T10:40:00.000Z',
          },
        ],
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 2,
        totalFailed: 0,
      }),
    },
  },
};

// Interaction Test: Click button, verify onClick is called
export const InteractionTest: Story = {
  parameters: {
    redux: {
      store: createMockStore({
        tasks: [],
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Find and click the queue status button
    const queueButton = canvas.getByTestId('queue-status-button');
    await userEvent.click(queueButton);
    
    // Verify onClick was called
    await expect(args.onClick).toHaveBeenCalled();
  },
};
