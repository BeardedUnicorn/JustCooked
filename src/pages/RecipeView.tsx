import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, CircularProgress, Button, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PrintIcon from '@mui/icons-material/Print';
import RecipeDetail from '@components/RecipeDetail';
import { getRecipeById, deleteRecipe } from '@services/recipeStorage';
import { Recipe } from '@app-types';

const RecipeView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) {
        setError('Recipe ID is missing');
        setLoading(false);
        return;
      }

      try {
        const recipeData = await getRecipeById(id);
        if (recipeData) {
          setRecipe(recipeData);
        } else {
          setError('Recipe not found');
        }
      } catch (err) {
        setError('Failed to load recipe');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteRecipe(id);
      navigate('/search');
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      alert('Failed to delete recipe');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartCooking = () => {
    if (id) {
      navigate(`/recipe/${id}/cook`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error">{error || 'Recipe not found'}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        gap: 2
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          data-testid="recipe-view-back-button"
        >
          Back
        </Button>

        <Box sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-end' }
        }}>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleStartCooking}
            size="large"
            aria-label="start cooking mode"
            data-testid="recipe-view-start-cooking-button"
          >
            Start Cooking
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            data-testid="recipe-view-print-button"
          >
            Print
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
            data-testid="recipe-view-delete-button"
          >
            Delete
          </Button>
        </Box>
      </Box>

      <RecipeDetail recipe={recipe} />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        data-testid="recipe-view-delete-dialog"
      >
        <DialogTitle>Delete Recipe</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} data-testid="recipe-view-delete-cancel">Cancel</Button>
          <Button onClick={handleDelete} color="error" data-testid="recipe-view-delete-confirm">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecipeView;
