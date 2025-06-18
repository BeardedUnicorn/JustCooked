import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  CircularProgress, List, ListItem, ListItemText, ListItemIcon,
  Divider, Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Kitchen as KitchenIcon,
  CalendarToday as CalendarIcon,
  ShoppingCart as ShoppingCartIcon,
  Warning as WarningIcon,

  Restaurant as RestaurantIcon,
  EventNote as EventNoteIcon,
  ImportContacts as ImportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MealPlanRecipe, ShoppingList, PantryItem } from '@app-types';
import { useAppDispatch, useAppSelector } from '@store';
import { loadAllRecipes, selectRecipes, selectRecipesLoading } from '@store/slices/recipesSlice';
import { getAllMealPlans, getMealPlanRecipes, groupMealPlanRecipesByDate } from '@services/mealPlanStorage';
import { getAllShoppingLists } from '@services/shoppingListStorage';
import { getExpiringItems } from '@services/pantryStorage';
import RecipeCard from '@components/RecipeCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const recipes = useAppSelector(selectRecipes);
  const recipesLoading = useAppSelector(selectRecipesLoading);

  // State for dashboard data
  const [todaysMealPlanRecipes, setTodaysMealPlanRecipes] = useState<MealPlanRecipe[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [expiringItems, setExpiringItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate recent recipes
  const recentRecipes = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    );
    return sorted.slice(0, 4);
  }, [recipes]);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Load all data in parallel
        const [mealPlansData, shoppingListsData, expiringItemsData] = await Promise.all([
          getAllMealPlans(),
          getAllShoppingLists(),
          getExpiringItems(7) // Items expiring within 7 days
        ]);
        setShoppingLists(shoppingListsData);
        setExpiringItems(expiringItemsData);

        // Find today's meal plan recipes
        const today = new Date().toISOString().split('T')[0];
        const activeMealPlan = mealPlansData.find(plan => {
          const startDate = new Date(plan.startDate).toISOString().split('T')[0];
          const endDate = new Date(plan.endDate).toISOString().split('T')[0];
          return today >= startDate && today <= endDate;
        });

        if (activeMealPlan) {
          const mealPlanRecipes = await getMealPlanRecipes(activeMealPlan.id);
          const groupedRecipes = groupMealPlanRecipesByDate(mealPlanRecipes);
          // Flatten all meal types for today into a single array
          const todaysRecipes = groupedRecipes[today]
            ? Object.values(groupedRecipes[today]).flat()
            : [];
          setTodaysMealPlanRecipes(todaysRecipes);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    dispatch(loadAllRecipes());
  }, [dispatch]);

  const handleRecipeDeleted = () => {
    dispatch(loadAllRecipes());
  };

  const handleRecipeUpdated = () => {
    dispatch(loadAllRecipes());
  };

  if (loading || recipesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="dashboard-title">
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Quick Actions Widget */}
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AddIcon sx={{ mr: 1 }} />
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<ImportIcon />}
                  onClick={() => navigate('/cookbook')}
                  fullWidth
                  data-testid="dashboard-import-recipe-button"
                >
                  Import Recipe
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<KitchenIcon />}
                  onClick={() => navigate('/pantry')}
                  fullWidth
                  data-testid="dashboard-add-to-pantry-button"
                >
                  Add to Pantry
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EventNoteIcon />}
                  onClick={() => navigate('/planner')}
                  fullWidth
                  data-testid="dashboard-create-meal-plan-button"
                >
                  Create Meal Plan
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Today's Plan Widget */}
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ mr: 1 }} />
                Today's Plan
              </Typography>
              {todaysMealPlanRecipes.length > 0 ? (
                <List dense>
                  {todaysMealPlanRecipes.slice(0, 4).map((mealRecipe, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <RestaurantIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Recipe ${mealRecipe.recipeId.slice(0, 8)}...`}
                        secondary={`${mealRecipe.mealType} • ${mealRecipe.servingMultiplier}x servings`}
                      />
                    </ListItem>
                  ))}
                  {todaysMealPlanRecipes.length > 4 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={`+${todaysMealPlanRecipes.length - 4} more meals`}
                        sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No meals planned for today
                </Typography>
              )}
              <Button
                size="small"
                onClick={() => navigate('/planner')}
                data-testid="dashboard-view-meal-plan-button"
              >
                View Meal Plan
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Shopping List Preview Widget */}
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <ShoppingCartIcon sx={{ mr: 1 }} />
                Shopping List Preview
              </Typography>
              {shoppingLists.length > 0 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="body2" color="text.primary">
                    {shoppingLists[0].name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {shoppingLists[0].dateRangeStart} to {shoppingLists[0].dateRangeEnd}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No shopping lists yet
                </Typography>
              )}
              <Button
                size="small"
                onClick={() => navigate('/planner')}
                data-testid="dashboard-view-shopping-lists-button"
              >
                View Shopping Lists
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Pantry At-a-Glance Widget */}
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon sx={{ mr: 1 }} />
                Pantry At-a-Glance
              </Typography>
              {expiringItems.length > 0 ? (
                <List dense>
                  {expiringItems.slice(0, 4).map((item, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={item.name}
                        secondary={`Expires ${new Date(item.expiryDate!).toLocaleDateString()}`}
                      />
                      <Chip
                        size="small"
                        label="Expiring"
                        color="warning"
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                  {expiringItems.length > 4 && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      +{expiringItems.length - 4} more items expiring soon
                    </Typography>
                  )}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No items expiring soon
                </Typography>
              )}
              <Button
                size="small"
                onClick={() => navigate('/pantry')}
                data-testid="dashboard-view-pantry-button"
              >
                View Pantry
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Recently Added Recipes Widget */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recently Added Recipes
                </Typography>
                <Button onClick={() => navigate('/cookbook')} data-testid="dashboard-view-all-recipes-button">
                  View All
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {recentRecipes.length > 0 ? (
                <Grid container spacing={2}>
                  {recentRecipes.map(recipe => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={recipe.id}>
                      <RecipeCard
                        recipe={recipe}
                        onDelete={handleRecipeDeleted}
                        onUpdate={handleRecipeUpdated}
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <KitchenIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No recipes yet!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Start by importing your favorite recipes.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<ImportIcon />}
                    onClick={() => navigate('/cookbook')}
                    data-testid="dashboard-import-first-recipe-button"
                  >
                    Import Recipe
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
