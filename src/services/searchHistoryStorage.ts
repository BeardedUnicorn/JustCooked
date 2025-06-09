import { invoke } from '@tauri-apps/api/core';
import { RecentSearch, SearchFilters } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Database-backed search history storage service
// This service now uses SQLite database instead of localStorage

const MAX_RECENT_SEARCHES = 10;

export const getRecentSearches = async (): Promise<RecentSearch[]> => {
  try {
    return await invoke<RecentSearch[]>('db_get_recent_searches', { limit: MAX_RECENT_SEARCHES });
  } catch (error) {
    console.error('Failed to get recent searches:', error);
    return [];
  }
};

export const saveSearch = async (query: string, filters: SearchFilters): Promise<void> => {
  if (!query.trim()) return;
  
  try {
    // Check if this exact search already exists and remove it first
    const existingSearches = await getRecentSearches();
    const existingSearch = existingSearches.find(search => 
      search.query.toLowerCase() === query.toLowerCase()
    );
    
    if (existingSearch) {
      await invoke('db_delete_search_history', { id: existingSearch.id });
    }
    
    // Add new search
    const newSearch: RecentSearch = {
      id: crypto.randomUUID(),
      query: query.trim(),
      filters,
      timestamp: getCurrentTimestamp(),
    };

    await invoke('db_save_search_history', { search: newSearch });

    // Clean up old searches if we exceed the limit
    await cleanupOldSearches();
  } catch (error) {
    console.error('Failed to save search:', error);
  }
};

export const clearSearchHistory = async (): Promise<void> => {
  try {
    await invoke('db_clear_search_history');
  } catch (error) {
    console.error('Failed to clear search history:', error);
    throw new Error('Failed to clear search history');
  }
};

export const removeSearch = async (id: string): Promise<void> => {
  try {
    const deleted = await invoke<boolean>('db_delete_search_history', { id });
    if (!deleted) {
      throw new Error('Search history item not found or could not be deleted');
    }
  } catch (error) {
    console.error('Failed to remove search:', error);
    throw new Error('Failed to remove search');
  }
};

export const getSearchSuggestions = async (query: string): Promise<string[]> => {
  if (!query.trim()) return [];
  
  try {
    const searches = await getRecentSearches();
    const suggestions = searches
      .filter(search => 
        search.query.toLowerCase().includes(query.toLowerCase()) &&
        search.query.toLowerCase() !== query.toLowerCase()
      )
      .map(search => search.query)
      .slice(0, 5);
    
    return suggestions;
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
};

// Get search history for a specific time period
export const getSearchHistoryByDateRange = async (
  startDate: string, 
  endDate: string
): Promise<RecentSearch[]> => {
  try {
    const allSearches = await getRecentSearches();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return allSearches.filter(search => {
      const searchDate = new Date(search.timestamp);
      return searchDate >= start && searchDate <= end;
    });
  } catch (error) {
    console.error('Failed to get search history by date range:', error);
    return [];
  }
};

// Get most popular search terms
export const getPopularSearchTerms = async (limit: number = 5): Promise<Array<{
  query: string;
  count: number;
  lastSearched: string;
}>> => {
  try {
    const searches = await getRecentSearches();
    const termCounts = new Map<string, { count: number; lastSearched: string }>();
    
    for (const search of searches) {
      const normalizedQuery = search.query.toLowerCase();
      const existing = termCounts.get(normalizedQuery);
      
      if (existing) {
        existing.count++;
        // Keep the most recent timestamp
        if (search.timestamp > existing.lastSearched) {
          existing.lastSearched = search.timestamp;
        }
      } else {
        termCounts.set(normalizedQuery, {
          count: 1,
          lastSearched: search.timestamp,
        });
      }
    }
    
    return Array.from(termCounts.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        lastSearched: data.lastSearched,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to get popular search terms:', error);
    return [];
  }
};

// Get searches with specific filters
export const getSearchesWithFilters = async (): Promise<RecentSearch[]> => {
  try {
    const searches = await getRecentSearches();
    return searches.filter(search => {
      const { filters } = search;
      return (
        (filters.tags && filters.tags.length > 0) ||
        filters.difficulty ||
        filters.maxPrepTime ||
        filters.maxCookTime ||
        filters.isFavorite !== undefined
      );
    });
  } catch (error) {
    console.error('Failed to get searches with filters:', error);
    return [];
  }
};

// Clean up old searches beyond the limit
const cleanupOldSearches = async (): Promise<void> => {
  try {
    const searches = await getRecentSearches();
    if (searches.length > MAX_RECENT_SEARCHES) {
      // Sort by timestamp (newest first) and remove the oldest ones
      const sortedSearches = searches.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const searchesToDelete = sortedSearches.slice(MAX_RECENT_SEARCHES);
      
      for (const search of searchesToDelete) {
        await invoke('db_delete_search_history', { id: search.id });
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old searches:', error);
  }
};

// Export search history to JSON
export const exportSearchHistory = async (): Promise<string> => {
  try {
    const searches = await getRecentSearches();
    return JSON.stringify(searches, null, 2);
  } catch (error) {
    console.error('Failed to export search history:', error);
    throw new Error('Failed to export search history');
  }
};

// Import search history from JSON
export const importSearchHistory = async (jsonData: string): Promise<void> => {
  try {
    const searches: RecentSearch[] = JSON.parse(jsonData);
    
    // Validate the data structure
    if (!Array.isArray(searches)) {
      throw new Error('Invalid search history format');
    }
    
    for (const search of searches) {
      if (!search.id || !search.query || !search.filters || !search.timestamp) {
        throw new Error('Invalid search history item format');
      }
      
      await invoke('db_save_search_history', { search });
    }
    
    // Clean up after import
    await cleanupOldSearches();
  } catch (error) {
    console.error('Failed to import search history:', error);
    throw new Error('Failed to import search history');
  }
};
