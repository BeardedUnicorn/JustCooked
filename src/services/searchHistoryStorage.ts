import { RecentSearch, SearchFilters } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';
import { getFromStorage, setToStorage, removeFromStorage } from '@utils/storageUtils';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_RECENT_SEARCHES = 10;

export const getRecentSearches = (): RecentSearch[] => {
  return getFromStorage(SEARCH_HISTORY_KEY, []);
};

export const saveSearch = (query: string, filters: SearchFilters): void => {
  if (!query.trim()) return;
  
  const searches = getRecentSearches();
  
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

  setToStorage(SEARCH_HISTORY_KEY, limitedSearches);
};

export const clearSearchHistory = (): void => {
  removeFromStorage(SEARCH_HISTORY_KEY);
};

export const removeSearch = (id: string): void => {
  const searches = getRecentSearches();
  const filtered = searches.filter(search => search.id !== id);

  if (filtered.length === 0) {
    removeFromStorage(SEARCH_HISTORY_KEY);
  } else {
    setToStorage(SEARCH_HISTORY_KEY, filtered);
  }
};

export const getSearchSuggestions = (query: string): string[] => {
  if (!query.trim()) return [];
  
  const searches = getRecentSearches();
  const suggestions = searches
    .filter(search => 
      search.query.toLowerCase().includes(query.toLowerCase()) &&
      search.query.toLowerCase() !== query.toLowerCase()
    )
    .map(search => search.query)
    .slice(0, 5);
  
  return suggestions;
};
