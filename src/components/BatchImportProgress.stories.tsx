import type { Meta, StoryObj } from '@storybook/react';
import BatchImportProgress from './BatchImportProgress';
import { BatchImportProgress as BatchImportProgressType, BatchImportStatus, BatchImportError } from '@app-types';

const meta: Meta<typeof BatchImportProgress> = {
  title: 'Display/BatchImportProgress',
  component: BatchImportProgress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    progress: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper function to create base progress object
const createBaseProgress = (overrides: Partial<BatchImportProgressType> = {}): BatchImportProgressType => ({
  status: BatchImportStatus.IDLE,
  currentUrl: undefined,
  processedRecipes: 0,
  totalRecipes: 0,
  processedCategories: 0,
  totalCategories: 0,
  successfulImports: 0,
  failedImports: 0,
  skippedRecipes: 0,
  errors: [],
  startTime: '2024-01-15T10:00:00Z',
  estimatedTimeRemaining: undefined,
  ...overrides,
});

// Mock errors for testing
const mockErrors: BatchImportError[] = [
  {
    url: 'https://www.allrecipes.com/recipe/123/failed-recipe',
    message: 'Failed to parse recipe ingredients',
    timestamp: '2024-01-15T10:05:00Z',
    errorType: 'ParseError',
  },
  {
    url: 'https://www.allrecipes.com/recipe/456/network-error',
    message: 'Network timeout after 30 seconds',
    timestamp: '2024-01-15T10:07:00Z',
    errorType: 'NetworkError',
  },
  {
    url: 'https://www.allrecipes.com/recipe/789/validation-error',
    message: 'Recipe title is required but was empty',
    timestamp: '2024-01-15T10:10:00Z',
    errorType: 'ValidationError',
  },
];

// Null Progress: progress = null (loading state)
export const NullProgress: Story = {
  args: {
    progress: null,
  },
};

// Idle: Initial state
export const Idle: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.IDLE,
    }),
  },
};

// Starting: Import is starting
export const Starting: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.STARTING,
      currentUrl: 'https://www.allrecipes.com/recipes/79/desserts/',
    }),
  },
};

// CrawlingCategories: Finding categories
export const CrawlingCategories: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.CRAWLING_CATEGORIES,
      currentUrl: 'https://www.allrecipes.com/recipes/79/desserts/',
      processedCategories: 3,
      totalCategories: 10,
    }),
  },
};

// ExtractingRecipes: Extracting recipe URLs
export const ExtractingRecipes: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.EXTRACTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipes/79/desserts/cakes/',
      processedCategories: 8,
      totalCategories: 10,
      processedRecipes: 0,
      totalRecipes: 150,
    }),
  },
};

// FilteringExisting: Filtering out existing recipes
export const FilteringExisting: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.FILTERING_EXISTING,
      processedCategories: 10,
      totalCategories: 10,
      processedRecipes: 0,
      totalRecipes: 150,
      skippedRecipes: 25,
    }),
  },
};

// ImportingRecipes: Actively importing recipes
export const ImportingRecipes: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/123/chocolate-cake',
      processedCategories: 10,
      totalCategories: 10,
      processedRecipes: 45,
      totalRecipes: 125,
      successfulImports: 42,
      failedImports: 3,
      skippedRecipes: 25,
      estimatedTimeRemaining: 180,
    }),
  },
};

// ReImportingRecipes: Re-importing existing recipes
export const ReImportingRecipes: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.RE_IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/456/updated-recipe',
      processedRecipes: 15,
      totalRecipes: 50,
      successfulImports: 12,
      failedImports: 3,
      estimatedTimeRemaining: 120,
    }),
  },
};

// Completed: Import finished successfully
export const Completed: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.COMPLETED,
      processedCategories: 10,
      totalCategories: 10,
      processedRecipes: 125,
      totalRecipes: 125,
      successfulImports: 118,
      failedImports: 7,
      skippedRecipes: 25,
    }),
  },
};

// Cancelled: Import was cancelled
export const Cancelled: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.CANCELLED,
      processedCategories: 6,
      totalCategories: 10,
      processedRecipes: 45,
      totalRecipes: 125,
      successfulImports: 40,
      failedImports: 5,
      skippedRecipes: 15,
    }),
  },
};

// Error: Import encountered an error
export const Error: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.ERROR,
      processedCategories: 3,
      totalCategories: 10,
      processedRecipes: 12,
      totalRecipes: 125,
      successfulImports: 8,
      failedImports: 4,
      skippedRecipes: 5,
      errors: [mockErrors[0]], // Single critical error
    }),
  },
};

// WithErrors: Progress with populated errors array
export const WithErrors: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.IMPORTING_RECIPES,
      currentUrl: 'https://www.allrecipes.com/recipe/999/current-recipe',
      processedCategories: 10,
      totalCategories: 10,
      processedRecipes: 75,
      totalRecipes: 125,
      successfulImports: 65,
      failedImports: 10,
      skippedRecipes: 25,
      errors: mockErrors, // All mock errors
      estimatedTimeRemaining: 90,
    }),
  },
};

// ZeroTotals: totalRecipes = 0, totalCategories = 0
export const ZeroTotals: Story = {
  args: {
    progress: createBaseProgress({
      status: BatchImportStatus.COMPLETED,
      processedCategories: 0,
      totalCategories: 0,
      processedRecipes: 0,
      totalRecipes: 0,
      successfulImports: 0,
      failedImports: 0,
      skippedRecipes: 0,
    }),
  },
};
