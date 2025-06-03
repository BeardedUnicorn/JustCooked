import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, CircularProgress, Alert,
  Snackbar, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { importRecipeFromUrl } from '@services/recipeImport';
import { formatIngredientForDisplay } from '@utils/ingredientUtils';
import { Recipe } from '@app-types';

const Import: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importedRecipe, setImportedRecipe] = useState<Recipe | null>(null);

  const handleImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a valid URL');
      return;
    }

    // Remove the frontend URL validation since the backend now handles it
    // The backend will return a proper error message for unsupported sites

    setLoading(true);
    setError(null);
    setImportedRecipe(null);

    try {
      const recipe = await importRecipeFromUrl(trimmedUrl);
      setImportedRecipe(recipe);
      setSuccess(true);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && url.trim()) {
      handleImport();
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear error when URL changes
    if (error) {
      setError(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Enter the URL of a recipe from any supported site to import it into your cookbook.
          <br />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes
          </Typography>
        </Typography>

        <TextField
          label="Recipe URL"
          variant="outlined"
          fullWidth
          type="url"
          value={url}
          onChange={handleUrlChange}
          onKeyPress={handleKeyPress}
          disabled={loading}
          placeholder="https://www.allrecipes.com/recipe/... or any supported site"
          sx={{ mb: 3 }}
          inputProps={{
            'aria-describedby': 'url-helper-text',
          }}
        />

        <Button
          variant="contained"
          color="primary"
          size="large"
          disabled={loading || !url.trim()}
          onClick={handleImport}
          startIcon={loading && <CircularProgress size={20} color="inherit" />}
          aria-label="Import recipe from URL"
        >
          {loading ? 'Importing...' : 'Import Recipe'}
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        <Snackbar
          open={success}
          autoHideDuration={5000}
          onClose={() => setSuccess(false)}
          message="Recipe imported successfully!"
        />

        {importedRecipe && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Recipe Imported Successfully:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {importedRecipe.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {importedRecipe.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Ingredients ({importedRecipe.ingredients.length}):
              </Typography>
              <List dense>
                {importedRecipe.ingredients.slice(0, 5).map((ingredient, idx) => (
                  <ListItem key={idx} dense>
                    <ListItemText primary={formatIngredientForDisplay(ingredient)} />
                  </ListItem>
                ))}
                {importedRecipe.ingredients.length > 5 && (
                  <ListItem dense>
                    <ListItemText primary={`+ ${importedRecipe.ingredients.length - 5} more ingredients`} />
                  </ListItem>
                )}
              </List>

              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Tags: {importedRecipe.tags.join(', ')}
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Import;
