import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  CircularProgress, List, ListItem, ListItemText, ListItemIcon,
  Divider, Alert, Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Kitchen as KitchenIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  Restaurant as RestaurantIcon,
  EventNote as EventNoteIcon,
  ImportContacts as ImportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MealPlanRecipe, PantryItem } from '@app-types';
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
        const [mealPlansData, , expiringItemsData] = await Promise.all([
          getAllMealPlans(),
          getAllShoppingLists(),
          getExpiringItems(7) // Items expiring within 7 days
        ]);
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px" data-testid="dashboardPage-loading-main">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="dashboardPage-title-main">
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)} data-testid="dashboardPage-alert-error">
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* What's for Dinner? Widget */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }} data-testid="dashboardPage-widget-dinner">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <RestaurantIcon sx={{ mr: 1 }} />
                What's for Dinner?
              </Typography>
              {(() => {
                const dinnerRecipe = todaysMealPlanRecipes.find(recipe => recipe.mealType === 'dinner');
                if (dinnerRecipe) {
                  return (
                    <Box>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        Recipe ID: {dinnerRecipe.recipeId.slice(0, 8)}...
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Servings: {dinnerRecipe.servingMultiplier}x
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => navigate(`/recipe/${dinnerRecipe.recipeId}`)}
                        data-testid="dashboardPage-widget-dinner-button-viewRecipe"
                      >
                        View Recipe
                      </Button>
                    </Box>
                  );
                } else {
                  return (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No dinner planned for today
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => navigate('/cookbook?q=dinner')}
                        data-testid="dashboardPage-widget-dinner-button-findRecipe"
                      >
                        Find a Recipe
                      </Button>
                    </Box>
                  );
                }
              })()}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions Widget */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }} data-testid="dashboardPage-widget-quickActions">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AddIcon sx={{ mr: 1 }} />
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => navigate('/cookbook')}
                  data-testid="dashboardPage-widget-quickActions-card-importRecipe"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ImportIcon sx={{ mr: 2, fontSize: '2rem', color: 'primary.main' }} />
                    <Box>
                      <Typography variant="h6">Import Recipe</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add new recipes to your collection
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => navigate('/pantry')}
                  data-testid="dashboardPage-widget-quickActions-card-addToPantry"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <KitchenIcon sx={{ mr: 2, fontSize: '2rem', color: 'secondary.main' }} />
                    <Box>
                      <Typography variant="h6">Add to Pantry</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Manage your pantry items
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => navigate('/planner')}
                  data-testid="dashboardPage-widget-quickActions-card-mealPlanning"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <EventNoteIcon sx={{ mr: 2, fontSize: '2rem', color: 'success.main' }} />
                    <Box>
                      <Typography variant="h6">Meal Planning</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Plan your weekly meals
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Today's Plan Widget */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }} data-testid="dashboardPage-widget-todaysPlan">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ mr: 1 }} />
                Today's Plan
              </Typography>
              {todaysMealPlanRecipes.length > 0 ? (
                <List dense data-testid="dashboardPage-widget-todaysPlan-list-meals">
                  {todaysMealPlanRecipes.slice(0, 4).map((mealRecipe, index) => (
                    <ListItem key={index} sx={{ px: 0 }} data-testid={`dashboardPage-widget-todaysPlan-listItem-${index}`}>
                      <ListItemIcon>
                        <RestaurantIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Recipe ${mealRecipe.recipeId.slice(0, 8)}...`}
                        secondary={`${mealRecipe.mealType} • ${mealRecipe.servingMultiplier}x servings`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" data-testid="dashboardPage-widget-todaysPlan-text-noMeals">
                  No meals planned for today
                </Typography>
              )}
              <Button
                variant="text"
                onClick={() => navigate('/planner')}
                sx={{ mt: 1 }}
                data-testid="dashboardPage-widget-todaysPlan-button-viewFullPlan"
              >
                View Full Plan
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Pantry At-a-Glance Widget */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }} data-testid="dashboardPage-widget-pantry">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon sx={{ mr: 1 }} />
                Pantry At-a-Glance
              </Typography>
              {expiringItems.length > 0 ? (
                <List dense data-testid="dashboardPage-widget-pantry-list-expiringItems">
                  {expiringItems.slice(0, 4).map((item, index) => (
                    <ListItem key={index} sx={{ px: 0 }} data-testid={`dashboardPage-widget-pantry-listItem-expiring-${index}`}>
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
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }} data-testid="dashboardPage-widget-pantry-text-moreExpiringItems">
                      +{expiringItems.length - 4} more items expiring soon
                    </Typography>
                  )}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }} data-testid="dashboardPage-widget-pantry-text-noExpiringItems">
                  No items expiring soon
                </Typography>
              )}
              <Button
                size="small"
                onClick={() => navigate('/pantry')}
                data-testid="dashboardPage-widget-pantry-button-viewPantry"
              >
                View Pantry
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Recently Added Recipes Widget */}
        <Grid size={{ xs: 12 }}>
          <Card data-testid="dashboardPage-widget-recentRecipes">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recently Added Recipes
                </Typography>
                <Button onClick={() => navigate('/cookbook')} data-testid="dashboardPage-widget-recentRecipes-button-viewAll">
                  View All
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {recentRecipes.length > 0 ? (
                <Grid container spacing={2} data-testid="dashboardPage-widget-recentRecipes-grid-recipes">
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
                <Box sx={{ textAlign: 'center', py: 4 }} data-testid="dashboardPage-widget-recentRecipes-emptyState">
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
                    data-testid="dashboardPage-widget-recentRecipes-button-importFirst"
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
