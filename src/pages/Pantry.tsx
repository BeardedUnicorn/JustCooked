import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import PantryManager from '@components/PantryManager';
import { PantryItem } from '@app-types';
import { getPantryItems, addPantryItem, updatePantryItem, deletePantryItem } from '@services/pantryStorage';

const Pantry: React.FC = () => {
  const [items, setItems] = useState<PantryItem[]>([]);

  useEffect(() => {
    const loadPantryItems = async () => {
      const pantryItems = await getPantryItems();
      setItems(pantryItems);
    };

    loadPantryItems();
  }, []);

  const handleAddItem = async (item: PantryItem) => {
    try {
      await addPantryItem(item);
      // Reload items from backend to ensure consistency
      const updatedItems = await getPantryItems();
      setItems(updatedItems);
    } catch (error) {
      console.error('Failed to add pantry item:', error);
      // Could add error handling/notification here
    }
  };

  const handleUpdateItem = async (item: PantryItem) => {
    try {
      await updatePantryItem(item);
      // Reload items from backend to ensure consistency
      const updatedItems = await getPantryItems();
      setItems(updatedItems);
    } catch (error) {
      console.error('Failed to update pantry item:', error);
      // Could add error handling/notification here
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deletePantryItem(id);
      // Reload items from backend to ensure consistency
      const updatedItems = await getPantryItems();
      setItems(updatedItems);
    } catch (error) {
      console.error('Failed to delete pantry item:', error);
      // Could add error handling/notification here
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 3 }}>
      <Typography variant="body1" color="text.secondary" paragraph>
        Track ingredients you have at home and get recipe suggestions based on what's in your pantry.
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <PantryManager
          items={items}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
        />
      </Paper>
    </Box>
  );
};

export default Pantry;
