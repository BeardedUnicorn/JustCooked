import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Slider,
  Autocomplete,
} from '@mui/material';
import { SearchFilters } from '@app-types';

interface AdvancedSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  open,
  onClose,
  onSearch,
  initialFilters = {},
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [availableTags] = useState<string[]>([
    'breakfast', 'lunch', 'dinner', 'dessert', 'snack',
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
    'quick', 'healthy', 'comfort-food', 'holiday',
    'italian', 'mexican', 'asian', 'american',
    'baking', 'grilling', 'slow-cooker', 'one-pot'
  ]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters, open]);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTagsChange = (_event: any, newTags: string[]) => {
    handleFilterChange('tags', newTags);
  };

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
  };

  const difficultyOptions = ['Easy', 'Medium', 'Hard'];
  const timeOptions = [
    { label: 'Under 15 minutes', value: '0-15' },
    { label: '15-30 minutes', value: '15-30' },
    { label: '30-60 minutes', value: '30-60' },
    { label: '1-2 hours', value: '60-120' },
    { label: 'Over 2 hours', value: '120+' },
  ];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      data-testid="advanced-search-modal"
    >
      <DialogTitle>Advanced Search</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Difficulty */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  multiple
                  value={filters.difficulty || []}
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                  label="Difficulty"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  data-testid="advanced-search-difficulty"
                >
                  {difficultyOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Tags */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                multiple
                options={availableTags}
                value={filters.tags || []}
                onChange={handleTagsChange}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Select tags..."
                    data-testid="advanced-search-tags"
                  />
                )}
              />
            </Grid>

            {/* Prep Time */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Prep Time</InputLabel>
                <Select
                  value={filters.prepTime || ''}
                  onChange={(e) => handleFilterChange('prepTime', e.target.value)}
                  label="Prep Time"
                  data-testid="advanced-search-prep-time"
                >
                  <MenuItem value="">Any</MenuItem>
                  {timeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Cook Time */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Cook Time</InputLabel>
                <Select
                  value={filters.cookTime || ''}
                  onChange={(e) => handleFilterChange('cookTime', e.target.value)}
                  label="Cook Time"
                  data-testid="advanced-search-cook-time"
                >
                  <MenuItem value="">Any</MenuItem>
                  {timeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Total Time */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Total Time</InputLabel>
                <Select
                  value={filters.totalTime || ''}
                  onChange={(e) => handleFilterChange('totalTime', e.target.value)}
                  label="Total Time"
                  data-testid="advanced-search-total-time"
                >
                  <MenuItem value="">Any</MenuItem>
                  {timeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Servings */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography gutterBottom>Servings</Typography>
              <Slider
                value={filters.servings || [1, 12]}
                onChange={(_e, value) => handleFilterChange('servings', value)}
                valueLabelDisplay="auto"
                min={1}
                max={12}
                marks={[
                  { value: 1, label: '1' },
                  { value: 6, label: '6' },
                  { value: 12, label: '12+' },
                ]}
                data-testid="advanced-search-servings"
              />
            </Grid>

            {/* Rating */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography gutterBottom>Minimum Rating</Typography>
              <Slider
                value={filters.rating || 0}
                onChange={(_e, value) => handleFilterChange('rating', value)}
                valueLabelDisplay="auto"
                min={0}
                max={5}
                step={0.5}
                marks={[
                  { value: 0, label: '0' },
                  { value: 2.5, label: '2.5' },
                  { value: 5, label: '5' },
                ]}
                data-testid="advanced-search-rating"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} data-testid="advanced-search-reset-button">
          Reset
        </Button>
        <Button onClick={onClose} data-testid="advanced-search-cancel-button">
          Cancel
        </Button>
        <Button 
          onClick={handleSearch} 
          variant="contained" 
          data-testid="advanced-search-apply-button"
        >
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedSearchModal;
