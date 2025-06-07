import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { RecipeCollection } from '@app-types';
import { Recipe } from '@app-types';
import {
  getCollectionById,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  saveCollection,
} from '@services/recipeCollectionStorage';
import { getAllRecipes } from '@services/recipeStorage';
import RecipeCard from '@components/RecipeCard';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<RecipeCollection | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addRecipeDialogOpen, setAddRecipeDialogOpen] = useState(false);
  
  // Form states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');

  useEffect(() => {
    loadCollection();
    loadAllRecipes();
  }, [id]);

  const loadCollection = async () => {
    if (!id) {
      setError('Collection ID is required');
      setLoading(false);
      return;
    }

    try {
      const collectionData = getCollectionById(id);
      if (!collectionData) {
        setError('Collection not found');
        setLoading(false);
        return;
      }

      setCollection(collectionData);
      setEditName(collectionData.name);
      setEditDescription(collectionData.description || '');

      // Load recipes in this collection
      const allRecipesData = await getAllRecipes();
      const collectionRecipes = allRecipesData.filter(recipe => 
        collectionData.recipeIds.includes(recipe.id)
      );
      setRecipes(collectionRecipes);
      setLoading(false);
    } catch (err) {
      setError('Failed to load collection');
      setLoading(false);
    }
  };

  const loadAllRecipes = async () => {
    try {
      const allRecipesData = await getAllRecipes();
      setAllRecipes(allRecipesData);
    } catch (err) {
      console.error('Failed to load all recipes:', err);
    }
  };

  const handleDeleteCollection = async () => {
    if (!collection) return;

    try {
      deleteCollection(collection.id);
      navigate('/collections');
    } catch (err) {
      setError('Failed to delete collection');
    }
    setDeleteDialogOpen(false);
  };

  const handleEditCollection = async () => {
    if (!collection) return;

    try {
      const updatedCollection: RecipeCollection = {
        ...collection,
        name: editName.trim(),
        description: editDescription.trim(),
      };
      
      saveCollection(updatedCollection);
      setCollection(updatedCollection);
      setEditDialogOpen(false);
    } catch (err) {
      setError('Failed to update collection');
    }
  };

  const handleAddRecipe = async () => {
    if (!collection || !selectedRecipe) return;

    try {
      addRecipeToCollection(collection.id, selectedRecipe.id);
      setRecipes(prev => [...prev, selectedRecipe]);
      setAddRecipeDialogOpen(false);
      setSelectedRecipe(null);
      setRecipeSearchTerm('');
    } catch (err) {
      setError('Failed to add recipe to collection');
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!collection) return;

    try {
      removeRecipeFromCollection(collection.id, recipeId);
      setRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
    } catch (err) {
      setError('Failed to remove recipe from collection');
    }
  };

  // Filter available recipes (not already in collection)
  const availableRecipes = allRecipes.filter(recipe => 
    !collection?.recipeIds.includes(recipe.id) &&
    recipe.title.toLowerCase().includes(recipeSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => navigate('/collections')} variant="outlined">
          Back to Collections
        </Button>
      </Box>
    );
  }

  if (!collection) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Collection not found
        </Alert>
        <Button onClick={() => navigate('/collections')} variant="outlined">
          Back to Collections
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {collection.name}
          </Typography>
          {collection.description && (
            <Typography variant="body1" color="text.secondary" paragraph>
              {collection.description}
            </Typography>
          )}
          <Chip 
            label={`${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`}
            variant="outlined"
            size="small"
          />
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddRecipeDialogOpen(true)}
          >
            Add Recipe
          </Button>
          <IconButton
            onClick={() => setEditDialogOpen(true)}
            aria-label="Edit collection"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => setDeleteDialogOpen(true)}
            color="error"
            aria-label="Delete collection"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Recipes Grid */}
      {recipes.length > 0 ? (
        <Grid container spacing={3}>
          {recipes.map((recipe) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={recipe.id}>
              <Box position="relative">
                <RecipeCard recipe={recipe} />
                <IconButton
                  onClick={() => handleRemoveRecipe(recipe.id)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    },
                  }}
                  size="small"
                  aria-label="Remove from collection"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes in this collection yet
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Start building your collection by adding some recipes!
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddRecipeDialogOpen(true)}
            >
              Add Your First Recipe
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Collection Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Collection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{collection.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteCollection} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleEditCollection} 
            variant="contained"
            disabled={!editName.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Recipe Dialog */}
      <Dialog open={addRecipeDialogOpen} onClose={() => setAddRecipeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Recipe to Collection</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availableRecipes}
            getOptionLabel={(option) => option.title}
            value={selectedRecipe}
            onChange={(_, newValue) => setSelectedRecipe(newValue)}
            inputValue={recipeSearchTerm}
            onInputChange={(_, newInputValue) => setRecipeSearchTerm(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for recipes"
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body1">{option.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.description || 'No description'}
                  </Typography>
                </Box>
              </Box>
            )}
            noOptionsText={
              recipeSearchTerm ? "No recipes found" : "Start typing to search for recipes"
            }
            sx={{ mt: 1 }}
          />
          {availableRecipes.length === 0 && !recipeSearchTerm && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              All available recipes are already in this collection.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddRecipeDialogOpen(false);
            setSelectedRecipe(null);
            setRecipeSearchTerm('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddRecipe} 
            variant="contained"
            disabled={!selectedRecipe}
          >
            Add Recipe
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CollectionView;
