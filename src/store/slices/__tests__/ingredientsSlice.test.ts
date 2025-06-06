import { configureStore } from '@reduxjs/toolkit';
import ingredientsReducer, {
  searchIngredients,
  clearSearchResults,
  selectIngredients,
  selectIngredientsLoading,
  selectIngredientsError,
  selectIngredientSearchResults,
} from '../ingredientsSlice';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid'),
  },
});

// Mock utils
jest.mock('@utils/timeUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2023-01-01T00:00:00.000Z'),
}));

jest.mock('@utils/ingredientUtils', () => ({
  cleanIngredientName: jest.fn((name: string) => name.trim()),
  detectIngredientCategory: jest.fn(() => ({ id: 'vegetables' })),
}));

describe('ingredientsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        ingredients: ingredientsReducer,
      },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().ingredients;
      expect(state.ingredients).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.searchResults).toEqual([]);
    });
  });

  describe('searchIngredients reducer', () => {
    it('should search ingredients and return results', () => {
      // First, manually set some ingredients in the state
      const mockIngredients = [
        {
          id: '1',
          name: 'Salt',
          category: 'herbs',
          aliases: ['table salt', 'sea salt'],
          dateAdded: '2023-01-01T00:00:00.000Z',
          dateModified: '2023-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          name: 'Black Pepper',
          category: 'herbs',
          aliases: ['pepper'],
          dateAdded: '2023-01-01T00:00:00.000Z',
          dateModified: '2023-01-01T00:00:00.000Z',
        },
      ];

      // Manually update the state
      store.dispatch({ type: 'ingredients/loadIngredients/fulfilled', payload: mockIngredients });

      // Test exact match
      store.dispatch(searchIngredients('Salt'));
      let state = store.getState().ingredients;
      expect(state.searchResults).toHaveLength(1);
      expect(state.searchResults[0].ingredient.name).toBe('Salt');
      expect(state.searchResults[0].matchType).toBe('exact');
      expect(state.searchResults[0].score).toBe(1);

      // Test alias match
      store.dispatch(searchIngredients('pepper'));
      state = store.getState().ingredients;
      expect(state.searchResults).toHaveLength(1);
      expect(state.searchResults[0].ingredient.name).toBe('Black Pepper');
      expect(state.searchResults[0].matchType).toBe('alias');
      expect(state.searchResults[0].score).toBe(0.9);

      // Test fuzzy match
      store.dispatch(searchIngredients('pep'));
      state = store.getState().ingredients;
      expect(state.searchResults).toHaveLength(1);
      expect(state.searchResults[0].ingredient.name).toBe('Black Pepper');
      expect(state.searchResults[0].matchType).toBe('fuzzy');

      // Test empty query returns all
      store.dispatch(searchIngredients(''));
      state = store.getState().ingredients;
      expect(state.searchResults).toHaveLength(2);
      expect(state.searchResults[0].matchType).toBe('exact');
      expect(state.searchResults[0].score).toBe(1);
    });

    it('should clear search results', () => {
      // Set up some search results first
      const mockIngredients = [
        {
          id: '1',
          name: 'Salt',
          category: 'herbs',
          aliases: ['table salt'],
          dateAdded: '2023-01-01T00:00:00.000Z',
          dateModified: '2023-01-01T00:00:00.000Z',
        },
      ];

      store.dispatch({ type: 'ingredients/loadIngredients/fulfilled', payload: mockIngredients });
      store.dispatch(searchIngredients('Salt'));
      
      let state = store.getState().ingredients;
      expect(state.searchResults).toHaveLength(1);

      // Clear search results
      store.dispatch(clearSearchResults());
      state = store.getState().ingredients;
      expect(state.searchResults).toEqual([]);
    });
  });

  describe('selectors', () => {
    const mockState = {
      ingredients: {
        ingredients: [
          {
            id: '1',
            name: 'Salt',
            category: 'herbs',
            aliases: ['table salt'],
            dateAdded: '2023-01-01T00:00:00.000Z',
            dateModified: '2023-01-01T00:00:00.000Z',
          },
        ],
        loading: false,
        error: null,
        searchResults: [],
      },
    };

    it('should select ingredients', () => {
      const result = selectIngredients(mockState);
      expect(result).toEqual(mockState.ingredients.ingredients);
    });

    it('should select loading state', () => {
      const result = selectIngredientsLoading(mockState);
      expect(result).toBe(false);
    });

    it('should select error state', () => {
      const result = selectIngredientsError(mockState);
      expect(result).toBe(null);
    });

    it('should select search results', () => {
      const result = selectIngredientSearchResults(mockState);
      expect(result).toEqual([]);
    });
  });

  describe('loading states', () => {
    it('should handle loading states correctly', () => {
      // Test pending state
      store.dispatch({ type: 'ingredients/loadIngredients/pending' });
      let state = store.getState().ingredients;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      // Test fulfilled state
      store.dispatch({ type: 'ingredients/loadIngredients/fulfilled', payload: [] });
      state = store.getState().ingredients;
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);

      // Test rejected state
      store.dispatch({ 
        type: 'ingredients/loadIngredients/rejected', 
        error: { message: 'Test error' } 
      });
      state = store.getState().ingredients;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Test error');
    });
  });
});
