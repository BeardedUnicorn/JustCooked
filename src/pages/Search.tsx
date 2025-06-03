import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Grid, InputAdornment, Chip,
  FormControl, InputLabel, Select, MenuItem, Stack, Alert,
  Accordion, AccordionSummary, AccordionDetails, Slider,
  Button, Paper, List, ListItem, ListItemText,
  IconButton, Rating
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { getAllRecipes } from '@services/recipeStorage';
import { Recipe, SearchFilters } from '@app-types';
import RecipeCard from '@components/RecipeCard';
import { getRecentSearches, saveSearch, removeSearch } from '@services/searchHistoryStorage';

const Search: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('dateAdded');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Advanced filters
  const [filters, setFilters] = useState<SearchFilters>({
    difficulty: [],
    maxTotalTime: 120,
    minRating: 0,
    dietaryRestrictions: [],
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches());
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const difficultyOptions = ['Easy', 'Medium', 'Hard'];
  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb', 'High-Protein'];

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const allRecipes = await getAllRecipes();
      setRecipes(allRecipes);

      // Extract unique tags
      const tags = Array.from(new Set(allRecipes.flatMap(r => r.tags)));
      setAllTags(tags);
      setError(null);
    } catch (err) {
      setError('Failed to load recipes');
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // Handle URL search parameters
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchTerm(queryParam);
      // Save the search to history when coming from URL
      saveSearch(queryParam, { ...filters, query: queryParam, tags: selectedTags });
      setRecentSearches(getRecentSearches());
    }
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    let filtered = [...recipes];

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(term))
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(r =>
        selectedTags.every(tag => r.tags.includes(tag))
      );
    }

    // Apply difficulty filter
    if (filters.difficulty && filters.difficulty.length > 0) {
      filtered = filtered.filter(r =>
        r.difficulty && filters.difficulty!.includes(r.difficulty)
      );
    }

    // Apply time filter
    if (filters.maxTotalTime && filters.maxTotalTime < 120) {
      filtered = filtered.filter(r => {
        const totalTime = parseInt(r.totalTime) || parseInt(r.prepTime) + parseInt(r.cookTime) || 0;
        return totalTime <= filters.maxTotalTime!;
      });
    }

    // Apply rating filter
    if (filters.minRating && filters.minRating > 0) {
      filtered = filtered.filter(r =>
        r.rating && r.rating >= filters.minRating!
      );
    }

    // Apply dietary restrictions filter
    if (filters.dietaryRestrictions && filters.dietaryRestrictions.length > 0) {
      filtered = filtered.filter(r =>
        filters.dietaryRestrictions!.some(restriction =>
          r.tags.some(tag => tag.toLowerCase().includes(restriction.toLowerCase()))
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'dateAdded') {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'prepTime') {
        const timeA = parseInt(a.prepTime) || 0;
        const timeB = parseInt(b.prepTime) || 0;
        return timeA - timeB;
      } else if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });

    setFilteredRecipes(filtered);
  }, [recipes, searchTerm, selectedTags, sortBy, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleRecipeDeleted = () => {
    fetchRecipes();
  };

  const handleRecipeUpdated = () => {
    fetchRecipes();
  };

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      saveSearch(searchTerm, { ...filters, query: searchTerm, tags: selectedTags });
      setRecentSearches(getRecentSearches());
    }
    setShowSearchSuggestions(false);
  };

  const handleRecentSearchClick = (searchQuery: string) => {
    setSearchTerm(searchQuery);
    setShowSearchSuggestions(false);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setFilters({
      difficulty: [],
      maxTotalTime: 120,
      minRating: 0,
      dietaryRestrictions: [],
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedTags.length > 0) count++;
    if (filters.difficulty && filters.difficulty.length > 0) count++;
    if (filters.maxTotalTime && filters.maxTotalTime < 120) count++;
    if (filters.minRating && filters.minRating > 0) count++;
    if (filters.dietaryRestrictions && filters.dietaryRestrictions.length > 0) count++;
    return count;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Search Recipes
      </Typography>



      {/* Filter Controls */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="sort-by-label">Sort By</InputLabel>
          <Select
            labelId="sort-by-label"
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="dateAdded">Date Added</MenuItem>
            <MenuItem value="title">Title A-Z</MenuItem>
            <MenuItem value="prepTime">Prep Time</MenuItem>
            <MenuItem value="rating">Rating</MenuItem>
          </Select>
        </FormControl>

        <Button
          startIcon={<FilterListIcon />}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          variant={getActiveFilterCount() > 0 ? 'contained' : 'outlined'}
          sx={{ minWidth: 'fit-content' }}
        >
          Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
        </Button>

        {getActiveFilterCount() > 0 && (
          <Button
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
            variant="outlined"
            color="secondary"
          >
            Clear All
          </Button>
        )}
      </Stack>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <Accordion expanded sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Advanced Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Difficulty Filter */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Difficulty Level
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {difficultyOptions.map(difficulty => (
                    <Chip
                      key={difficulty}
                      label={difficulty}
                      clickable
                      color={filters.difficulty?.includes(difficulty) ? "primary" : "default"}
                      onClick={() => {
                        const newDifficulty = filters.difficulty?.includes(difficulty)
                          ? filters.difficulty.filter(d => d !== difficulty)
                          : [...(filters.difficulty || []), difficulty];
                        setFilters({ ...filters, difficulty: newDifficulty });
                      }}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Time Filter */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Maximum Total Time: {filters.maxTotalTime} minutes
                </Typography>
                <Slider
                  value={filters.maxTotalTime || 120}
                  onChange={(_, value) => setFilters({ ...filters, maxTotalTime: value as number })}
                  min={15}
                  max={120}
                  step={15}
                  marks={[
                    { value: 15, label: '15m' },
                    { value: 30, label: '30m' },
                    { value: 60, label: '1h' },
                    { value: 120, label: '2h' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Grid>

              {/* Rating Filter */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Minimum Rating
                </Typography>
                <Rating
                  value={filters.minRating || 0}
                  onChange={(_, value) => setFilters({ ...filters, minRating: value || 0 })}
                  precision={0.5}
                />
              </Grid>

              {/* Dietary Restrictions */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Dietary Restrictions
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {dietaryOptions.map(option => (
                    <Chip
                      key={option}
                      label={option}
                      clickable
                      size="small"
                      color={filters.dietaryRestrictions?.includes(option) ? "primary" : "default"}
                      onClick={() => {
                        const newRestrictions = filters.dietaryRestrictions?.includes(option)
                          ? filters.dietaryRestrictions.filter(r => r !== option)
                          : [...(filters.dietaryRestrictions || []), option];
                        setFilters({ ...filters, dietaryRestrictions: newRestrictions });
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Filter by Tags:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {allTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                clickable
                color={selectedTags.includes(tag) ? "primary" : "default"}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(selectedTags.filter(t => t !== tag));
                  } else {
                    setSelectedTags([...selectedTags, tag]);
                  }
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>
      )}

      {/* Results Summary */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {loading ? 'Loading...' : `${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? 's' : ''} found`}
        </Typography>

        {searchTerm && (
          <Typography variant="body2" color="text.secondary">
            Searching for: "{searchTerm}"
          </Typography>
        )}
      </Box>

      {/* Results Grid */}
      <Grid container spacing={3}>
        {filteredRecipes.length > 0 ? (
          filteredRecipes.map(recipe => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
              <RecipeCard
                recipe={recipe}
                onDelete={handleRecipeDeleted}
                onUpdate={handleRecipeUpdated}
              />
            </Grid>
          ))
        ) : !loading ? (
          <Grid size={12}>
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No recipes found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Try adjusting your search criteria or filters to find more recipes.
              </Typography>
              {getActiveFilterCount() > 0 && (
                <Button
                  variant="outlined"
                  onClick={handleClearFilters}
                  startIcon={<ClearIcon />}
                >
                  Clear All Filters
                </Button>
              )}
            </Paper>
          </Grid>
        ) : (
          <Grid size={12}>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                Loading recipes...
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Search;
