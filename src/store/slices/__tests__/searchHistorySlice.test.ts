import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import searchHistoryReducer, {
  clearError,
  selectSearchHistory,
  selectSearchHistoryLoading,
  selectSearchHistoryError,
  selectSearchSuggestions,
  SearchHistoryState,
} from '../searchHistorySlice';

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

describe('searchHistorySlice', () => {
  let store: EnhancedStore<{ searchHistory: SearchHistoryState }>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        searchHistory: searchHistoryReducer,
      },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().searchHistory;
      expect(state.searches).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('clearError reducer', () => {
    it('should clear error state', () => {
      // First set an error
      store.dispatch({ 
        type: 'searchHistory/loadSearchHistory/rejected', 
        error: { message: 'Test error' } 
      });
      
      let state = store.getState().searchHistory;
      expect(state.error).toBe('Test error');

      // Clear the error
      store.dispatch(clearError());
      state = store.getState().searchHistory;
      expect(state.error).toBe(null);
    });
  });

  describe('selectors', () => {
    const mockState = {
      searchHistory: {
        searches: [
          {
            id: '1',
            query: 'pasta',
            filters: { tags: [], ingredients: [] },
            timestamp: '2023-01-01T00:00:00.000Z',
          },
          {
            id: '2',
            query: 'chicken pasta',
            filters: { tags: [], ingredients: [] },
            timestamp: '2023-01-01T01:00:00.000Z',
          },
        ],
        loading: false,
        error: null,
      },
    };

    it('should select search history', () => {
      const result = selectSearchHistory(mockState);
      expect(result).toEqual(mockState.searchHistory.searches);
    });

    it('should select loading state', () => {
      const result = selectSearchHistoryLoading(mockState);
      expect(result).toBe(false);
    });

    it('should select error state', () => {
      const result = selectSearchHistoryError(mockState);
      expect(result).toBe(null);
    });

    it('should select search suggestions', () => {
      const result = selectSearchSuggestions(mockState, 'pas');
      expect(result).toEqual(['pasta', 'chicken pasta']);
    });

    it('should return empty suggestions for empty query', () => {
      const result = selectSearchSuggestions(mockState, '');
      expect(result).toEqual([]);
    });

    it('should exclude exact matches from suggestions', () => {
      const result = selectSearchSuggestions(mockState, 'pasta');
      expect(result).toEqual(['chicken pasta']);
    });
  });

  describe('loading states', () => {
    it('should handle loading states correctly', () => {
      // Test pending state
      store.dispatch({ type: 'searchHistory/loadSearchHistory/pending' });
      let state = store.getState().searchHistory;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      // Test fulfilled state
      store.dispatch({ type: 'searchHistory/loadSearchHistory/fulfilled', payload: [] });
      state = store.getState().searchHistory;
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);

      // Test rejected state
      store.dispatch({ 
        type: 'searchHistory/loadSearchHistory/rejected', 
        error: { message: 'Test error' } 
      });
      state = store.getState().searchHistory;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Test error');
    });
  });
});
