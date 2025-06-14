import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,

  Chip,
  List,
  ListItem,
  ListItemText,

  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Restaurant as RestaurantIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  MealPlan,

  getCategoryDisplayName,
  getCategoryOrder,
} from '@app-types';
import { getAllRecipes } from '@services/recipeStorage';
import { getMealPlanRecipes } from '@services/mealPlanStorage';
import {
  generateShoppingListFromMealPlan,
  consolidateIngredients,
  ConsolidatedIngredient,
} from '@services/shoppingListStorage';

interface ShoppingListGeneratorProps {
  open: boolean;
  onClose: () => void;
  mealPlan: MealPlan;
  onShoppingListCreated: (shoppingListId: string) => void;
}

const ShoppingListGenerator: React.FC<ShoppingListGeneratorProps> = ({
  open,
  onClose,
  mealPlan,
  onShoppingListCreated,
}) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date(mealPlan.startDate));
  const [endDate, setEndDate] = useState<Date>(new Date(mealPlan.endDate));
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consolidatedIngredients, setConsolidatedIngredients] = useState<ConsolidatedIngredient[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      const defaultName = `Shopping List - ${mealPlan.name}`;
      setName(defaultName);
      setStartDate(new Date(mealPlan.startDate));
      setEndDate(new Date(mealPlan.endDate));
      setError(null);
      setShowPreview(false);
      setConsolidatedIngredients([]);
    }
  }, [open, mealPlan]);

  const generatePreview = async () => {
    try {
      setPreviewLoading(true);
      setError(null);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get all recipes and meal plan recipes
      const [allRecipes, allMealPlanRecipes] = await Promise.all([
        getAllRecipes(),
        getMealPlanRecipes(mealPlan.id),
      ]);

      // Filter meal plan recipes to the selected date range
      const filteredMealPlanRecipes = allMealPlanRecipes.filter(mpr =>
        mpr.date >= startDateStr && mpr.date <= endDateStr
      );

      if (filteredMealPlanRecipes.length === 0) {
        setError('No recipes found in the selected date range');
        return;
      }

      // Consolidate ingredients
      const consolidated = consolidateIngredients(allRecipes, filteredMealPlanRecipes);
      setConsolidatedIngredients(consolidated);
      setShowPreview(true);
    } catch (err) {
      setError('Failed to generate shopping list preview');
      console.error('Error generating preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateShoppingList = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get all recipes and meal plan recipes
      const [allRecipes, allMealPlanRecipes] = await Promise.all([
        getAllRecipes(),
        getMealPlanRecipes(mealPlan.id),
      ]);

      // Generate the shopping list
      const shoppingListId = await generateShoppingListFromMealPlan(
        mealPlan.id,
        name,
        startDateStr,
        endDateStr,
        allRecipes,
        allMealPlanRecipes
      );

      onShoppingListCreated(shoppingListId);
      onClose();
    } catch (err) {
      setError('Failed to create shopping list');
      console.error('Error creating shopping list:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupIngredientsByCategory = (ingredients: ConsolidatedIngredient[]) => {
    const grouped: Record<string, ConsolidatedIngredient[]> = {};
    
    ingredients.forEach(ingredient => {
      const category = ingredient.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(ingredient);
    });

    // Sort categories by predefined order
    const sortedCategories = Object.keys(grouped).sort((a, b) => 
      getCategoryOrder(a) - getCategoryOrder(b)
    );

    return sortedCategories.map(category => ({
      category,
      items: grouped[category].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  };

  const formatQuantity = (quantity: number, unit: string) => {
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(quantity * 100) / 100;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted} ${unit}`;
  };

  const getTotalRecipeCount = () => {
    const uniqueRecipes = new Set(consolidatedIngredients.flatMap(ing => ing.sources));
    return uniqueRecipes.size;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        data-testid="shopping-list-generator-dialog"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon />
            <Typography variant="h6" component="div">
              Generate Shopping List
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Shopping List Name */}
            <TextField
              label="Shopping List Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              data-testid="shopping-list-name-input"
            />

            {/* Date Range Selection */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
                minDate={new Date(mealPlan.startDate)}
                maxDate={new Date(mealPlan.endDate)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    inputProps: { 'data-testid': 'shopping-list-start-date-input' },
                  },
                }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(date) => date && setEndDate(date)}
                minDate={startDate}
                maxDate={new Date(mealPlan.endDate)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    inputProps: { 'data-testid': 'shopping-list-end-date-input' },
                  },
                }}
              />
            </Box>

            {/* Preview Button */}
            <Button
              variant="outlined"
              onClick={generatePreview}
              disabled={previewLoading || !name.trim()}
              startIcon={previewLoading ? <CircularProgress size={20} /> : <RestaurantIcon />}
              data-testid="shopping-list-preview-button"
            >
              {previewLoading ? 'Generating Preview...' : 'Preview Ingredients'}
            </Button>

            {/* Preview Section */}
            {showPreview && consolidatedIngredients.length > 0 && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Shopping List Preview</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={`${consolidatedIngredients.length} ingredients`}
                      size="small"
                      color="primary"
                    />
                    <Chip
                      label={`${getTotalRecipeCount()} recipes`}
                      size="small"
                      color="secondary"
                    />
                  </Box>
                </Box>

                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {groupIngredientsByCategory(consolidatedIngredients).map(({ category, items }) => (
                    <Box key={category} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CategoryIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                          {getCategoryDisplayName(category)}
                        </Typography>
                        <Chip label={items.length} size="small" variant="outlined" />
                      </Box>
                      
                      <List dense sx={{ pl: 2 }}>
                        {items.map((ingredient, index) => (
                          <ListItem key={index} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2">
                                    {formatQuantity(ingredient.totalQuantity, ingredient.unit)} {ingredient.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    from {ingredient.sources.length} recipe{ingredient.sources.length > 1 ? 's' : ''}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                ingredient.sources.length <= 2 ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {ingredient.sources.join(', ')}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    {ingredient.sources.slice(0, 2).join(', ')} and {ingredient.sources.length - 2} more
                                  </Typography>
                                )
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                      
                      {category !== 'other' && <Divider sx={{ mt: 1 }} />}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} data-testid="shopping-list-generator-cancel-button">
            Cancel
          </Button>
          <Button
            onClick={handleCreateShoppingList}
            variant="contained"
            disabled={loading || !name.trim() || !showPreview || consolidatedIngredients.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
            data-testid="shopping-list-generator-create-button"
          >
            {loading ? 'Creating...' : 'Create Shopping List'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ShoppingListGenerator;
