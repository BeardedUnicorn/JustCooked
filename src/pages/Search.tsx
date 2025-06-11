import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Grid, InputAdornment, Chip,
  FormControl, InputLabel, Select, MenuItem, Stack, Alert,
  Accordion, AccordionSummary, AccordionDetails, Slider,
  Button, Paper, List, ListItem, ListItemText,
  IconButton, Rating,
  ListItemButton, CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { getRecipesPaginated, getRecipeCount, searchRecipesPaginated, getSearchRecipesCount } from '@services/recipeStorage';
import { Recipe, SearchFilters } from '@app-types';
import RecipeCard from '@components/RecipeCard';
import { getRecentSearches, saveSearch, removeSearch } from '@services/searchHistoryStorage';

const PAGE_SIZE = 24; // Number of recipes per page

const Search: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('dateAdded');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Advanced filters
  const [filters, setFilters] = useState<SearchFilters>({
    difficulty: [],
    maxTotalTime: 120,
    minRating: 0,
    dietaryRestrictions: [],
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const difficultyOptions = ['Easy', 'Medium', 'Hard'];
  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb', 'High-Protein'];

  // Load recent searches
  useEffect(() => {
    const loadRecentSearches = async () => {
      const searches = await getRecentSearches();
      setRecentSearches(searches);
    };
    loadRecentSearches();
  }, []);

  const fetchRecipes = async (page: number = 1, isLoadMore: boolean = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setRecipes([]);
        setCurrentPage(1);
      } else {
        setLoadingMore(true);
      }

      let newRecipes: Recipe[] = [];
      let count = 0;

      if (searchTerm.trim()) {
        // Search with pagination
        newRecipes = await searchRecipesPaginated(searchTerm, page, PAGE_SIZE);
        count = await getSearchRecipesCount(searchTerm);
      } else {
        // Get all recipes with pagination
        newRecipes = await getRecipesPaginated(page, PAGE_SIZE);
        count = await getRecipeCount();
      }

      if (isLoadMore) {
        setRecipes(prev => [...prev, ...newRecipes]);
      } else {
        setRecipes(newRecipes);
        // Extract unique tags from first page for tag filtering
        const tags = Array.from(new Set(newRecipes.flatMap((r: Recipe) => r.tags)));
        setAllTags(tags);
      }

      setTotalCount(count);
      setHasMore(newRecipes.length === PAGE_SIZE && (page * PAGE_SIZE) < count);
      setCurrentPage(page);
      setError(null);
    } catch (err) {
      setError('Failed to load recipes');
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [searchTerm]);

  // Handle URL search parameters
  useEffect(() => {
    const queryParam = searchParams.get('q');
    const tagParam = searchParams.get('tag');
    
    if (queryParam) {
      setSearchTerm(queryParam);
      // Save the search to history when coming from URL
      saveSearch(queryParam, { ...filters, query: queryParam, tags: selectedTags });
      const loadRecentSearches = async () => {
        const searches = await getRecentSearches();
        setRecentSearches(searches);
      };
      loadRecentSearches();
    }
    
    if (tagParam && !selectedTags.includes(tagParam)) {
      setSelectedTags(prev => [...prev, tagParam]);
    }
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    if (!recipes || !Array.isArray(recipes)) {
      setFilteredRecipes([]);
      return;
    }
    
    let filtered = [...recipes];

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((r: Recipe) =>
        selectedTags.every(tag => r.tags.includes(tag))
      );
    }

    // Apply difficulty filter
    if (filters.difficulty && filters.difficulty.length > 0) {
      filtered = filtered.filter((r: Recipe) =>
        r.difficulty && filters.difficulty!.includes(r.difficulty)
      );
    }

    // Apply time filter
    if (filters.maxTotalTime && filters.maxTotalTime < 120) {
      filtered = filtered.filter((r: Recipe) => {
        const totalTime = parseInt(r.totalTime) || parseInt(r.prepTime) + parseInt(r.cookTime) || 0;
        return totalTime <= filters.maxTotalTime!;
      });
    }

    // Apply rating filter
    if (filters.minRating && filters.minRating > 0) {
      filtered = filtered.filter((r: Recipe) =>
        r.rating && r.rating >= filters.minRating!
      );
    }

    // Apply dietary restrictions filter
    if (filters.dietaryRestrictions && filters.dietaryRestrictions.length > 0) {
      filtered = filtered.filter((r: Recipe) =>
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
  }, [recipes, selectedTags, sortBy, filters]);

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
      const loadRecentSearches = async () => {
        const searches = await getRecentSearches();
        setRecentSearches(searches);
      };
      loadRecentSearches();
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

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      fetchRecipes(currentPage + 1, true);
    }
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
      {/* Search Input */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search recipes, ingredients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          onFocus={() => setShowSearchSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)} // Delay to allow click on suggestion
          data-testid="search-page-input"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} aria-label="clear search" data-testid="search-page-clear-button">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {showSearchSuggestions && recentSearches.length > 0 && (
          <Paper sx={{ position: 'absolute', zIndex: 1, width: '100%', mt: 1 }}>
            <List dense>
              <ListItem>
                <Typography variant="caption" color="text.secondary">
                  <HistoryIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Recent Searches
                </Typography>
              </ListItem>
              {recentSearches.map((search: any) => (
                <ListItem
                  key={search.id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSearch(search.id);
                        const loadRecentSearches = async () => {
                          const searches = await getRecentSearches();
                          setRecentSearches(searches);
                        };
                        loadRecentSearches();
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => handleRecentSearchClick(search.query)}>
                    <ListItemText primary={search.query} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>

      {/* Filter Controls */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="sort-by-label">Sort By</InputLabel>
          <Select
            labelId="sort-by-label"
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value)}
            data-testid="search-sort-select"
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
          data-testid="search-filters-button"
        >
          Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
        </Button>

        {(getActiveFilterCount() > 0 || searchTerm) && (
          <Button
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
            variant="outlined"
            color="secondary"
            data-testid="search-clear-all-button"
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
          {loading ? 'Loading...' : `${filteredRecipes.length} of ${totalCount} recipe${totalCount !== 1 ? 's' : ''} shown`}
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
              {(getActiveFilterCount() > 0 || searchTerm) && (
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
              <CircularProgress />
              <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                Loading recipes...
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Load More Button */}
      {hasMore && filteredRecipes.length > 0 && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleLoadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={20} /> : undefined}
            data-testid="search-load-more-button"
          >
            {loadingMore ? 'Loading...' : 'Load More Recipes'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Search;
