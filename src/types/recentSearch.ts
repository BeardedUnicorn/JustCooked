import { SearchFilters } from './searchFilters';

export interface RecentSearch {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: string;
}
