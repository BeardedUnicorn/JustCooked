/**
 * Utility functions for browser-compatible Storybook mocking
 * Replaces Vitest-specific mocking with browser-compatible patterns
 */

import { fn } from 'storybook/test';

/**
 * Browser-compatible mock configuration for Tauri API
 */
export const configureTauriMocks = (mockImplementations: Record<string, any> = {}) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__TAURI__ = {
      core: { 
        invoke: fn().mockImplementation(async (command: string, ...args: any[]) => {
          if (mockImplementations[command]) {
            return mockImplementations[command](...args);
          }
          console.log('[Storybook Mock Invoke]', command, args);
          return Promise.resolve(undefined);
        })
      },
      fs: {},
      dialog: {},
    };
  }
};

/**
 * Browser-compatible mock configuration for services
 */
export const configureServiceMocks = (serviceMocks: Record<string, Record<string, any>>) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = serviceMocks;
  }
};

/**
 * Browser-compatible mock configuration for hooks
 */
export const configureHookMocks = (hookMocks: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_HOOK_MOCKS__ = hookMocks;
  }
};

/**
 * Browser-compatible mock configuration for external libraries
 */
export const configureLibraryMocks = (libraryMocks: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_LIBRARY_MOCKS__ = libraryMocks;
  }
};

/**
 * Reset all mocks to default state
 */
export const resetAllMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {};
    // @ts-ignore
    window.__STORYBOOK_HOOK_MOCKS__ = {};
    // @ts-ignore
    window.__STORYBOOK_LIBRARY_MOCKS__ = {};
  }
};

/**
 * Standard mock patterns for common services
 */
export const createStandardServiceMocks = () => ({
  recipeStorage: {
    getAllRecipes: fn().mockResolvedValue([]),
    getRecipeById: fn().mockResolvedValue(null),
    saveRecipe: fn().mockResolvedValue('recipe-id'),
    deleteRecipe: fn().mockResolvedValue(undefined),
    getExistingRecipeUrls: fn().mockResolvedValue([]),
  },
  mealPlanStorage: {
    getMealPlanRecipes: fn().mockResolvedValue([]),
    saveMealPlan: fn().mockResolvedValue('meal-plan-id'),
    deleteMealPlan: fn().mockResolvedValue(undefined),
  },
  shoppingListStorage: {
    generateShoppingListFromMealPlan: fn().mockResolvedValue('shopping-list-id'),
    consolidateIngredients: fn().mockReturnValue([]),
  },
  searchHistoryStorage: {
    getRecentSearches: fn().mockResolvedValue([]),
    saveSearch: fn().mockResolvedValue(undefined),
  },
  importQueueService: {
    getEstimatedTimeRemaining: fn().mockReturnValue('5 minutes'),
    canRemoveTask: fn().mockReturnValue(true),
    getStatusDisplayText: fn().mockReturnValue('Processing...'),
    getCategoryProgress: fn().mockReturnValue({ current: 0, total: 0, percentage: 0, isActive: false }),
    getRecipeProgress: fn().mockReturnValue({ current: 0, total: 0, percentage: 0, isActive: false }),
    getCurrentPhaseDescription: fn().mockReturnValue('Processing...'),
    getProgressPercentage: fn().mockReturnValue(0),
  },
  batchImportService: {
    getSuggestedCategoryUrls: fn().mockReturnValue([]),
    getPopularCategoryUrls: fn().mockReturnValue([]),
  },
  reImportService: {
    getReImportableRecipesCount: fn().mockResolvedValue(0),
    getTaskDescription: fn().mockReturnValue('Re-import task'),
    addToQueue: fn().mockResolvedValue(undefined),
  },
  loggingService: {
    createLogger: fn().mockReturnValue({
      info: fn().mockResolvedValue(undefined),
      debug: fn().mockResolvedValue(undefined),
      warn: fn().mockResolvedValue(undefined),
      error: fn().mockResolvedValue(undefined),
      logError: fn().mockResolvedValue(undefined),
      logUserAction: fn().mockResolvedValue(undefined),
    }),
  },
});

/**
 * Standard mock patterns for common Tauri commands
 */
export const createStandardTauriMocks = () => ({
  get_import_queue_status: fn().mockResolvedValue({
    tasks: [],
    currentTaskId: null,
    isProcessing: false,
    totalPending: 0,
    totalCompleted: 0,
    totalFailed: 0,
  }),
  get_all_recipes: fn().mockResolvedValue([]),
  save_recipe: fn().mockResolvedValue('recipe-id'),
  delete_recipe: fn().mockResolvedValue(undefined),
  import_recipe: fn().mockResolvedValue('recipe-id'),
  get_pantry_items: fn().mockResolvedValue([]),
  save_pantry_item: fn().mockResolvedValue('pantry-item-id'),
  delete_pantry_item: fn().mockResolvedValue(undefined),
});

/**
 * Standard mock patterns for common hooks
 */
export const createStandardHookMocks = () => ({
  useImageUrl: fn().mockReturnValue({
    imageUrl: 'https://via.placeholder.com/300x200?text=Mock+Image',
    isLoading: false,
    error: null,
  }),
  useMediaQuery: fn().mockReturnValue(false),
});

/**
 * Standard mock patterns for external libraries
 */
export const createStandardLibraryMocks = () => ({
  zxing: {
    BrowserMultiFormatReader: fn().mockImplementation(() => ({
      decodeFromVideoDevice: fn().mockImplementation(() => new Promise(() => {})),
      decodeFromVideoElement: fn().mockImplementation(() => new Promise(() => {})),
      reset: fn(),
      hints: new Map(),
    })),
    NotFoundException: class NotFoundException extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'NotFoundException';
      }
    },
    DecodeHintType: {
      TRY_HARDER: 'TRY_HARDER',
      POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
      ASSUME_GS1: 'ASSUME_GS1',
    },
    BarcodeFormat: {
      UPC_A: 'UPC_A',
      UPC_E: 'UPC_E',
      EAN_13: 'EAN_13',
      EAN_8: 'EAN_8',
      CODE_128: 'CODE_128',
      CODE_39: 'CODE_39',
      ITF: 'ITF',
      RSS_14: 'RSS_14',
      RSS_EXPANDED: 'RSS_EXPANDED',
    },
  },
  navigator: {
    mediaDevices: {
      getUserMedia: fn().mockResolvedValue({
        getTracks: fn().mockReturnValue([{ stop: fn() }])
      }),
    },
  },
});

/**
 * Initialize all standard mocks for Storybook environment
 */
export const initializeStoryBookMocks = () => {
  configureServiceMocks(createStandardServiceMocks());
  configureTauriMocks(createStandardTauriMocks());
  configureHookMocks(createStandardHookMocks());
  configureLibraryMocks(createStandardLibraryMocks());
};
