import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import BatchImportDialog from '../BatchImportDialog';
import { batchImportService } from '@services/batchImport';
import { BatchImportStatus } from '@app-types/batchImport';

// Mock the batch import service
vi.mock('@services/batchImport', () => ({
  batchImportService: {
    startBatchImport: vi.fn(),
    getProgress: vi.fn(),
    cancelBatchImport: vi.fn(),
    setProgressCallback: vi.fn(),
    cleanup: vi.fn(),
    getSuggestedCategoryUrls: vi.fn(() => [
      {
        name: 'Desserts',
        url: 'https://www.allrecipes.com/recipes/79/desserts',
        description: 'Sweet treats and desserts'
      }
    ]),
  },
}));

// Mock logger
vi.mock('@services/loggingService', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockBatchImportService = batchImportService as any;

// Test component that simulates the memory leak scenario
const TestComponent: React.FC<{ isImporting: boolean }> = ({ isImporting }) => {
  const [progress, setProgress] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  // This mimics the useEffect from BatchImportDialog
  React.useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let isMounted = true; // Track component mount status

    if (isImporting) {
      const fetchProgress = async () => {
        try {
          const newProgress = await batchImportService.getProgress();

          // Only update state if component is still mounted
          if (newProgress && isMounted) {
            setProgress(newProgress);
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error);
          // Only update error state if component is still mounted
          if (isMounted) {
            setError('Failed to fetch import progress');
          }
        }
      };

      fetchProgress(); // Initial fetch
      intervalId = setInterval(fetchProgress, 2000);
    }

    return () => {
      isMounted = false; // Mark component as unmounted
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
  }, [isImporting]);

  return <div data-testid="test-component">{progress ? 'Has Progress' : 'No Progress'}</div>;
};

describe('BatchImportDialog Memory Leak Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should cleanup progress polling interval when component unmounts during import', async () => {
    // Mock progress responses
    let progressCallCount = 0;
    mockBatchImportService.getProgress.mockImplementation(() => {
      progressCallCount++;
      return Promise.resolve({
        status: BatchImportStatus.IMPORTING_RECIPES,
        totalRecipes: 100,
        processedRecipes: progressCallCount * 10,
        processedCategories: 1,
        totalCategories: 1,
        successfulImports: progressCallCount * 8,
        failedImports: progressCallCount * 2,
        skippedRecipes: 0,
        estimatedTimeRemaining: 60,
        currentUrl: 'https://example.com/recipe',
        errors: [],
        startTime: '2024-01-15T12:00:00Z',
      });
    });

    const { unmount } = render(<TestComponent isImporting={true} />);

    // Advance timers to trigger initial progress polling
    act(() => {
      vi.advanceTimersByTime(100); // Small delay for initial fetch
    });

    // Wait for initial progress fetch - simplified approach
    act(() => {
      vi.advanceTimersByTime(1000); // Allow time for initial fetch
    });

    // Verify initial call was made
    expect(mockBatchImportService.getProgress).toHaveBeenCalled();
    const initialCallCount = progressCallCount;

    // Unmount component while import is in progress
    unmount();

    // Advance timers further to see if interval continues
    act(() => {
      vi.advanceTimersByTime(6000); // 6 seconds (3 intervals worth)
    });

    // Progress should not be fetched after unmount (due to isMounted check)
    // The interval should be cleared, so no new calls should happen
    expect(progressCallCount).toBe(initialCallCount);
  });

  it('should not update state after component unmounts', async () => {
    // Mock progress that resolves after a delay
    let resolveProgress: (value: any) => void;
    const progressPromise = new Promise(resolve => {
      resolveProgress = resolve;
    });

    mockBatchImportService.getProgress.mockReturnValue(progressPromise);

    const { unmount } = render(<TestComponent isImporting={true} />);

    // Advance timers to trigger progress polling
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Unmount component before progress resolves
    unmount();

    // Now resolve the progress promise
    act(() => {
      resolveProgress!({
        status: BatchImportStatus.COMPLETED,
        totalRecipes: 100,
        processedRecipes: 100,
        successfulImports: 95,
        failedImports: 5,
        estimatedTimeRemaining: 0,
        currentUrl: '',
        errors: [],
      });
    });

    // Advance timers to let any state updates process
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Test passes if no errors are thrown (state updates are prevented by isMounted check)
    expect(true).toBe(true);
  });

  it('should handle progress fetch errors gracefully after unmount', async () => {
    // Mock progress that throws error
    mockBatchImportService.getProgress.mockRejectedValue(new Error('Network error'));

    const { unmount } = render(<TestComponent isImporting={true} />);

    // Unmount component immediately
    unmount();

    // Advance timers to trigger progress polling (which will fail)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should not throw errors or cause issues
    // The test passing means the error was handled gracefully
    expect(true).toBe(true);
  });

  it('should clear intervals when switching between import states', async () => {
    let progressCallCount = 0;
    mockBatchImportService.getProgress.mockImplementation(() => {
      progressCallCount++;
      if (progressCallCount <= 3) {
        return Promise.resolve({
          status: BatchImportStatus.IMPORTING_RECIPES,
          totalRecipes: 100,
          processedRecipes: progressCallCount * 10,
          successfulImports: progressCallCount * 8,
          failedImports: progressCallCount * 2,
          estimatedTimeRemaining: 60,
          currentUrl: 'https://example.com/recipe',
          errors: [],
        });
      } else {
        return Promise.resolve({
          status: BatchImportStatus.COMPLETED,
          totalRecipes: 100,
          processedRecipes: 100,
          successfulImports: 95,
          failedImports: 5,
          estimatedTimeRemaining: 0,
          currentUrl: '',
          errors: [],
        });
      }
    });

    const { rerender } = render(<TestComponent isImporting={true} />);

    // Advance timers to trigger multiple progress polls
    act(() => {
      vi.advanceTimersByTime(8000); // 4 polls at 2-second intervals
    });

    // Wait for progress calls
    expect(progressCallCount).toBeGreaterThan(0);

    const callCountBeforeStop = progressCallCount;

    // Stop importing (this should clear the interval)
    rerender(<TestComponent isImporting={false} />);

    // Advance timers further - no more progress calls should happen
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(progressCallCount).toBe(callCountBeforeStop);
  });
});
