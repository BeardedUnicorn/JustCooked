import React, { useState } from 'react';
import {
  Card, CardContent, CardMedia, Typography, Box, Chip,
  CardActionArea, IconButton, CardActions, Dialog,
  DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Recipe } from '@app-types/recipe';
import { deleteRecipe } from '@services/recipeStorage';
import { useImageUrl } from '@hooks/useImageUrl';
import { calculateTotalTime } from '@utils/timeUtils';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onDelete }) => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const imageUrl = useImageUrl(recipe.image);

  const handleClick = () => {
    navigate(`/recipe/${recipe.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setDeleteDialogOpen(true);
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
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
        }
      }}>
        <CardActionArea onClick={handleClick}>
          <CardMedia
            component="img"
            height="180"
            image={imageUrl}
            alt={recipe.title}
          />
          <CardContent sx={{ flexGrow: 1 }}>
            <Typography gutterBottom variant="h6" component="div" noWrap>
              {recipe.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              mb: 2
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

        <CardActions sx={{ p: 1, pt: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flexGrow: 1 }}>
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
          <IconButton size="small" aria-label="add to favorites">
            <FavoriteBorderIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="delete recipe"
            onClick={handleDeleteClick}
            sx={{ color: 'error.light' }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </CardActions>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Recipe</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RecipeCard;
