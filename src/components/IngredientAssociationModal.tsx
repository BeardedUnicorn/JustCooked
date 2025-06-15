import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { IngredientDatabase } from '@app-types/ingredientDatabase';
import { IngredientAssociation } from '@app-types/productIngredientMapping';

interface IngredientAssociationModalProps {
  open: boolean;
  onClose: () => void;
  onAssociate: (association: IngredientAssociation | null) => void;
  productName: string;
}

const IngredientAssociationModal: React.FC<IngredientAssociationModalProps> = ({
  open,
  onClose,
  onAssociate,
  productName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientDatabase[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientDatabase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        const results = await invoke<IngredientDatabase[]>('db_search_ingredients', {
          query: searchQuery.trim(),
          limit: 20,
        });
        
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search ingredients:', err);
        setError('Failed to search ingredients. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Auto-search based on product name when modal opens
  useEffect(() => {
    if (open && productName) {
      setSearchQuery(productName);
    }
  }, [open, productName]);

  const handleIngredientSelect = (ingredient: IngredientDatabase) => {
    setSelectedIngredient(ingredient);
  };

  const handleAssociate = () => {
    if (selectedIngredient) {
      onAssociate({
        ingredient_id: selectedIngredient.id,
        ingredient_name: selectedIngredient.name,
      });
    } else {
      onAssociate(null);
    }
    handleClose();
  };

  const handleSkip = () => {
    onAssociate(null);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedIngredient(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      data-testid="ingredient-association-modal"
    >
      <DialogTitle>
        Associate Ingredient
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Associate "{productName}" with an ingredient from your database to improve recipe matching.
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="Search ingredients"
          placeholder="e.g., flour, sugar, milk"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          margin="normal"
          data-testid="ingredient-search-input"
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {searchResults.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Search Results ({searchResults.length})
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {searchResults.map((ingredient) => (
                <ListItem key={ingredient.id} disablePadding>
                  <ListItemButton
                    selected={selectedIngredient?.id === ingredient.id}
                    onClick={() => handleIngredientSelect(ingredient)}
                    data-testid={`ingredient-result-${ingredient.id}`}
                  >
                    <ListItemText
                      primary={ingredient.name}
                      secondary={ingredient.category}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {searchQuery.trim() && !loading && searchResults.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No ingredients found for "{searchQuery}". Try a different search term.
          </Typography>
        )}

        {selectedIngredient && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Ingredient
            </Typography>
            <Typography variant="body1">
              {selectedIngredient.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Category: {selectedIngredient.category}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleSkip}
          data-testid="ingredient-skip-button"
        >
          Skip Association
        </Button>
        <Button
          onClick={handleAssociate}
          variant="contained"
          disabled={!selectedIngredient}
          data-testid="ingredient-associate-button"
        >
          Associate Ingredient
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IngredientAssociationModal;
