import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import { getAllRecipes } from '@services/recipeStorage';
import { getPantryItems } from '@services/pantryStorage';
import { Recipe, PantryItem } from '@app-types';
import RecipeCard from '@components/RecipeCard';
import { cleanIngredientName } from '@utils/ingredientUtils';

const SmartCookbook: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [loadedRecipes, loadedPantry] = await Promise.all([
        getAllRecipes(),
        getPantryItems()
      ]);
      setRecipes(loadedRecipes);
      setPantryItems(loadedPantry);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredRecipes = useMemo(() => {
    if (pantryItems.length === 0) return [];

    const pantrySet = new Set(pantryItems.map(item => cleanIngredientName(item.name).toLowerCase()));

    return recipes
      .map(recipe => {
        const matched = recipe.ingredients.filter(ing => 
          pantrySet.has(cleanIngredientName(ing.name).toLowerCase())
        ).length;
        const missing = recipe.ingredients.length - matched;
        return { recipe, missing, matched };
      })
      .filter(({ matched }) => matched > 0)
      .sort((a, b) => a.missing - b.missing);
  }, [recipes, pantryItems]);

  const handleRecipeDeleted = async () => {
    const loadedRecipes = await getAllRecipes();
    setRecipes(loadedRecipes);
  };

  const handleRecipeUpdated = async () => {
    const loadedRecipes = await getAllRecipes();
    setRecipes(loadedRecipes);
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Smart Cookbook
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Recipes you can make with your pantry items. Sorted by fewest missing ingredients.
      </Typography>

      {filteredRecipes.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No matching recipes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Add items to your pantry or import more recipes to see suggestions.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredRecipes.map(({ recipe, missing }) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
              <RecipeCard
                recipe={recipe}
                onDelete={handleRecipeDeleted}
                onUpdate={handleRecipeUpdated}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {missing === 0 ? 'All ingredients available' : `${missing} ingredients missing`}
              </Typography>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default SmartCookbook;
