import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Paper, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Chip, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { PantryItem } from '@app-types';
import { formatAmountForDisplay } from '@services/recipeImport';

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
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState('piece(s)');
  const [category, setCategory] = useState('Other');
  const [expiryDate, setExpiryDate] = useState('');

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PantryItem[]>);

  const handleOpen = (item?: PantryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setAmount(item.amount);
      setUnit(item.unit);
      setCategory(item.category);
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

  const handleSubmit = () => {
    const item: PantryItem = {
      id: editingItem?.id || crypto.randomUUID(),
      name,
      amount,
      unit,
      category,
      expiryDate: expiryDate || undefined,
    };

    if (editingItem) {
      onUpdateItem(item);
    } else {
      onAddItem(item);
    }

    handleClose();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Pantry Items
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Item
        </Button>
      </Box>

      {Object.entries(groupedItems).length > 0 ? (
        Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Paper key={category} sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: 'background.default' }}>
              <Typography variant="h6" component="h3">
                {category}
              </Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {categoryItems.map((item) => (
                <ListItem key={item.id} divider>
                  <ListItemText
                    primary={item.name}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Chip
                          size="small"
                          label={item.unit && item.unit.trim() !== ''
                            ? `${formatAmountForDisplay(item.amount)} ${item.unit}`
                            : formatAmountForDisplay(item.amount)
                          }
                          sx={{ mr: 1 }}
                        />
                        {item.expiryDate && (
                          <Typography variant="caption" color="text.secondary">
                            Expires: {new Date(item.expiryDate).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleOpen(item)} size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton edge="end" onClick={() => onDeleteItem(item.id)} size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        ))
      ) : (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Your pantry is empty. Add some items to get started!
          </Typography>
        </Paper>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField
                autoFocus
                label="Item Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  label="Unit"
                >
                  {units.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  label="Category"
                >
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Expiry Date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disableElevation>
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PantryManager;
