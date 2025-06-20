import { invoke } from '@tauri-apps/api/core';
import { RecentSearch, SearchFilters } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

const MAX_SEARCH_HISTORY = 50; // Maximum number of searches to keep

// Get recent searches from database
export async function getRecentSearches(limit: number = 10): Promise<RecentSearch[]> {
  try {
    return await invoke<RecentSearch[]>('db_get_recent_searches', { limit });
  } catch (error) {
    console.error('Failed to get recent searches:', error);
    return [];
  }
}

// Save a search to history
export async function saveSearch(query: string, filters?: SearchFilters): Promise<void> {
  try {
    // Optimized: Check for existing search with a smaller limit first
    const recentSearches = await getRecentSearches(10); // Only check recent 10 searches
    const existingSearch = recentSearches.find(search =>
      search.query.toLowerCase() === query.toLowerCase()
    );

    if (existingSearch) {
      // Update the existing search with new timestamp
      const updatedSearch: RecentSearch = {
        ...existingSearch,
        timestamp: getCurrentTimestamp(),
        filters: filters || existingSearch.filters,
      };
      await invoke('db_save_search_history', { search: updatedSearch });
    } else {
      // Create new search entry
      const newSearch: RecentSearch = {
        id: crypto.randomUUID(),
        query: query.trim(),
        timestamp: getCurrentTimestamp(),
        filters: filters || {},
      };
      await invoke('db_save_search_history', { search: newSearch });
    }
  } catch (error) {
    console.error('Failed to save search:', error);
    // Don't throw error to prevent blocking the search functionality
  }
}

// Remove a specific search from history
export async function removeSearch(id: string): Promise<void> {
  try {
    await invoke('db_delete_search_history', { id });
  } catch (error) {
    console.error('Failed to remove search:', error);
  }
}

// Clear all search history
export async function clearSearchHistory(): Promise<void> {
  try {
    await invoke('db_clear_search_history');
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }
}

// Get search suggestions based on partial query
export async function getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
  try {
    const searches = await getRecentSearches(MAX_SEARCH_HISTORY);
    const normalizedQuery = partialQuery.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return [];
    }
    
    const suggestions = searches
      .filter(search => search.query.toLowerCase().includes(normalizedQuery))
      .map(search => search.query)
      .slice(0, limit);
    
    return suggestions;
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
}

// Get popular search terms (most frequently searched)
export async function getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
  try {
    const searches = await getRecentSearches(MAX_SEARCH_HISTORY);
    const queryCount: Record<string, number> = {};
    
    // Count occurrences of each query
    searches.forEach(search => {
      const normalizedQuery = search.query.toLowerCase();
      queryCount[normalizedQuery] = (queryCount[normalizedQuery] || 0) + 1;
    });
    
    // Convert to array and sort by count
    const popularSearches = Object.entries(queryCount)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return popularSearches;
  } catch (error) {
    console.error('Failed to get popular searches:', error);
    return [];
  }
}

// Get search history statistics
export async function getSearchHistoryStats(): Promise<{
  totalSearches: number;
  uniqueQueries: number;
  mostRecentSearch?: string;
  oldestSearch?: string;
}> {
  try {
    const searches = await getRecentSearches(MAX_SEARCH_HISTORY);
    const uniqueQueries = new Set(searches.map(s => s.query.toLowerCase())).size;
    
    const stats = {
      totalSearches: searches.length,
      uniqueQueries,
      mostRecentSearch: searches[0]?.query,
      oldestSearch: searches[searches.length - 1]?.query,
    };
    
    return stats;
  } catch (error) {
    console.error('Failed to get search history stats:', error);
    return {
      totalSearches: 0,
      uniqueQueries: 0,
    };
  }
}

// Export search history (for backup/export functionality)
export async function exportSearchHistory(): Promise<RecentSearch[]> {
  try {
    return await getRecentSearches(MAX_SEARCH_HISTORY);
  } catch (error) {
    console.error('Failed to export search history:', error);
    return [];
  }
}

// Import search history (for restore/import functionality)
export async function importSearchHistory(searches: RecentSearch[]): Promise<void> {
  try {
    // Clear existing history first
    await clearSearchHistory();
    
    // Import new searches
    for (const search of searches) {
      await invoke('db_save_search_history', { search });
    }
  } catch (error) {
    console.error('Failed to import search history:', error);
    throw new Error('Failed to import search history');
  }
}
