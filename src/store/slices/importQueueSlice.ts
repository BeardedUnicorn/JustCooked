import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  ImportQueueTask,
  ImportQueueStatus,
  ImportQueueTaskStatus,
  BatchImportRequest
} from '@app-types';
import { importQueueService } from '@services/importQueue';

export interface ImportQueueState {
  tasks: ImportQueueTask[];
  currentTaskId?: string;
  isProcessing: boolean;
  totalPending: number;
  totalCompleted: number;
  totalFailed: number;
  loading: boolean;
  error: string | null;
  isMonitoring: boolean;
}

const initialState: ImportQueueState = {
  tasks: [],
  currentTaskId: undefined,
  isProcessing: false,
  totalPending: 0,
  totalCompleted: 0,
  totalFailed: 0,
  loading: false,
  error: null,
  isMonitoring: false,
};

// Async thunks
export const addToQueue = createAsyncThunk(
  'importQueue/addToQueue',
  async ({ description, request }: { description: string; request: BatchImportRequest }, { rejectWithValue }) => {
    try {
      const taskId = await importQueueService.addToQueue(description, request);
      return taskId;
    } catch (error) {
      console.error('Failed to add task to queue:', error);
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

export const addMultipleToQueue = createAsyncThunk(
  'importQueue/addMultipleToQueue',
  async ({
    urls,
    options
  }: {
    urls: string[];
    options?: { maxRecipes?: number; maxDepth?: number }
  }, { rejectWithValue }) => {
    try {
      const result = await importQueueService.addMultipleToQueue(urls, options);
      return result;
    } catch (error) {
      console.error('Failed to add multiple tasks to queue:', error);
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

export const getQueueStatus = createAsyncThunk(
  'importQueue/getQueueStatus',
  async (_, { rejectWithValue }) => {
    try {
      const status = await importQueueService.getQueueStatus();
      return status;
    } catch (error) {
      console.error('Failed to get queue status:', error);
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

export const removeFromQueue = createAsyncThunk(
  'importQueue/removeFromQueue',
  async (taskId: string) => {
    await importQueueService.removeFromQueue(taskId);
    return taskId;
  }
);

export const startMonitoring = createAsyncThunk(
  'importQueue/startMonitoring',
  async (_, { dispatch }) => {
    importQueueService.startStatusMonitoring((status: ImportQueueStatus) => {
      dispatch(updateQueueStatus(status));
    });
    return true;
  }
);

export const stopMonitoring = createAsyncThunk(
  'importQueue/stopMonitoring',
  async () => {
    importQueueService.stopStatusMonitoring();
    return true;
  }
);

const importQueueSlice = createSlice({
  name: 'importQueue',
  initialState,
  reducers: {
    updateQueueStatus: (state, action: PayloadAction<ImportQueueStatus>) => {
      const status = action.payload;
      if (status) {
        state.tasks = status.tasks || [];
        state.currentTaskId = status.currentTaskId;
        state.isProcessing = status.isProcessing || false;
        state.totalPending = status.totalPending || 0;
        state.totalCompleted = status.totalCompleted || 0;
        state.totalFailed = status.totalFailed || 0;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    resetQueue: (state) => {
      state.tasks = [];
      state.currentTaskId = undefined;
      state.isProcessing = false;
      state.totalPending = 0;
      state.totalCompleted = 0;
      state.totalFailed = 0;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Add to queue
      .addCase(addToQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToQueue.fulfilled, (state) => {
        state.loading = false;
        // The actual task will be updated via monitoring
      })
      .addCase(addToQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add task to queue';
      })

      // Add multiple to queue
      .addCase(addMultipleToQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addMultipleToQueue.fulfilled, (state) => {
        state.loading = false;
        // The actual tasks will be updated via monitoring
      })
      .addCase(addMultipleToQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add multiple tasks to queue';
      })

      // Get queue status
      .addCase(getQueueStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getQueueStatus.fulfilled, (state, action) => {
        state.loading = false;
        const status = action.payload;
        state.tasks = status.tasks;
        state.currentTaskId = status.currentTaskId;
        state.isProcessing = status.isProcessing;
        state.totalPending = status.totalPending;
        state.totalCompleted = status.totalCompleted;
        state.totalFailed = status.totalFailed;
      })
      .addCase(getQueueStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get queue status';
      })
      
      // Remove from queue
      .addCase(removeFromQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromQueue.fulfilled, (state) => {
        state.loading = false;
        // The actual task removal will be updated via monitoring
      })
      .addCase(removeFromQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove task from queue';
      })
      
      // Start monitoring
      .addCase(startMonitoring.fulfilled, (state) => {
        state.isMonitoring = true;
      })
      .addCase(startMonitoring.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to start monitoring';
      })
      
      // Stop monitoring
      .addCase(stopMonitoring.fulfilled, (state) => {
        state.isMonitoring = false;
      });
  },
});

export const { updateQueueStatus, clearError, resetQueue } = importQueueSlice.actions;

// Selectors
export const selectImportQueue = (state: { importQueue: ImportQueueState }) => state.importQueue;
export const selectQueueTasks = (state: { importQueue: ImportQueueState }) => state.importQueue.tasks;
export const selectCurrentTask = (state: { importQueue: ImportQueueState }) => {
  const { tasks, currentTaskId } = state.importQueue;
  return currentTaskId ? tasks.find(task => task.id === currentTaskId) : null;
};
export const selectPendingTasks = (state: { importQueue: ImportQueueState }) => 
  state.importQueue.tasks.filter(task => task.status === ImportQueueTaskStatus.PENDING);
export const selectRunningTasks = (state: { importQueue: ImportQueueState }) => 
  state.importQueue.tasks.filter(task => task.status === ImportQueueTaskStatus.RUNNING);
export const selectCompletedTasks = (state: { importQueue: ImportQueueState }) => 
  state.importQueue.tasks.filter(task => 
    task.status === ImportQueueTaskStatus.COMPLETED || 
    task.status === ImportQueueTaskStatus.FAILED || 
    task.status === ImportQueueTaskStatus.CANCELLED
  );
export const selectIsQueueActive = (state: { importQueue: ImportQueueState }) => 
  state.importQueue.isProcessing || state.importQueue.totalPending > 0;
export const selectQueueSummary = (state: { importQueue: ImportQueueState }) => ({
  totalTasks: state.importQueue.tasks.length,
  pending: state.importQueue.totalPending,
  completed: state.importQueue.totalCompleted,
  failed: state.importQueue.totalFailed,
  isProcessing: state.importQueue.isProcessing,
});

export default importQueueSlice.reducer;
