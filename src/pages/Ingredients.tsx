import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { IngredientDatabase, INGREDIENT_CATEGORIES } from '@app-types/ingredient';
import {
  loadIngredients,
  searchIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
} from '@services/ingredientStorage';

const Ingredients: React.FC = () => {
  const [ingredients, setIngredients] = useState<IngredientDatabase[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<IngredientDatabase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientDatabase | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    aliases: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIngredientsData();
  }, []);

  useEffect(() => {
    filterIngredients();
  }, [ingredients, searchQuery, selectedCategory]);

  const loadIngredientsData = () => {
    const loadedIngredients = loadIngredients();
    setIngredients(loadedIngredients);
  };

  const filterIngredients = () => {
    let filtered = ingredients;

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchIngredients(searchQuery);
      filtered = searchResults.map(result => result.ingredient);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ingredient => ingredient.category === selectedCategory);
    }

    setFilteredIngredients(filtered);
    setPage(0); // Reset to first page when filtering
  };

  const handleOpenDialog = (ingredient?: IngredientDatabase) => {
    if (ingredient) {
      setEditingIngredient(ingredient);
      setFormData({
        name: ingredient.name,
        category: ingredient.category,
        aliases: ingredient.aliases.join(', '),
      });
    } else {
      setEditingIngredient(null);
      setFormData({
        name: '',
        category: 'other',
        aliases: '',
      });
    }
    setDialogOpen(true);
    setError(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingIngredient(null);
    setError(null);
  };

  const handleSaveIngredient = () => {
    if (!formData.name.trim()) {
      setError('Ingredient name is required');
      return;
    }

    const aliases = formData.aliases
      .split(',')
      .map(alias => alias.trim())
      .filter(alias => alias.length > 0);

    try {
      if (editingIngredient) {
        // Update existing ingredient
        updateIngredient(editingIngredient.id, {
          name: formData.name.trim(),
          category: formData.category,
          aliases,
        });
      } else {
        // Add new ingredient
        addIngredient({
          name: formData.name.trim(),
          category: formData.category,
          aliases,
        });
      }

      loadIngredientsData();
      handleCloseDialog();
    } catch (err) {
      setError('Failed to save ingredient');
    }
  };

  const handleDeleteIngredient = (id: string) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      deleteIngredient(id);
      loadIngredientsData();
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = INGREDIENT_CATEGORIES.find(cat => cat.id === categoryId);
    return category?.name || 'Other';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = INGREDIENT_CATEGORIES.find(cat => cat.id === categoryId);
    return category?.color || '#9E9E9E';
  };

  const paginatedIngredients = filteredIngredients.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Ingredient Database
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            label="Search ingredients"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ minWidth: 300, flex: 1 }}
          />
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {INGREDIENT_CATEGORIES.map(category => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filteredIngredients.length} ingredient{filteredIngredients.length !== 1 ? 's' : ''} found
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Aliases</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedIngredients.map((ingredient) => (
                <TableRow key={ingredient.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {ingredient.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryName(ingredient.category)}
                      size="small"
                      sx={{
                        backgroundColor: getCategoryColor(ingredient.category),
                        color: 'white',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {ingredient.aliases.slice(0, 3).map((alias, index) => (
                        <Chip
                          key={index}
                          label={alias}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {ingredient.aliases.length > 3 && (
                        <Chip
                          label={`+${ingredient.aliases.length - 3} more`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit ingredient">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(ingredient)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete ingredient">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteIngredient(ingredient.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredIngredients.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Add Ingredient FAB */}
      <Fab
        color="primary"
        aria-label="add ingredient"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => handleOpenDialog()}
      >
        <AddIcon />
      </Fab>

      {/* Add/Edit Ingredient Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            label="Ingredient Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {INGREDIENT_CATEGORIES.map(category => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            label="Aliases (comma-separated)"
            fullWidth
            value={formData.aliases}
            onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
            margin="normal"
            helperText="Alternative names for this ingredient, separated by commas"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveIngredient} variant="contained">
            {editingIngredient ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Ingredients;
