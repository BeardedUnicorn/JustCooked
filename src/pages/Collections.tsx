import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Collections as CollectionsIcon,
} from '@mui/icons-material';
import { RecipeCollection } from '@app-types';
import {
  getAllCollections,
  createCollection,
  deleteCollection,
  saveCollection,
} from '@services/recipeCollectionStorage';

const Collections: React.FC = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form states
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingCollection, setEditingCollection] = useState<RecipeCollection | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<RecipeCollection | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const collectionsData = await getAllCollections();
      // Sort by date modified (most recent first)
      const sortedCollections = collectionsData.sort((a, b) => 
        new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime()
      );
      setCollections(sortedCollections);
      setError(null);
    } catch (err) {
      setError('Failed to load collections');
      console.error('Error loading collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const newCollection = await createCollection(
        newCollectionName.trim(),
        newCollectionDescription.trim() || undefined
      );
      setCollections(prev => [newCollection, ...prev]);
      setCreateDialogOpen(false);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setError(null);
    } catch (err) {
      setError('Failed to create collection');
      console.error('Error creating collection:', err);
    }
  };

  const handleEditCollection = async () => {
    if (!editingCollection || !editName.trim()) return;

    try {
      const updatedCollection: RecipeCollection = {
        ...editingCollection,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      };
      
      await saveCollection(updatedCollection);
      setCollections(prev => 
        prev.map(col => col.id === updatedCollection.id ? updatedCollection : col)
      );
      setEditDialogOpen(false);
      setEditingCollection(null);
      setEditName('');
      setEditDescription('');
      setError(null);
    } catch (err) {
      setError('Failed to update collection');
      console.error('Error updating collection:', err);
    }
  };

  const handleDeleteCollection = async () => {
    if (!deletingCollection) return;

    try {
      await deleteCollection(deletingCollection.id);
      setCollections(prev => prev.filter(col => col.id !== deletingCollection.id));
      setDeleteDialogOpen(false);
      setDeletingCollection(null);
      setError(null);
    } catch (err) {
      setError('Failed to delete collection');
      console.error('Error deleting collection:', err);
    }
  };

  const openEditDialog = (collection: RecipeCollection) => {
    setEditingCollection(collection);
    setEditName(collection.name);
    setEditDescription(collection.description || '');
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (collection: RecipeCollection) => {
    setDeletingCollection(collection);
    setDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Collections
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          data-testid="collections-add-button"
        >
          Add Collection
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Collections Grid */}
      {collections.length > 0 ? (
        <Grid container spacing={3}>
          {collections.map((collection) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={collection.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate(`/collections/${collection.id}`)}
                data-testid={`collection-card-${collection.id}`}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" mb={2}>
                    <CollectionsIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" component="h2" noWrap>
                      {collection.name}
                    </Typography>
                  </Box>
                  
                  {collection.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {collection.description}
                    </Typography>
                  )}
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Chip
                      label={`${collection.recipeIds.length} recipe${collection.recipeIds.length !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(collection.dateModified)}
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(collection);
                    }}
                    aria-label="Edit collection"
                    data-testid={`collection-${collection.id}-edit-button`}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(collection);
                    }}
                    aria-label="Delete collection"
                    data-testid={`collection-${collection.id}-delete-button`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CollectionsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom>
              No collections yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Create your first collection to organize your favorite recipes!
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              data-testid="collections-create-first-button"
            >
              Create Collection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="add collection"
        data-testid="collections-fab-button"
        sx={{
          position: 'fixed',
          bottom: 80, // Above bottom navigation on mobile
          right: 16,
          display: { xs: 'flex', md: 'none' }, // Only show on mobile
        }}
        onClick={() => setCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Create Collection Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth data-testid="collections-create-dialog">
        <DialogTitle>Create New Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="e.g., Weeknight Dinners, Holiday Desserts"
            data-testid="collections-create-name-input"
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            placeholder="Describe what this collection is for..."
            data-testid="collections-create-description-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewCollectionName('');
            setNewCollectionDescription('');
          }} data-testid="collections-create-cancel-button">
            Cancel
          </Button>
          <Button
            onClick={handleCreateCollection}
            variant="contained"
            disabled={!newCollectionName.trim()}
            data-testid="collections-create-submit-button"
          >
            Create Collection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth data-testid="collections-edit-dialog">
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
            data-testid="collections-edit-name-input"
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
            data-testid="collections-edit-description-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditingCollection(null);
            setEditName('');
            setEditDescription('');
          }} data-testid="collections-edit-cancel-button">
            Cancel
          </Button>
          <Button
            onClick={handleEditCollection}
            variant="contained"
            disabled={!editName.trim()}
            data-testid="collections-edit-submit-button"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Collection Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} data-testid="collections-delete-dialog">
        <DialogTitle>Delete Collection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deletingCollection?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialogOpen(false);
            setDeletingCollection(null);
          }} data-testid="collections-delete-cancel-button">
            Cancel
          </Button>
          <Button onClick={handleDeleteCollection} color="error" variant="contained" data-testid="collections-delete-confirm-button">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Collections;
