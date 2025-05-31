import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Grid, InputAdornment, Chip,
  FormControl, InputLabel, Select, MenuItem, Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getAllRecipes } from '../services/recipeStorage';
import { Recipe } from '../types/recipe';
import RecipeCard from '../components/RecipeCard';

const Search: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('dateAdded');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      const allRecipes = await getAllRecipes();
      setRecipes(allRecipes);

      // Extract unique tags
      const tags = Array.from(new Set(allRecipes.flatMap(r => r.tags)));
      setAllTags(tags);
    };

    fetchRecipes();
  }, []);

  useEffect(() => {
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

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'dateAdded') {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'prepTime') {
        return parseInt(a.prepTime) - parseInt(b.prepTime);
      }
      return 0;
    });

    setFilteredRecipes(filtered);
  }, [recipes, searchTerm, selectedTags, sortBy]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Search Recipes
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
        <TextField
          label="Search"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

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
          </Select>
        </FormControl>
      </Stack>

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

      <Grid container spacing={3}>
        {filteredRecipes.length > 0 ? (
          filteredRecipes.map(recipe => (
            <Grid item xs={12} sm={6} md={4} key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </Grid>
          ))
        ) : (
          <Box sx={{ textAlign: 'center', width: '100%', py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              No recipes found. Try adjusting your search criteria.
            </Typography>
          </Box>
        )}
      </Grid>
    </Box>
  );
};

export default Search;
