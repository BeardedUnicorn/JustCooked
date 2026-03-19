import React, { useState } from 'react';
import {
  Card, CardContent, CardMedia, Typography, Box, Chip,
  CardActionArea, IconButton, CardActions, Dialog,
  DialogTitle, DialogContent, DialogActions, Button,
  Rating, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  FormControl, InputLabel, Select, TextField, Divider,
  CircularProgress, Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarIcon from '@mui/icons-material/Star';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';

import { Recipe, MealPlan, RecipeCollection } from '@app-types';
import { deleteRecipe, updateRecipe } from '@services/recipeStorage';
import { getAllMealPlans, createNewMealPlanRecipe, saveMealPlanRecipe } from '@services/mealPlanStorage';
import { getAllCollections, addRecipeToCollection } from '@services/recipeCollectionStorage';
import { useImageUrl } from '@hooks/useImageUrl';
import { calculateTotalTime, getTodayLocalDateString } from '@utils/timeUtils';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
  onUpdate?: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onDelete, onUpdate }) => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [selectedMealPlan, setSelectedMealPlan] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { imageUrl } = useImageUrl(recipe.image);

  // Helper functions
  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'Easy': return '#4CAF50';
      case 'Medium': return '#FF9800';
      case 'Hard': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const handleClick = () => {
    navigate(`/recipe/${recipe.id}`);
  };

  const handleCookNowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/recipe/${recipe.id}/cook`);
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updatedRecipe = { ...recipe, isFavorite: !recipe.isFavorite };
      await updateRecipe(updatedRecipe);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update favorite status:', error);
    }
  };

  const handleShareClick = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: `Check out this recipe: ${recipe.title}`,
          url: recipe.sourceUrl || window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(recipe.sourceUrl || window.location.href);
        // You could show a toast notification here
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };



  const handleShareMenuClick = () => {
    handleShareClick();
    handleMenuClose();
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteRecipe(recipe.id);
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert(`Failed to delete recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleAddToMealPlanClick = async () => {
    setLoading(true);
    setError('');
    try {
      const mealPlansData = await getAllMealPlans();
      setMealPlans(mealPlansData);
      setMealPlanDialogOpen(true);
      // Set default date to today
      setSelectedDate(getTodayLocalDateString());
      setSelectedMealType('dinner'); // Default meal type
    } catch (error) {
      console.error('Failed to load meal plans:', error);
      setError('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleAddToCollectionClick = async () => {
    setLoading(true);
    setError('');
    try {
      const collectionsData = await getAllCollections();
      setCollections(collectionsData);
      setCollectionDialogOpen(true);
    } catch (error) {
      console.error('Failed to load collections:', error);
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleConfirmAddToMealPlan = async () => {
    if (!selectedMealPlan || !selectedDate || !selectedMealType) {
      setError('Please select a meal plan, date, and meal type');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const mealPlanRecipe = createNewMealPlanRecipe(
        selectedMealPlan,
        recipe.id,
        selectedDate,
        selectedMealType,
        1.0 // Default serving multiplier
      );
      await saveMealPlanRecipe(mealPlanRecipe);
      setMealPlanDialogOpen(false);
      // Reset form
      setSelectedMealPlan('');
      setSelectedDate('');
      setSelectedMealType('');
    } catch (error) {
      console.error('Failed to add recipe to meal plan:', error);
      setError('Failed to add recipe to meal plan');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAddToCollection = async () => {
    if (!selectedCollection) {
      setError('Please select a collection');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addRecipeToCollection(selectedCollection, recipe.id);
      setCollectionDialogOpen(false);
      setSelectedCollection('');
    } catch (error) {
      console.error('Failed to add recipe to collection:', error);
      setError('Failed to add recipe to collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box data-testid={`recipe-card-${recipe.id}`}>
        <Card
          sx={{
            maxWidth: 345,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
            }
          }}>

          {/* Favorite IconButton */}
          <IconButton
            onClick={handleFavoriteClick}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              },
            }}
            size="small"
            data-testid={`recipe-card-${recipe.id}-favorite-button`}
          >
            {recipe.isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
          </IconButton>

          <Box sx={{ position: 'relative' }}>
            <CardActionArea onClick={handleClick} sx={{ flexGrow: 1 }} data-testid={`recipe-card-${recipe.id}-main-area`}>
              <CardMedia
                component="img"
                sx={{
                  height: 180,
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
                image={imageUrl}
                alt={recipe.title}
                data-testid={`recipe-card-${recipe.id}-image`}
              />

            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography
                gutterBottom
                variant="h6"
                component="div"
                data-testid={`recipeCard-text-title-${recipe.id}`}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                  flex: 1,
                  mr: 1,
                }}
              >
                {recipe.title}
              </Typography>

              {recipe.difficulty && (
                <Tooltip title={`Difficulty: ${recipe.difficulty}`}>
                  <Chip
                    size="small"
                    label={recipe.difficulty}
                    sx={{
                      backgroundColor: getDifficultyColor(recipe.difficulty),
                      color: 'white',
                      fontSize: '0.7rem',
                      height: '20px',
                    }}
                  />
                </Tooltip>
              )}
            </Box>

            {/* Rating */}
            {recipe.rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }} data-testid={`recipeCard-rating-${recipe.id}`}>
                <Rating
                  value={recipe.rating}
                  readOnly
                  size="small"
                  precision={0.5}
                  emptyIcon={<StarIcon style={{ opacity: 0.3 }} fontSize="inherit" />}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  ({recipe.rating})
                </Typography>
              </Box>
            )}

            <Typography
              variant="body2"
              color="text.secondary"
              data-testid={`recipeCard-text-description-${recipe.id}`}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                mb: 2,
                minHeight: '2.5em',
              }}
            >
              {recipe.description}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" data-testid={`recipeCard-text-time-${recipe.id}`}>
                {calculateTotalTime(recipe.prepTime, recipe.cookTime, recipe.totalTime) || 'Time not specified'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RestaurantIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" data-testid={`recipeCard-text-servings-${recipe.id}`}>
                {recipe.servings} servings
              </Typography>
            </Box>
          </CardContent>
          </CardActionArea>

          {/* Quick Action Overlay - moved outside CardActionArea */}
          <Box
            data-testid="cook-overlay"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 180, // Match CardMedia height
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.2s ease-in-out',
              pointerEvents: 'none', // Allow clicks to pass through when not hovered
              '&:hover': {
                opacity: 1,
                pointerEvents: 'auto', // Enable clicks when hovered
              },
            }}
          >
            <Tooltip title="Start Cooking">
              <IconButton
                onClick={handleCookNowClick}
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                }}
                aria-label="cook now"
                data-testid={`recipe-card-${recipe.id}-cook-button`}
              >
                <PlayArrowIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <CardActions sx={{ p: 1, pt: 0, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flexGrow: 1, minWidth: 0 }} data-testid={`recipeCard-container-tags-${recipe.id}`}>
            {recipe.tags.slice(0, 2).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                data-testid={`recipeCard-chip-tag-${recipe.id}-${tag}`}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {recipe.tags.length > 2 && (
              <Chip
                label={`+${recipe.tags.length - 2}`}
                size="small"
                variant="outlined"
                data-testid={`recipeCard-chip-tag-${recipe.id}-more`}
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Share recipe">
              <IconButton
                size="small"
                onClick={handleShareClick}
                aria-label="share recipe"
                data-testid={`recipe-card-${recipe.id}-share-button`}
                sx={{ color: 'text.secondary' }}
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="More options">
              <IconButton
                size="small"
                onClick={handleMenuClick}
                aria-label="more actions"
                data-testid={`recipe-card-${recipe.id}-more-button`}
                sx={{ color: 'text.secondary' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
        </Card>
      </Box>

      {/* More Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        data-testid={`recipe-card-${recipe.id}-menu`}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleShareMenuClick} data-testid={`recipe-card-${recipe.id}-menu-share`}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Recipe</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleAddToMealPlanClick} data-testid={`recipe-card-${recipe.id}-menu-add-to-meal-plan`}>
          <ListItemIcon>
            <CalendarTodayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to Meal Plan</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddToCollectionClick} data-testid={`recipe-card-${recipe.id}-menu-add-to-collection`}>
          <ListItemIcon>
            <CollectionsBookmarkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to Collection</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} data-testid={`recipe-card-${recipe.id}-menu-delete`}>
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Recipe</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        data-testid={`recipe-card-${recipe.id}-delete-dialog`}
      >
        <DialogTitle id="delete-dialog-title">Delete Recipe?</DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} autoFocus data-testid={`recipe-card-${recipe.id}-delete-cancel`}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" data-testid={`recipe-card-${recipe.id}-delete-confirm`}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Meal Plan Dialog */}
      <Dialog
        open={mealPlanDialogOpen}
        onClose={() => setMealPlanDialogOpen(false)}
        aria-labelledby="meal-plan-dialog-title"
        maxWidth="sm"
        fullWidth
        data-testid={`recipe-card-${recipe.id}-meal-plan-dialog`}
      >
        <DialogTitle id="meal-plan-dialog-title">Add "{recipe.title}" to Meal Plan</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Meal Plan</InputLabel>
            <Select
              value={selectedMealPlan}
              onChange={(e) => setSelectedMealPlan(e.target.value)}
              label="Meal Plan"
              data-testid={`recipe-card-${recipe.id}-meal-plan-select`}
            >
              {mealPlans.map((mealPlan) => (
                <MenuItem key={mealPlan.id} value={mealPlan.id}>
                  {mealPlan.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            margin="normal"
            label="Date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            data-testid={`recipe-card-${recipe.id}-date-input`}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Meal Type</InputLabel>
            <Select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value)}
              label="Meal Type"
              data-testid={`recipe-card-${recipe.id}-meal-type-select`}
            >
              <MenuItem value="breakfast">Breakfast</MenuItem>
              <MenuItem value="lunch">Lunch</MenuItem>
              <MenuItem value="dinner">Dinner</MenuItem>
              <MenuItem value="snacks">Snacks</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setMealPlanDialogOpen(false)}
            data-testid={`recipe-card-${recipe.id}-meal-plan-cancel`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAddToMealPlan}
            variant="contained"
            disabled={loading || !selectedMealPlan || !selectedDate || !selectedMealType}
            data-testid={`recipe-card-${recipe.id}-meal-plan-confirm`}
          >
            {loading ? <CircularProgress size={20} /> : 'Add to Meal Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Collection Dialog */}
      <Dialog
        open={collectionDialogOpen}
        onClose={() => setCollectionDialogOpen(false)}
        aria-labelledby="collection-dialog-title"
        maxWidth="sm"
        fullWidth
        data-testid={`recipe-card-${recipe.id}-collection-dialog`}
      >
        <DialogTitle id="collection-dialog-title">Add "{recipe.title}" to Collection</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Collection</InputLabel>
            <Select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              label="Collection"
              data-testid={`recipe-card-${recipe.id}-collection-select`}
            >
              {collections.map((collection) => (
                <MenuItem key={collection.id} value={collection.id}>
                  {collection.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCollectionDialogOpen(false)}
            data-testid={`recipe-card-${recipe.id}-collection-cancel`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAddToCollection}
            variant="contained"
            disabled={loading || !selectedCollection}
            data-testid={`recipe-card-${recipe.id}-collection-confirm`}
          >
            {loading ? <CircularProgress size={20} /> : 'Add to Collection'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RecipeCard;
