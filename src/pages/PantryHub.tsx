import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Button, Menu, MenuItem,
  TextField, FormControl, InputLabel, Select, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Fab, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  QrCodeScanner as QrCodeScannerIcon,
  ShoppingCart as ShoppingCartIcon,
  Create as CreateIcon
} from '@mui/icons-material';
import { PantryItem, IngredientDatabase, INGREDIENT_CATEGORIES } from '@app-types';
import { getPantryItems, addPantryItem, updatePantryItem, deletePantryItem } from '@services/pantryStorage';
import {
  loadIngredients,
  searchIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
} from '@services/ingredientStorage';
import PantryManager from '@components/PantryManager';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pantry-tabpanel-${index}`}
      aria-labelledby={`pantry-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `pantry-tab-${index}`,
    'aria-controls': `pantry-tabpanel-${index}`,
  };
}

const PantryHub: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  // My Pantry tab state
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Ingredient Database tab state
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

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Load data for the selected tab
    if (newValue === 0 && pantryItems.length === 0) {
      loadPantryItems();
    } else if (newValue === 1 && ingredients.length === 0) {
      loadIngredientsData();
    }
  };

  const loadPantryItems = async () => {
    const items = await getPantryItems();
    setPantryItems(items);
  };

  const loadIngredientsData = async () => {
    const loadedIngredients = await loadIngredients();
    setIngredients(loadedIngredients);
  };

  const filterIngredients = async () => {
    let filtered = ingredients;

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = await searchIngredients(searchQuery);
      filtered = searchResults.map(result => result.ingredient);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ingredient => ingredient.category === selectedCategory);
    }

    setFilteredIngredients(filtered);
    setPage(0); // Reset to first page when filtering
  };

  // Pantry item handlers
  const handleAddPantryItem = async (item: PantryItem) => {
    try {
      await addPantryItem(item);
      const updatedItems = await getPantryItems();
      setPantryItems(updatedItems);
    } catch (error) {
      console.error('Failed to add pantry item:', error);
    }
  };

  const handleUpdatePantryItem = async (item: PantryItem) => {
    try {
      await updatePantryItem(item);
      const updatedItems = await getPantryItems();
      setPantryItems(updatedItems);
    } catch (error) {
      console.error('Failed to update pantry item:', error);
    }
  };

  const handleDeletePantryItem = async (id: string) => {
    try {
      await deletePantryItem(id);
      const updatedItems = await getPantryItems();
      setPantryItems(updatedItems);
    } catch (error) {
      console.error('Failed to delete pantry item:', error);
    }
  };

  // Ingredient database handlers
  const handleOpenIngredientDialog = (ingredient?: IngredientDatabase) => {
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

  const handleCloseIngredientDialog = () => {
    setDialogOpen(false);
    setEditingIngredient(null);
    setError(null);
  };

  const handleSaveIngredient = async () => {
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
        await updateIngredient(editingIngredient.id, {
          name: formData.name.trim(),
          category: formData.category,
          aliases,
        });
      } else {
        await addIngredient({
          name: formData.name.trim(),
          category: formData.category,
          aliases,
        });
      }

      await loadIngredientsData();
      handleCloseIngredientDialog();
    } catch (err) {
      setError('Failed to save ingredient');
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      await deleteIngredient(id);
      await loadIngredientsData();
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

  // Initialize with pantry items
  useEffect(() => {
    loadPantryItems();
  }, []);

  useEffect(() => {
    if (tabValue === 1) {
      filterIngredients();
    }
  }, [ingredients, searchQuery, selectedCategory, tabValue]);

  const paginatedIngredients = Array.isArray(filteredIngredients)
    ? filteredIngredients.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      )
    : [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="pantryHubPage-title-main">
        Pantry
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }} data-testid="pantryHubPage-tabs-main">
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="pantry tabs">
          <Tab label="My Pantry" {...a11yProps(0)} data-testid="pantryHubPage-tab-myPantry" />
          <Tab label="Ingredient Database" {...a11yProps(1)} data-testid="pantryHubPage-tab-ingredientDb" />
        </Tabs>
      </Box>

      {/* My Pantry Tab */}
      <TabPanel value={tabValue} index={0}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Track ingredients you have at home and get recipe suggestions based on what's in your pantry.
        </Typography>

        <Paper sx={{ p: 3 }} data-testid="pantryHubPage-myPantry-container-main">
          <PantryManager
            items={pantryItems}
            onAddItem={handleAddPantryItem}
            onUpdateItem={handleUpdatePantryItem}
            onDeleteItem={handleDeletePantryItem}
          />
        </Paper>

        {/* Enhanced Add Item FAB with Menu */}
        <Fab
          color="primary"
          aria-label="add pantry item"
          data-testid="pantryHubPage-myPantry-fab-addItem"
          sx={{
            position: 'fixed',
            bottom: 80, // Above bottom navigation on mobile
            right: 16,
          }}
          onClick={(event) => setAddMenuAnchorEl(event.currentTarget)}
        >
          <AddIcon />
        </Fab>

        {/* Add Item Menu */}
        <Menu
          anchorEl={addMenuAnchorEl}
          open={Boolean(addMenuAnchorEl)}
          onClose={() => setAddMenuAnchorEl(null)}
          data-testid="pantryHubPage-myPantry-menu-addItem"
        >
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              // TODO: Implement barcode scanner
              console.log('Scan Barcode clicked');
            }}
            data-testid="pantry-scan-barcode-menu-item"
          >
            <QrCodeScannerIcon sx={{ mr: 1 }} />
            Scan Barcode
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              // TODO: Implement product search modal
              console.log('Search Product clicked');
            }}
            data-testid="pantry-search-product-menu-item"
          >
            <ShoppingCartIcon sx={{ mr: 1 }} />
            Search Product
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              // TODO: Implement manual add
              console.log('Add Manually clicked');
            }}
            data-testid="pantry-add-manually-menu-item"
          >
            <CreateIcon sx={{ mr: 1 }} />
            Add Manually
          </MenuItem>
        </Menu>
      </TabPanel>

      {/* Ingredient Database Tab */}
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 3, mb: 3 }} data-testid="pantryHubPage-ingredientDatabase-container-main">
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="Search ingredients"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="pantryHubPage-ingredientDb-input-search"
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
                data-testid="pantryHubPage-ingredientDb-select-category"
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

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} data-testid="pantryHubPage-ingredientDb-text-resultsCount">
            {Array.isArray(filteredIngredients) ? filteredIngredients.length : 0} ingredient{(Array.isArray(filteredIngredients) ? filteredIngredients.length : 0) !== 1 ? 's' : ''} found
          </Typography>

          <TableContainer data-testid="pantryHubPage-ingredientDb-table-main">
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
                  <TableRow key={ingredient.id} hover data-testid={`pantryHubPage-ingredientDb-row-${ingredient.id}`}>
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
                            onClick={() => handleOpenIngredientDialog(ingredient)}
                            data-testid={`pantryHubPage-ingredientDb-button-edit-${ingredient.id}`}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete ingredient">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteIngredient(ingredient.id)}
                            data-testid={`pantryHubPage-ingredientDb-button-delete-${ingredient.id}`}
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
            count={Array.isArray(filteredIngredients) ? filteredIngredients.length : 0}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            data-testid="pantryHubPage-ingredientDb-pagination"
          />
        </Paper>

        {/* Add Ingredient FAB for Database tab */}
        {tabValue === 1 && (
          <Fab
            color="primary"
            aria-label="add ingredient"
            sx={{ position: 'fixed', bottom: 80, right: 16 }}
            onClick={() => handleOpenIngredientDialog()}
            data-testid="pantryHubPage-ingredientDb-fab-add"
          >
            <AddIcon />
          </Fab>
        )}

        {/* Add/Edit Ingredient Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseIngredientDialog} maxWidth="sm" fullWidth data-testid="pantryHubPage-dialog-ingredient">
          <DialogTitle>
            {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} data-testid="pantryHubPage-ingredientDb-alert-error">
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
              data-testid="pantryHubPage-dialog-ingredient-input-name"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                data-testid="pantryHubPage-dialog-ingredient-select-category"
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
              data-testid="pantryHubPage-dialog-ingredient-input-aliases"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseIngredientDialog} data-testid="pantryHubPage-dialog-ingredient-button-cancel">Cancel</Button>
            <Button onClick={handleSaveIngredient} variant="contained" data-testid="pantryHubPage-dialog-ingredient-button-save">
              {editingIngredient ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </TabPanel>
    </Box>
  );
};

export default PantryHub;
