import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Chip, Grid, Paper, List, ListItem, ListItemText,
  Divider, Stack, Button, IconButton, TextField, CircularProgress, Snackbar, Alert
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PublicIcon from '@mui/icons-material/Public';
import EditIcon from '@mui/icons-material/Edit';
import PrepTimeIcon from '@mui/icons-material/Schedule';
import CookTimeIcon from '@mui/icons-material/Whatshot';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Recipe } from '@app-types';
import { useImageUrl } from '@hooks/useImageUrl';
import { formatTimeForDisplay, calculateTotalTime } from '@utils/timeUtils';
import { scaleIngredients, isValidServingSize, getScalingDescription } from '@utils/servingUtils';
import SectionedIngredients from '@components/SectionedIngredients';
import { invoke } from '@tauri-apps/api/core';
import { reImportRecipe } from '@services/recipeImport';

interface RecipeDetailProps {
  recipe: Recipe;
  onEdit?: () => void;
  onRecipeUpdated?: (updatedRecipe: Recipe) => void;
}

const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe, onEdit, onRecipeUpdated }) => {
  const { imageUrl } = useImageUrl(recipe.image);

  // State for serving size adjustment
  const [currentServings, setCurrentServings] = useState(recipe.servings || 1);

  // State for re-import functionality
  const [reImportLoading, setReImportLoading] = useState(false);
  const [reImportSuccess, setReImportSuccess] = useState(false);
  const [reImportError, setReImportError] = useState<string | null>(null);

  // Calculate scaled ingredients based on current serving size
  const scaledIngredients = useMemo(() => {
    return scaleIngredients(recipe.ingredients, recipe.servings || 1, currentServings);
  }, [recipe.ingredients, recipe.servings, currentServings]);

  const handleServingsChange = (newServings: number) => {
    if (isValidServingSize(newServings)) {
      setCurrentServings(newServings);
    }
  };

  const incrementServings = () => {
    const newValue = currentServings + 1;
    if (newValue <= 50) { // Reasonable upper limit
      setCurrentServings(newValue);
    }
  };

  const decrementServings = () => {
    const newValue = currentServings - 1;
    if (newValue >= 1) { // Minimum 1 serving
      setCurrentServings(newValue);
    }
  };

  const handleOpenSourceUrl = async () => {
    if (!recipe.sourceUrl) return;

    try {
      await invoke('open_external_url', { url: recipe.sourceUrl });
    } catch (error) {
      console.error('Failed to open external URL:', error);
      // Fallback to window.open for development or if Tauri command fails
      window.open(recipe.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleReImportRecipe = async () => {
    if (!recipe.sourceUrl || !recipe.id) return;

    setReImportLoading(true);
    setReImportError(null);

    try {
      await reImportRecipe(recipe.id, recipe.sourceUrl);
      setReImportSuccess(true);

      // If callback provided, fetch updated recipe and notify parent
      if (onRecipeUpdated) {
        try {
          const updatedRecipe = await invoke<Recipe>('db_get_recipe_by_id', { id: recipe.id });
          if (updatedRecipe) {
            onRecipeUpdated(updatedRecipe);
          }
        } catch (error) {
          console.warn('Failed to fetch updated recipe:', error);
          // Success notification will still show, but parent won't be notified
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to re-import recipe';
      setReImportError(errorMessage);
      console.error('Re-import failed:', error);
    } finally {
      setReImportLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'center', md: 'flex-start' },
        gap: 4,
        mb: 4
      }}>
        {/* Image */}
        <Box
          component="img"
          src={imageUrl}
          alt={recipe.title}
          data-testid={`recipeDetail-image-${recipe.id}`}
          sx={{
            width: { xs: '100%', md: '40%' },
            maxWidth: '400px',
            borderRadius: 2,
            boxShadow: 3
          }}
        />

        {/* Title and meta */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom data-testid={`recipeDetail-text-title-${recipe.id}`}>
            {recipe.title}
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph data-testid={`recipeDetail-text-description-${recipe.id}`}>
            {recipe.description}
          </Typography>

          <Stack direction="row" spacing={3} sx={{ mb: 3, flexWrap: 'wrap' }}>
            {/* Prep Time */}
            {recipe.prepTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }} data-testid={`recipeDetail-text-prepTime-${recipe.id}`}>
                <PrepTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Prep Time
                  </Typography>
                  <Typography variant="body1">
                    {formatTimeForDisplay(recipe.prepTime)}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Cook Time */}
            {recipe.cookTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }} data-testid={`recipeDetail-text-cookTime-${recipe.id}`}>
                <CookTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Cook Time
                  </Typography>
                  <Typography variant="body1">
                    {formatTimeForDisplay(recipe.cookTime)}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Total Time */}
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }} data-testid={`recipeDetail-text-totalTime-${recipe.id}`}>
              <AccessTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Time
                </Typography>
                <Typography variant="body1">
                  {calculateTotalTime(recipe.prepTime, recipe.cookTime, recipe.totalTime) || 'Not specified'}
                </Typography>
              </Box>
            </Box>

            {/* Servings with adjustment controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
              <RestaurantIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Servings
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={decrementServings}
                    disabled={currentServings <= 1}
                    aria-label="decrease servings"
                    data-testid="recipe-detail-decrease-servings"
                    sx={{
                      width: 28,
                      height: 28,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    value={currentServings}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        handleServingsChange(value);
                      }
                    }}
                    size="small"
                    data-testid="recipe-detail-servings-input"
                    sx={{
                      width: 60,
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        py: 0.5
                      }
                    }}
                    inputProps={{
                      min: 1,
                      max: 50,
                      type: 'number'
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={incrementServings}
                    disabled={currentServings >= 50}
                    aria-label="increase servings"
                    data-testid="recipe-detail-increase-servings"
                    sx={{
                      width: 28,
                      height: 28,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                {currentServings !== (recipe.servings || 1) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {getScalingDescription(recipe.servings || 1, currentServings)}
                  </Typography>
                )}
              </Box>
            </Box>
          </Stack>

          <Box sx={{ mb: 3 }} data-testid={`recipeDetail-container-tags-${recipe.id}`}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {recipe.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" data-testid={`recipeDetail-chip-tag-${recipe.id}-${tag}`} />
              ))}
            </Box>
          </Box>

          {recipe.sourceUrl && recipe.sourceUrl.trim() !== '' && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PublicIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Source:
              </Typography>
              <Button
                onClick={handleOpenSourceUrl}
                startIcon={<LaunchIcon fontSize="small" />}
                sx={{
                  ml: 0.5,
                  p: 0.5,
                  textTransform: 'none',
                  fontWeight: 'normal',
                  fontSize: '0.875rem',
                  minHeight: 'auto'
                }}
                data-testid="recipe-detail-source-link"
                aria-label={`Open recipe source at ${new URL(recipe.sourceUrl).hostname.replace('www.', '')}`}
              >
                {new URL(recipe.sourceUrl).hostname.replace('www.', '')}
              </Button>
            </Box>
          )}

          {(onEdit || (recipe.sourceUrl && recipe.sourceUrl.trim() !== '')) && (
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              {onEdit && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={onEdit}
                  data-testid="recipe-detail-edit-button"
                >
                  Edit
                </Button>
              )}
              {recipe.sourceUrl && recipe.sourceUrl.trim() !== '' && (
                <Button
                  variant="outlined"
                  startIcon={reImportLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={handleReImportRecipe}
                  disabled={reImportLoading}
                  data-testid="recipe-detail-reimport-button"
                >
                  {reImportLoading ? 'Re-importing...' : 'Re-import Recipe'}
                </Button>
              )}
            </Stack>
          )}
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Ingredients */}
        <Grid size={{xs: 12, md: 4}}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Ingredients
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <SectionedIngredients
              ingredients={scaledIngredients}
              data-testid="recipe-detail-ingredients"
            />
          </Paper>
        </Grid>

        {/* Instructions */}
        <Grid size={{xs: 12, md: 8}}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Instructions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {recipe.instructions.map((instruction, index) => (
                <ListItem key={index} alignItems="flex-start" sx={{ py: 1.5 }} data-testid={`recipeDetail-listItem-instruction-${index}`}>
                  <Box
                    sx={{
                      minWidth: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      mt: 0.3,
                      fontSize: '0.875rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {index + 1}
                  </Box>
                  <ListItemText primary={instruction} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Success Snackbar */}
      <Snackbar
        open={reImportSuccess}
        autoHideDuration={5000}
        onClose={() => setReImportSuccess(false)}
        data-testid="recipe-detail-reimport-success-snackbar"
      >
        <Alert
          onClose={() => setReImportSuccess(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          Recipe re-imported successfully!
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!reImportError}
        autoHideDuration={8000}
        onClose={() => setReImportError(null)}
        data-testid="recipe-detail-reimport-error-snackbar"
      >
        <Alert
          onClose={() => setReImportError(null)}
          severity="error"
          sx={{ width: '100%' }}
        >
          {reImportError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecipeDetail;
