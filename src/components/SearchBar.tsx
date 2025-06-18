import React, { useState, useEffect } from 'react';
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
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  // Load search history on component mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getRecentSearches(5);
        setSearchHistory(history);
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    };
    loadHistory();
  }, []);

  const handleSearch = async () => {
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm) {
      onSearch(trimmedTerm);

      // Save to search history
      try {
        await saveSearch(trimmedTerm);
        // Reload search history to get updated list
        const updatedHistory = await getRecentSearches(5);
        setSearchHistory(updatedHistory);
      } catch (error) {
        console.error('Failed to save search to history:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (searchHistory.length > 0) {
      setAnchorEl(event.currentTarget as HTMLDivElement);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleHistoryItemClick = (search: RecentSearch) => {
    setSearchTerm(search.query);
    onSearch(search.query);
    handleClose();
  };

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
          {searchHistory.map((search, index) => (
            <ListItem
              key={search.id}
              onClick={() => handleHistoryItemClick(search)}
              data-testid={`search-history-item-${index}`}
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
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
