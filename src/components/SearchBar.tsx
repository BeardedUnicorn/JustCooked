import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, TextField, InputAdornment, IconButton,
  Popover, List, ListItem, ListItemText, Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import FilterListIcon from '@mui/icons-material/FilterList';
import { RecentSearch } from '@app-types';
import { getRecentSearches, saveSearch } from '@services/searchHistoryStorage';



interface SearchBarProps {
  onSearch: (term: string) => void;
  onAdvancedSearch?: () => void;
  placeholder?: string;
  'data-testid'?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onAdvancedSearch, placeholder = 'Search...', 'data-testid': testId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState<RecentSearch[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load search history on component mount with error handling
  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (isLoadingHistory) return; // Prevent multiple concurrent loads

      setIsLoadingHistory(true);
      try {
        const history = await getRecentSearches(5);
        if (isMounted) {
          setSearchHistory(history);
        }
      } catch (error) {
        console.error('Failed to load search history:', error);
        if (isMounted) {
          setSearchHistory([]); // Set empty array on error
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm) {
      onSearch(trimmedTerm);

      // Save to search history asynchronously without blocking UI
      try {
        await saveSearch(trimmedTerm);
        // Reload search history to get updated list
        const updatedHistory = await getRecentSearches(5);
        setSearchHistory(updatedHistory);
      } catch (error) {
        console.error('Failed to save search to history:', error);
        // Don't block the search if history save fails
      }
    }
  }, [searchTerm, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setSearchTerm('');
    onSearch('');
  }, [onSearch]);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (searchHistory && searchHistory.length > 0 && !isLoadingHistory) {
      setAnchorEl(event.currentTarget);
    }
  }, [searchHistory, isLoadingHistory]);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleHistoryItemClick = useCallback((search: RecentSearch) => {
    setSearchTerm(search.query);
    onSearch(search.query);
    // Use setTimeout to ensure the popover closes after the current event loop
    setTimeout(() => {
      setAnchorEl(null);
    }, 0);
  }, [onSearch]);

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        data-testid={testId || 'search-bar-input'}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {onAdvancedSearch && (
                <IconButton
                  size="small"
                  onClick={onAdvancedSearch}
                  aria-label="advanced search"
                  data-testid="search-bar-advanced-button"
                  sx={{ mr: searchTerm ? 0.5 : 0 }}
                >
                  <FilterListIcon fontSize="small" />
                </IconButton>
              )}
              {searchTerm && (
                <IconButton size="small" onClick={handleClear} aria-label="clear" data-testid="search-bar-clear-button">
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        data-testid="search-bar-history-popover"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: { width: anchorEl?.clientWidth, maxHeight: 300 }
        }}
      >
        <List dense>
          <ListItem>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              <HistoryIcon fontSize="small" sx={{ mr: 0.5 }} />
              Recent Searches
            </Typography>
          </ListItem>
          {searchHistory && searchHistory.map((search, index) => (
            <ListItem
              key={search.id}
              component="button"
              onClick={() => handleHistoryItemClick(search)}
              data-testid={`search-history-item-${index}`}
              sx={{
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' },
                border: 'none',
                background: 'transparent',
                width: '100%',
                textAlign: 'left'
              }}
            >
              <ListItemText
                primary={search.query}
                secondary={new Date(search.timestamp).toLocaleDateString()}
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </Box>
  );
};

export default SearchBar;
