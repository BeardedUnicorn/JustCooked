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
    await addPantryItem(item);
    setItems([...items, item]);
  };

  const handleUpdateItem = async (item: PantryItem) => {
    await updatePantryItem(item);
    setItems(items.map(i => i.id === item.id ? item : i));
  };

  const handleDeleteItem = async (id: string) => {
    await deletePantryItem(id);
    setItems(items.filter(i => i.id !== id));
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
