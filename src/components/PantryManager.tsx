import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Paper, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Chip, Divider, Menu
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import LinkIcon from '@mui/icons-material/Link';
import { PantryItem, ProductIngredientMapping } from '@app-types';
import { formatAmountForDisplay } from '@services/recipeImport';
import ProductSearchModal from './ProductSearchModal';
import IngredientAssociationModal from './IngredientAssociationModal';
import { ProductIngredientMappingService } from '../services/productIngredientMappingService';
import { IngredientAssociation } from '@app-types/productIngredientMapping';

interface PantryManagerProps {
  items: PantryItem[];
  onAddItem: (item: PantryItem) => void;
  onUpdateItem: (item: PantryItem) => void;
  onDeleteItem: (id: string) => void;
}

const categories = [
  'Produce', 'Dairy', 'Meat', 'Grains', 'Baking', 'Spices', 'Canned Goods', 'Frozen', 'Other'
];

const units = [
  'g', 'kg', 'ml', 'l', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'piece(s)'
];

const PantryManager: React.FC<PantryManagerProps> = ({
                                                       items, onAddItem, onUpdateItem, onDeleteItem
                                                     }) => {
  const [open, setOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState('piece(s)');
  const [category, setCategory] = useState('Other');
  const [expiryDate, setExpiryDate] = useState('');
  const [ingredientMappings, setIngredientMappings] = useState<Map<string, string>>(new Map());
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [pendingPantryItem, setPendingPantryItem] = useState<PantryItem | null>(null);

  // Load ingredient mappings when component mounts
  useEffect(() => {
    const loadIngredientMappings = async () => {
      try {
        const mappings = await ProductIngredientMappingService.getAllMappings();
        const mappingMap = new Map<string, string>();
        mappings.forEach((mapping: ProductIngredientMapping) => {
          mappingMap.set(mapping.product_code, mapping.ingredient_name);
        });
        setIngredientMappings(mappingMap);
      } catch (error) {
        console.error('Failed to load ingredient mappings:', error);
      }
    };

    loadIngredientMappings();
  }, []);

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const itemCategory = item.category || 'Other';
    if (!acc[itemCategory]) {
      acc[itemCategory] = [];
    }
    acc[itemCategory].push(item);
    return acc;
  }, {} as Record<string, PantryItem[]>);

  // Helper function to refresh ingredient mappings
  const refreshIngredientMappings = async () => {
    try {
      const mappings = await ProductIngredientMappingService.getAllMappings();
      const mappingMap = new Map<string, string>();
      mappings.forEach((mapping: ProductIngredientMapping) => {
        mappingMap.set(mapping.product_code, mapping.ingredient_name);
      });
      setIngredientMappings(mappingMap);
    } catch (error) {
      console.error('Failed to refresh ingredient mappings:', error);
    }
  };

  // Helper function to get ingredient mapping for a pantry item
  const getIngredientMapping = (item: PantryItem): string | null => {
    if (item.productCode && ingredientMappings.has(item.productCode)) {
      return ingredientMappings.get(item.productCode) || null;
    }
    return null;
  };

  // Wrapper function to handle adding items and refreshing mappings
  const handleAddItemWithMappingRefresh = async (item: PantryItem) => {
    onAddItem(item);
    // Refresh mappings after adding an item, in case it has a product code
    await refreshIngredientMappings();
  };

  const handleOpen = (item?: PantryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setAmount(item.amount);
      setUnit(item.unit);
      setCategory(item.category || 'Other');
      setExpiryDate(item.expiryDate || '');
    } else {
      resetForm();
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingItem(null);
    setName('');
    setAmount(0);
    setUnit('piece(s)');
    setCategory('Other');
    setExpiryDate('');
  };

  const handleIngredientAssociation = async (association: IngredientAssociation | null) => {
    if (!pendingPantryItem) return;

    try {
      // Create mapping if association was provided and item has a product code
      if (association && pendingPantryItem.productCode) {
        await ProductIngredientMappingService.createMapping({
          product_code: pendingPantryItem.productCode,
          ingredient_id: association.ingredient_id,
        });
      }

      // Add or update item to pantry regardless of whether association was made
      if (editingItem) {
        onUpdateItem(pendingPantryItem);
      } else {
        onAddItem(pendingPantryItem);
      }
      
      // Refresh mappings
      await refreshIngredientMappings();
      
      handleClose();
    } catch (error) {
      console.error('Failed to create ingredient mapping:', error);
      // Still add/update item even if mapping failed
      if (editingItem) {
        onUpdateItem(pendingPantryItem);
      } else {
        onAddItem(pendingPantryItem);
      }
      handleClose();
    }
  };

  const handleSubmit = async () => {
    // Basic validation - require name
    if (!name.trim()) {
      return;
    }

    const item: PantryItem = {
      id: editingItem?.id || crypto.randomUUID(),
      name: name.trim(),
      amount,
      unit,
      category,
      expiryDate: expiryDate || undefined,
      dateAdded: editingItem?.dateAdded || new Date().toISOString(),
      dateModified: new Date().toISOString(),
    };

    if (editingItem) {
      // For editing, preserve existing product information and update the item
      const updatedItem = {
        ...item,
        productCode: editingItem.productCode,
        productName: editingItem.productName,
        brands: editingItem.brands,
      };

      // Check if item has product code but no ingredient mapping
      if (updatedItem.productCode && !getIngredientMapping(updatedItem)) {
        setPendingPantryItem(updatedItem);
        setShowIngredientModal(true);
        return;
      }

      onUpdateItem(updatedItem);
      handleClose();
    } else {
      // For new manually added items, add directly to pantry
      // (no product code, so no ingredient mapping needed)
      onAddItem(item);
      handleClose();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Pantry Items
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setAddMenuAnchor(e.currentTarget)}
            data-testid="pantry-add-item-button"
          >
            Add Item
          </Button>
          <Menu
            anchorEl={addMenuAnchor}
            open={Boolean(addMenuAnchor)}
            onClose={() => setAddMenuAnchor(null)}
            data-testid="pantry-add-menu"
          >
            <MenuItem
              onClick={() => {
                setAddMenuAnchor(null);
                setProductSearchOpen(true);
              }}
              data-testid="pantry-add-product-menu-item"
            >
              Search Products
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAddMenuAnchor(null);
                handleOpen();
              }}
              data-testid="pantry-add-manual-menu-item"
            >
              Add Manually
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {Object.entries(groupedItems).length > 0 ? (
        Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Paper key={category} sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: 'background.default' }} data-testid={`pantryManager-header-category-${category.toLowerCase()}`}>
              <Typography variant="h6" component="h3">
                {category}
              </Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {categoryItems.map((item) => {
                const ingredientMapping = getIngredientMapping(item);

                return (
                  <ListItem key={item.id} divider data-testid={`pantry-item-${item.id}`}>
                    <ListItemText
                      primary={item.name}
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip
                              size="small"
                              label={item.unit && item.unit.trim() !== ''
                                ? `${formatAmountForDisplay(item.amount)} ${item.unit}`
                                : `${formatAmountForDisplay(item.amount)}`
                              }
                              sx={{ mr: 1 }}
                            />
                            {item.expiryDate && (
                              <Typography variant="caption" color="text.secondary">
                                Expires: {new Date(item.expiryDate).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                          {/* Ingredient mapping display */}
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {ingredientMapping ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                data-testid={`pantry-item-${item.id}-ingredient-mapping`}
                              >
                                Ingredient: {ingredientMapping}
                              </Typography>
                            ) : (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setPendingPantryItem(item);
                                  setShowIngredientModal(true);
                                }}
                                sx={{ color: 'text.secondary' }}
                                data-testid={`pantry-item-${item.id}-link-ingredient-button`}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleOpen(item)} size="small" aria-label="edit item" data-testid={`pantry-item-${item.id}-edit`}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton edge="end" onClick={() => onDeleteItem(item.id)} size="small" aria-label="delete item" data-testid={`pantry-item-${item.id}-delete`}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        ))
      ) : (
        <Paper sx={{ p: 3, textAlign: 'center' }} data-testid="pantryManager-emptyState-container">
          <Typography variant="body1" color="text.secondary">
            Your pantry is empty. Add some items to get started!
          </Typography>
        </Paper>
      )}

      {/* Product Search Modal */}
      <ProductSearchModal
        open={productSearchOpen}
        onClose={() => setProductSearchOpen(false)}
        onAddProduct={handleAddItemWithMappingRefresh}
      />

      {/* Ingredient Association Modal */}
      <IngredientAssociationModal
        open={showIngredientModal}
        onClose={() => {
          setShowIngredientModal(false);
          setPendingPantryItem(null);
        }}
        onAssociate={handleIngredientAssociation}
        productName={pendingPantryItem?.name || ''}
      />

      {/* Add/Edit Item Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth data-testid="pantry-item-dialog">
        <DialogTitle>{editingItem ? 'Edit Pantry Item' : 'Add Pantry Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                autoFocus
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                data-testid="pantry-item-name-input"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 0, step: 0.1 }}
                data-testid="pantry-item-amount-input"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  label="Unit"
                  aria-label="unit"
                  data-testid="pantry-item-unit-select"
                >
                  {units.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  label="Category"
                  data-testid="pantry-item-category-select"
                >
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Expiry Date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                data-testid="pantry-item-expiry-input"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} data-testid="pantry-item-cancel-button">Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disableElevation 
            data-testid="pantry-item-submit-button"
          >
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PantryManager;
