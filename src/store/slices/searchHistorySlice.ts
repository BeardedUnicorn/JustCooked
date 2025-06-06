import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RecentSearch, SearchFilters } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

interface SearchHistoryState {
  searches: RecentSearch[];
  loading: boolean;
  error: string | null;
}

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_RECENT_SEARCHES = 10;

// Async thunks
export const loadSearchHistory = createAsyncThunk(
  'searchHistory/loadSearchHistory',
  async () => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) as RecentSearch[] : [];
    } catch (error) {
      console.error('Failed to load search history:', error);
      return [];
    }
  }
);

export const saveSearchHistory = createAsyncThunk(
  'searchHistory/saveSearchHistory',
  async (searches: RecentSearch[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searches));
      return searches;
    } catch (error) {
      console.error('Failed to save search history:', error);
      throw error;
    }
  }
);

export const saveSearch = createAsyncThunk(
  'searchHistory/saveSearch',
  async ({ query, filters }: { query: string; filters: SearchFilters }, { getState, dispatch }) => {
    if (!query.trim()) return;
    
    const state = getState() as { searchHistory: SearchHistoryState };
    const searches = state.searchHistory.searches;
    
    // Remove duplicate if exists
    const filteredSearches = searches.filter(search => 
      search.query.toLowerCase() !== query.toLowerCase()
    );
    
    // Add new search at the beginning
    const newSearch: RecentSearch = {
      id: crypto.randomUUID(),
      query: query.trim(),
      filters,
      timestamp: getCurrentTimestamp(),
    };

    filteredSearches.unshift(newSearch);

    // Keep only the most recent searches
    const limitedSearches = filteredSearches.slice(0, MAX_RECENT_SEARCHES);

    await dispatch(saveSearchHistory(limitedSearches));
    return newSearch;
  }
);

export const removeSearch = createAsyncThunk(
  'searchHistory/removeSearch',
  async (id: string, { getState, dispatch }) => {
    const state = getState() as { searchHistory: SearchHistoryState };
    const searches = state.searchHistory.searches;
    const filtered = searches.filter(search => search.id !== id);

    await dispatch(saveSearchHistory(filtered));
    return id;
  }
);

export const clearSearchHistory = createAsyncThunk(
  'searchHistory/clearSearchHistory',
  async (_, { dispatch }) => {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      await dispatch(saveSearchHistory([]));
      return [];
    } catch (error) {
      console.error('Failed to clear search history:', error);
      throw error;
    }
  }
);

const initialState: SearchHistoryState = {
  searches: [],
  loading: false,
  error: null,
};

const searchHistorySlice = createSlice({
  name: 'searchHistory',
  initialState,
  reducers: {
    getSearchSuggestions: (state, action: PayloadAction<string>) => {
      // This is a synchronous selector-like action that doesn't modify state
      // The actual suggestions will be computed in a selector
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load search history
      .addCase(loadSearchHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSearchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.searches = action.payload;
      })
      .addCase(loadSearchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load search history';
      })
      // Save search
      .addCase(saveSearch.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveSearch.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Remove duplicate if exists
          state.searches = state.searches.filter(search => 
            search.query.toLowerCase() !== action.payload!.query.toLowerCase()
          );
          // Add new search at the beginning
          state.searches.unshift(action.payload);
          // Keep only the most recent searches
          state.searches = state.searches.slice(0, MAX_RECENT_SEARCHES);
        }
      })
      .addCase(saveSearch.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save search';
      })
      // Remove search
      .addCase(removeSearch.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeSearch.fulfilled, (state, action) => {
        state.loading = false;
        state.searches = state.searches.filter(search => search.id !== action.payload);
      })
      .addCase(removeSearch.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove search';
      })
      // Clear search history
      .addCase(clearSearchHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearSearchHistory.fulfilled, (state) => {
        state.loading = false;
        state.searches = [];
      })
      .addCase(clearSearchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to clear search history';
      })
      // Save search history
      .addCase(saveSearchHistory.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to save search history';
      });
  },
});

export const { getSearchSuggestions, clearError } = searchHistorySlice.actions;

// Selectors
export const selectSearchHistory = (state: { searchHistory: SearchHistoryState }) => state.searchHistory.searches;
export const selectSearchHistoryLoading = (state: { searchHistory: SearchHistoryState }) => state.searchHistory.loading;
export const selectSearchHistoryError = (state: { searchHistory: SearchHistoryState }) => state.searchHistory.error;
export const selectSearchSuggestions = (state: { searchHistory: SearchHistoryState }, query: string) => {
  if (!query.trim()) return [];
  
  const searches = state.searchHistory.searches;
  const suggestions = searches
    .filter(search => 
      search.query.toLowerCase().includes(query.toLowerCase()) &&
      search.query.toLowerCase() !== query.toLowerCase()
    )
    .map(search => search.query)
    .slice(0, 5);
  
  return suggestions;
};

export default searchHistorySlice.reducer;
