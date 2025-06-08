import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect } from '@jest/globals';
import BatchImportProgress from '@components/BatchImportProgress';
import { BatchImportProgress as BatchImportProgressType, BatchImportStatus } from '@app-types';

describe('BatchImportProgress', () => {
  const createMockProgress = (overrides: Partial<BatchImportProgressType> = {}): BatchImportProgressType => ({
    status: BatchImportStatus.IMPORTING_RECIPES,
    currentUrl: 'https://www.allrecipes.com/recipe/123/test-recipe',
    processedRecipes: 5,
    totalRecipes: 20,
    processedCategories: 2,
    totalCategories: 5,
    successfulImports: 4,
    failedImports: 1,
    skippedRecipes: 0,
    errors: [],
    startTime: '2024-01-01T10:00:00Z',
    estimatedTimeRemaining: 300,
    ...overrides,
  });

  test('shows loading when progress is null', () => {
    render(<BatchImportProgress progress={null} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays basic progress information', () => {
    const progress = createMockProgress();
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('Batch Import Status')).toBeInTheDocument();
    expect(screen.getByText('Importing Recipes')).toBeInTheDocument();
    expect(screen.getByText('Current: https://www.allrecipes.com/recipe/123/test-recipe')).toBeInTheDocument();
    expect(screen.getByText('5 / 20 recipes')).toBeInTheDocument();
    expect(screen.getByText('2 / 5 categories')).toBeInTheDocument();
  });

  test('displays statistics correctly', () => {
    const progress = createMockProgress({
      successfulImports: 15,
      failedImports: 3,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('Import Statistics')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // Successful
    expect(screen.getByText('3')).toBeInTheDocument(); // Failed
    expect(screen.getByText('Successful')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  test('shows different status indicators', () => {
    const statuses = [
      { status: BatchImportStatus.IDLE, label: 'Idle' },
      { status: BatchImportStatus.STARTING, label: 'Starting...' },
      { status: BatchImportStatus.CRAWLING_CATEGORIES, label: 'Finding Categories' },
      { status: BatchImportStatus.EXTRACTING_RECIPES, label: 'Extracting Recipes' },
      { status: BatchImportStatus.FILTERING_EXISTING, label: 'Filtering Existing' },
      { status: BatchImportStatus.IMPORTING_RECIPES, label: 'Importing Recipes' },
      { status: BatchImportStatus.COMPLETED, label: 'Completed' },
      { status: BatchImportStatus.CANCELLED, label: 'Cancelled' },
      { status: BatchImportStatus.ERROR, label: 'Error' },
    ];

    statuses.forEach(({ status, label }) => {
      const progress = createMockProgress({ status });
      const { unmount } = render(<BatchImportProgress progress={progress} />);

      expect(screen.getByText(label)).toBeInTheDocument();

      unmount();
    });
  });

  test('calculates progress percentages correctly', () => {
    const progress = createMockProgress({
      processedRecipes: 10,
      totalRecipes: 20, // 50% progress
      processedCategories: 3,
      totalCategories: 6, // 50% progress
    });
    render(<BatchImportProgress progress={progress} />);

    // Check that progress bars are rendered (we can't easily test the exact percentage)
    expect(screen.getByText('10 / 20 recipes')).toBeInTheDocument();
    expect(screen.getByText('3 / 6 categories')).toBeInTheDocument();
  });

  test('handles zero totals gracefully', () => {
    const progress = createMockProgress({
      processedRecipes: 0,
      totalRecipes: 0,
      processedCategories: 0,
      totalCategories: 0,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('0 / 0 recipes')).toBeInTheDocument();
    expect(screen.queryByText('Category Progress')).not.toBeInTheDocument();
  });

  test('hides category progress when total categories is 0', () => {
    const progress = createMockProgress({
      totalCategories: 0,
      processedCategories: 0,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.queryByText('Category Progress')).not.toBeInTheDocument();
  });

  test('displays errors when present', async () => {
    const user = userEvent.setup();
    const progress = createMockProgress({
      errors: [
        {
          url: 'https://www.allrecipes.com/recipe/123/failed-recipe',
          message: 'Failed to parse recipe',
          timestamp: '2024-01-01T10:05:00Z',
          errorType: 'ParseError',
        },
        {
          url: 'https://www.allrecipes.com/recipe/456/another-failed',
          message: 'Network timeout',
          timestamp: '2024-01-01T10:10:00Z',
          errorType: 'NetworkError',
        },
      ],
    });
    render(<BatchImportProgress progress={progress} />);

    // Errors should be in an accordion
    const errorsAccordion = screen.getByText('Errors (2)');
    expect(errorsAccordion).toBeInTheDocument();

    // Expand errors
    await user.click(errorsAccordion);

    expect(screen.getByText('Failed to parse recipe')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByText('URL: https://www.allrecipes.com/recipe/123/failed-recipe')).toBeInTheDocument();
    expect(screen.getByText(/Type: ParseError/)).toBeInTheDocument();
  });

  test('limits error display to 10 most recent', async () => {
    const user = userEvent.setup();
    const errors = Array.from({ length: 15 }, (_, i) => ({
      url: `https://www.allrecipes.com/recipe/${i}/test`,
      message: `Error ${i}`,
      timestamp: '2024-01-01T10:00:00Z',
      errorType: 'ParseError' as const,
    }));

    const progress = createMockProgress({ errors });
    render(<BatchImportProgress progress={progress} />);

    const errorsAccordion = screen.getByText('Errors (15)');
    await user.click(errorsAccordion);

    // Should show "... and 5 more errors"
    expect(screen.getByText('... and 5 more errors')).toBeInTheDocument();
  });

  test('shows completion message for completed status', () => {
    const progress = createMockProgress({
      status: BatchImportStatus.COMPLETED,
      successfulImports: 18,
      failedImports: 2,
      skippedRecipes: 5,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('Batch import completed successfully!')).toBeInTheDocument();
    expect(screen.getByText('Imported 18 recipes with 2 failures and 5 skipped.')).toBeInTheDocument();
  });

  test('shows cancellation message for cancelled status', () => {
    const progress = createMockProgress({
      status: BatchImportStatus.CANCELLED,
      successfulImports: 5,
      skippedRecipes: 3,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('Batch import was cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Imported 5 recipes before cancellation with 3 skipped.')).toBeInTheDocument();
  });

  test('shows error message for error status', () => {
    const progress = createMockProgress({
      status: BatchImportStatus.ERROR,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('Batch import encountered an error.')).toBeInTheDocument();
    expect(screen.getByText('Check the error details above for more information.')).toBeInTheDocument();
  });

  test('formats duration correctly', () => {
    // Mock current time to be 5 minutes and 30 seconds after start
    const startTime = '2024-01-01T10:00:00Z';
    const mockNow = new Date('2024-01-01T10:05:30Z');

    const OriginalDate = global.Date;
    global.Date = jest.fn((dateString?: string | number | Date) => {
      if (dateString) {
        return new OriginalDate(dateString);
      }
      return mockNow;
    }) as any;
    global.Date.now = jest.fn(() => mockNow.getTime());

    const progress = createMockProgress({ startTime });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText('5m 30s')).toBeInTheDocument();

    global.Date = OriginalDate;
  });

  test('formats estimated time remaining', () => {
    const progress = createMockProgress({
      estimatedTimeRemaining: 125, // 2 minutes 5 seconds
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.getByText(/2m 5s/)).toBeInTheDocument();
  });

  test('handles invalid start time gracefully', () => {
    const progress = createMockProgress({
      startTime: 'invalid-date',
    });
    render(<BatchImportProgress progress={progress} />);

    // Should show "Unknown" in the elapsed time section
    const unknownElements = screen.getAllByText('Unknown');
    expect(unknownElements.length).toBeGreaterThan(0);
  });

  test('handles undefined estimated time', () => {
    const progress = createMockProgress({
      estimatedTimeRemaining: undefined,
    });
    render(<BatchImportProgress progress={progress} />);

    // Should show "Unknown" for remaining time
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  test('does not show current URL when not provided', () => {
    const progress = createMockProgress({
      currentUrl: undefined,
    });
    render(<BatchImportProgress progress={progress} />);

    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });
});
