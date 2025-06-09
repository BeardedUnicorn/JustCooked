import React, { useState } from 'react';
import {
  Box, TextField, InputAdornment, IconButton,
  Popover, List, ListItem, ListItemText, Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';

interface SearchBarProps {
  onSearch: (term: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = 'Search...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  const handleSearch = () => {
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm) {
      onSearch(trimmedTerm);

      // Add to history if not already there
      if (!searchHistory.includes(trimmedTerm)) {
        const newHistory = [trimmedTerm, ...searchHistory].slice(0, 5);
        setSearchHistory(newHistory);
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

  const handleHistoryItemClick = (term: string) => {
    setSearchTerm(term);
    onSearch(term);
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
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} aria-label="clear">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
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
          {searchHistory.map((term, index) => (
            <ListItem
              key={index}
              onClick={() => handleHistoryItemClick(term)}
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <ListItemText primary={term} />
            </ListItem>
          ))}
        </List>
      </Popover>
    </Box>
  );
};

export default SearchBar;
