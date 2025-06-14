import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  InputAdornment,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import { Recipe, MEAL_TYPES, getMealTypeDisplayName } from '@app-types';
import { getAllRecipes } from '@services/recipeStorage';
import { createNewMealPlanRecipe, saveMealPlanRecipe } from '@services/mealPlanStorage';

interface RecipeAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  mealPlanId: string;
  selectedDate: string;
  selectedMealType?: string;
  enabledMealTypes: string[];
  onRecipeAssigned: () => void;
}

const RecipeAssignmentDialog: React.FC<RecipeAssignmentDialogProps> = ({
  open,
  onClose,
  mealPlanId,
  selectedDate,
  selectedMealType,
  enabledMealTypes,
  onRecipeAssigned,
}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [mealType, setMealType] = useState(selectedMealType || enabledMealTypes[0] || MEAL_TYPES.DINNER);
  const [servingMultiplier, setServingMultiplier] = useState(1.0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadRecipes();
      setSelectedRecipe(null);
      setSearchQuery('');
      setMealType(selectedMealType || enabledMealTypes[0] || MEAL_TYPES.DINNER);
      setServingMultiplier(1.0);
      setNotes('');
      setError(null);
    }
  }, [open, selectedMealType, enabledMealTypes]);

  useEffect(() => {
    filterRecipes();
  }, [recipes, searchQuery]);

  const loadRecipes = async () => {
    try {
      const allRecipes = await getAllRecipes();
      setRecipes(allRecipes);
    } catch (err) {
      setError('Failed to load recipes');
      console.error('Error loading recipes:', err);
    }
  };

  const filterRecipes = () => {
    if (!searchQuery.trim()) {
      setFilteredRecipes(recipes);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = recipes.filter(recipe =>
      recipe.title.toLowerCase().includes(query) ||
      recipe.description?.toLowerCase().includes(query) ||
      recipe.tags.some(tag => tag.toLowerCase().includes(query)) ||
      recipe.ingredients.some(ingredient => 
        ingredient.name.toLowerCase().includes(query)
      )
    );
    setFilteredRecipes(filtered);
  };

  const handleAssignRecipe = async () => {
    if (!selectedRecipe) return;

    try {
      setLoading(true);
      const mealPlanRecipe = createNewMealPlanRecipe(
        mealPlanId,
        selectedRecipe.id,
        selectedDate,
        mealType,
        servingMultiplier,
        notes || undefined
      );

      await saveMealPlanRecipe(mealPlanRecipe);
      onRecipeAssigned();
      onClose();
    } catch (err) {
      setError('Failed to assign recipe to meal plan');
      console.error('Error assigning recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRecipeImageUrl = (recipe: Recipe) => {
    if (recipe.image) {
      return recipe.image;
    }
    return undefined;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid="recipe-assignment-dialog"
    >
      <DialogTitle>
        <Box>
          <Typography variant="h6" component="div">
            Assign Recipe to Meal Plan
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(selectedDate)} • {getMealTypeDisplayName(mealType)}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Meal Type and Serving Controls */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Meal Type</InputLabel>
              <Select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                label="Meal Type"
                data-testid="recipe-assignment-meal-type-select"
              >
                {enabledMealTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {getMealTypeDisplayName(type)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Serving Multiplier"
              type="number"
              value={servingMultiplier}
              onChange={(e) => setServingMultiplier(parseFloat(e.target.value) || 1.0)}
              inputProps={{ min: 0.1, max: 10, step: 0.1 }}
              sx={{ width: 150 }}
              data-testid="recipe-assignment-serving-multiplier-input"
            />
          </Box>

          {/* Recipe Search */}
          <TextField
            label="Search Recipes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setSearchQuery('')}
                    edge="end"
                    size="small"
                    data-testid="recipe-search-clear-button"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            data-testid="recipe-search-input"
          />

          {/* Recipe Selection */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredRecipes.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <RestaurantIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  {searchQuery ? 'No recipes found matching your search' : 'No recipes available'}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {filteredRecipes.map((recipe) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={recipe.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: selectedRecipe?.id === recipe.id ? 2 : 1,
                        borderColor: selectedRecipe?.id === recipe.id ? 'primary.main' : 'divider',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          transition: 'transform 0.2s ease-in-out',
                        },
                      }}
                      onClick={() => setSelectedRecipe(recipe)}
                      data-testid={`recipe-card-${recipe.id}`}
                    >
                      {getRecipeImageUrl(recipe) && (
                        <CardMedia
                          component="img"
                          height="120"
                          image={getRecipeImageUrl(recipe)}
                          alt={recipe.title}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 'medium', mb: 1 }}>
                          {recipe.title}
                        </Typography>
                        
                        {recipe.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {recipe.description}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {recipe.tags.slice(0, 3).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ))}
                          {recipe.tags.length > 3 && (
                            <Chip
                              label={`+${recipe.tags.length - 3}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                        </Box>

                        <Typography variant="caption" color="text.secondary">
                          {recipe.servings} servings • {recipe.prepTime || 'N/A'} prep • {recipe.cookTime || 'N/A'} cook
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>

          {/* Notes */}
          <TextField
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Add any notes about this meal assignment..."
            data-testid="recipe-assignment-notes-input"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} data-testid="recipe-assignment-cancel-button">
          Cancel
        </Button>
        <Button
          onClick={handleAssignRecipe}
          variant="contained"
          disabled={!selectedRecipe || loading}
          data-testid="recipe-assignment-assign-button"
        >
          {loading ? 'Assigning...' : 'Assign Recipe'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipeAssignmentDialog;
