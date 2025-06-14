import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingList } from '@app-types';
import { getShoppingListById } from '@services/shoppingListStorage';
import ShoppingListView from '@components/ShoppingListView';

const ShoppingListPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadShoppingList();
    }
  }, [id]);

  const loadShoppingList = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const shoppingListData = await getShoppingListById(id);

      if (!shoppingListData) {
        setError('Shopping list not found');
        return;
      }

      setShoppingList(shoppingListData);
      setError(null);
    } catch (err) {
      setError('Failed to load shopping list');
      console.error('Error loading shopping list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemsChanged = () => {
    // Refresh the shopping list data if needed
    // For now, we'll just trigger a re-render
    loadShoppingList();
  };

  const handleDelete = () => {
    // Navigate back to meal plan view
    if (shoppingList) {
      navigate(`/meal-plans/${shoppingList.mealPlanId}`);
    } else {
      navigate('/meal-plans');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !shoppingList) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3 }}>
        <Alert severity="error">
          {error || 'Shopping list not found'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/meal-plans')}
          sx={{ mt: 2 }}
        >
          Back to Meal Plans
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/meal-plans')}
          sx={{ textDecoration: 'none' }}
        >
          Meal Plans
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate(`/meal-plans/${shoppingList.mealPlanId}`)}
          sx={{ textDecoration: 'none' }}
        >
          Meal Plan
        </Link>
        <Typography color="text.primary">Shopping List</Typography>
      </Breadcrumbs>

      {/* Shopping List View */}
      <ShoppingListView
        shoppingList={shoppingList}
        onItemsChanged={handleItemsChanged}
        onDelete={handleDelete}
      />
    </Box>
  );
};

export default ShoppingListPage;
