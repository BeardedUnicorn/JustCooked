import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, CircularProgress, Alert,
  Snackbar
} from '@mui/material';
import { importRecipeFromUrl } from '../services/recipeParser';

const Import: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await importRecipeFromUrl(url);
      setSuccess(true);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Import Recipe
      </Typography>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Enter the URL of a recipe from AllRecipes, Food Network, or other popular recipe sites to import it into your cookbook.
        </Typography>

        <TextField
          label="Recipe URL"
          variant="outlined"
          fullWidth
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          placeholder="https://www.allrecipes.com/recipe/..."
          sx={{ mb: 3 }}
        />

        <Button
          variant="contained"
          color="primary"
          size="large"
          disabled={loading || !url.trim()}
          onClick={handleImport}
          startIcon={loading && <CircularProgress size={20} color="inherit" />}
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
      </Paper>
    </Box>
  );
};

export default Import;
