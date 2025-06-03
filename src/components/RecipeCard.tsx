import React, { useState } from 'react';
import {
  Card, CardContent, CardMedia, Typography, Box, Chip,
  CardActionArea, IconButton, CardActions, Dialog,
  DialogTitle, DialogContent, DialogActions, Button,
  Rating, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText
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

import { Recipe } from '@app-types';
import { deleteRecipe, updateRecipe } from '@services/recipeStorage';
import { useImageUrl } from '@hooks/useImageUrl';
import { calculateTotalTime } from '@utils/timeUtils';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
  onUpdate?: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onDelete, onUpdate }) => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
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

  const handleFavoriteMenuClick = async () => {
    try {
      const updatedRecipe = { ...recipe, isFavorite: !recipe.isFavorite };
      await updateRecipe(updatedRecipe);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update favorite status:', error);
    }
    handleMenuClose();
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

  return (
    <>
      <Card sx={{
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
        {/* Favorite Badge */}
        {recipe.isFavorite && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              backgroundColor: 'rgba(244, 67, 54, 0.9)',
              borderRadius: '50%',
              p: 0.5,
            }}
          >
            <FavoriteIcon sx={{ color: 'white', fontSize: '1rem' }} />
          </Box>
        )}

        <CardActionArea onClick={handleClick} sx={{ flexGrow: 1 }}>
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              sx={{
                height: 180,
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              image={imageUrl}
              alt={recipe.title}
            />

            {/* Quick Action Overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease-in-out',
                '&:hover': {
                  opacity: 1,
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
                >
                  <PlayArrowIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <CardContent sx={{ flexGrow: 1, pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography gutterBottom variant="h6" component="div" sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.2,
                flex: 1,
                mr: 1,
              }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
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

            <Typography variant="body2" color="text.secondary" sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              mb: 2,
              minHeight: '2.5em',
            }}>
              {recipe.description}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {calculateTotalTime(recipe.prepTime, recipe.cookTime, recipe.totalTime) || 'Time not specified'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RestaurantIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {recipe.servings} servings
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>

        <CardActions sx={{ p: 1, pt: 0, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flexGrow: 1, minWidth: 0 }}>
            {recipe.tags.slice(0, 2).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {recipe.tags.length > 2 && (
              <Chip
                label={`+${recipe.tags.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}>
              <IconButton
                size="small"
                onClick={handleFavoriteClick}
                aria-label={recipe.isFavorite ? "remove from favorites" : "add to favorites"}
                sx={{
                  color: recipe.isFavorite ? 'error.main' : 'text.secondary',
                  '&:hover': {
                    color: recipe.isFavorite ? 'error.dark' : 'error.light',
                  },
                }}
              >
                {recipe.isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Share recipe">
              <IconButton
                size="small"
                onClick={handleShareClick}
                aria-label="share recipe"
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
                sx={{ color: 'text.secondary' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </Card>

      {/* More Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleFavoriteMenuClick}>
          <ListItemIcon>
            {recipe.isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{recipe.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShareMenuClick}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Recipe</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
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
      >
        <DialogTitle id="delete-dialog-title">Delete Recipe?</DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} autoFocus>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RecipeCard;
