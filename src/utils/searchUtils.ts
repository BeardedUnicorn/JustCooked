/**
 * Utility functions for search and filtering operations
 */

export interface SearchResult<T> {
  item: T;
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}

export interface SearchableItem {
  name: string;
  aliases?: string[];
}

// Generic fuzzy search function
export function fuzzySearch<T extends SearchableItem>(
  items: T[],
  query: string,
  options: {
    threshold?: number;
    maxResults?: number;
    caseSensitive?: boolean;
  } = {}
): SearchResult<T>[] {
  const {
    threshold = 0.1,
    maxResults = 50,
    caseSensitive = false
  } = options;

  // Handle null/undefined query
  if (!query || typeof query !== 'string') {
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 1,
      matchType: 'exact' as const,
    }));
  }

  const normalizedQuery = caseSensitive ? query.trim() : query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 1,
      matchType: 'exact' as const,
    }));
  }

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const normalizedName = caseSensitive ? item.name : item.name.toLowerCase();
    
    // Exact match
    if (normalizedName === normalizedQuery) {
      results.push({
        item,
        score: 1,
        matchType: 'exact',
      });
      continue;
    }
    
    // Alias match
    if (item.aliases) {
      const aliasMatch = item.aliases.some(alias => {
        const normalizedAlias = caseSensitive ? alias : alias.toLowerCase();
        return normalizedAlias === normalizedQuery;
      });
      
      if (aliasMatch) {
        results.push({
          item,
          score: 0.9,
          matchType: 'alias',
        });
        continue;
      }
    }
    
    // Fuzzy match (contains)
    if (normalizedName.includes(normalizedQuery)) {
      const score = normalizedQuery.length / normalizedName.length;
      if (score >= threshold) {
        results.push({
          item,
          score,
          matchType: 'fuzzy',
        });
        continue;
      }
    }
    
    // Fuzzy match in aliases
    if (item.aliases) {
      for (const alias of item.aliases) {
        const normalizedAlias = caseSensitive ? alias : alias.toLowerCase();
        if (normalizedAlias.includes(normalizedQuery)) {
          const score = (normalizedQuery.length / normalizedAlias.length) * 0.8;
          if (score >= threshold) {
            results.push({
              item,
              score,
              matchType: 'fuzzy',
            });
            break;
          }
        }
      }
    }
  }

  // Sort by score (highest first) and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// Generate search suggestions based on previous searches
export function generateSearchSuggestions(
  query: string,
  previousSearches: string[],
  maxSuggestions: number = 5
): string[] {
  // Handle null/undefined query
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  
  const normalizedQuery = query.toLowerCase();
  
  return previousSearches
    .filter(search => 
      search.toLowerCase().includes(normalizedQuery) &&
      search.toLowerCase() !== normalizedQuery
    )
    .slice(0, maxSuggestions);
}

// Highlight matching text in search results
export function highlightMatches(text: string, query: string): string {
  // Handle null/undefined query
  if (!query || typeof query !== 'string' || !query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// Calculate Levenshtein distance for more advanced fuzzy matching
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

// Advanced fuzzy search using Levenshtein distance
export function advancedFuzzySearch<T extends SearchableItem>(
  items: T[],
  query: string,
  options: {
    maxDistance?: number;
    maxResults?: number;
  } = {}
): SearchResult<T>[] {
  const { maxDistance = 3, maxResults = 50 } = options;

  // Handle null/undefined query
  if (!query || typeof query !== 'string') {
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 1,
      matchType: 'exact' as const,
    }));
  }

  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 1,
      matchType: 'exact' as const,
    }));
  }

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const normalizedName = item.name.toLowerCase();
    const distance = levenshteinDistance(normalizedQuery, normalizedName);
    
    if (distance <= maxDistance) {
      const score = 1 - (distance / Math.max(normalizedQuery.length, normalizedName.length));
      results.push({
        item,
        score,
        matchType: distance === 0 ? 'exact' : 'fuzzy',
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
