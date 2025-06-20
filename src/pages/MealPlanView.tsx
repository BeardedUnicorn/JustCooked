import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  ShoppingCart as ShoppingCartIcon,
  Edit as EditIcon,
  List as ListIcon,
} from '@mui/icons-material';
import RecipeAssignmentDialog from '@components/RecipeAssignmentDialog';
import ShoppingListGenerator from '@components/ShoppingListGenerator';

import { useParams, useNavigate } from 'react-router-dom';
import {
  MealPlan,
  MealPlanRecipe,
  Recipe,
  getMealTypeDisplayName,
  getMealTypeOrder,
  getMealPlanDates,
  isMealPlanActive,
  isMealPlanUpcoming,
  isMealPlanPast,
} from '@app-types';
import {
  getMealPlanById,
  getMealPlanRecipes,
  groupMealPlanRecipesByDate,
  deleteMealPlanRecipe,
} from '@services/mealPlanStorage';
import { getAllRecipes } from '@services/recipeStorage';
import { getShoppingListsByMealPlan } from '@services/shoppingListStorage';

const MealPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [mealPlanRecipes, setMealPlanRecipes] = useState<MealPlanRecipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [recipeAssignmentOpen, setRecipeAssignmentOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [shoppingListGeneratorOpen, setShoppingListGeneratorOpen] = useState(false);
  const [shoppingListsDialogOpen, setShoppingListsDialogOpen] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadMealPlanData();
    }
  }, [id]);

  const loadMealPlanData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [mealPlanData, mealPlanRecipesData, recipesData] = await Promise.all([
        getMealPlanById(id),
        getMealPlanRecipes(id),
        getAllRecipes(),
      ]);

      if (!mealPlanData) {
        setError('Meal plan not found');
        return;
      }

      setMealPlan(mealPlanData);
      setMealPlanRecipes(mealPlanRecipesData);
      setRecipes(recipesData);
      setError(null);
    } catch (err) {
      setError('Failed to load meal plan data');
      console.error('Error loading meal plan data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMealPlanStatusChip = (mealPlan: MealPlan) => {
    if (isMealPlanActive(mealPlan)) {
      return <Chip label="Active" color="success" size="small" />;
    } else if (isMealPlanUpcoming(mealPlan)) {
      return <Chip label="Upcoming" color="info" size="small" />;
    } else if (isMealPlanPast(mealPlan)) {
      return <Chip label="Past" color="default" size="small" />;
    }
    return null;
  };

  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return recipes.find(recipe => recipe.id === recipeId);
  };

  const handleAddRecipe = (date: string, mealType: string) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setRecipeAssignmentOpen(true);
  };

  const handleRecipeAssigned = () => {
    loadMealPlanData(); // Reload data to show the new assignment
  };

  const handleRemoveRecipe = async (mealPlanRecipeId: string) => {
    try {
      await deleteMealPlanRecipe(mealPlanRecipeId);
      loadMealPlanData(); // Reload data to reflect the removal
    } catch (err) {
      setError('Failed to remove recipe from meal plan');
      console.error('Error removing recipe:', err);
    }
  };

  const handleShoppingListCreated = (shoppingListId: string) => {
    // Navigate to shopping list view or show success message
    console.log('Shopping list created:', shoppingListId);
    loadShoppingLists(); // Reload shopping lists
  };

  const loadShoppingLists = async () => {
    if (!mealPlan) return;
    try {
      const lists = await getShoppingListsByMealPlan(mealPlan.id);
      setShoppingLists(lists);
    } catch (err) {
      console.error('Error loading shopping lists:', err);
    }
  };

  useEffect(() => {
    if (mealPlan) {
      loadShoppingLists();
    }
  }, [mealPlan]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }} data-testid="mealPlanViewPage-loading-main">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mealPlan) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3 }}>
        <Alert severity="error" data-testid="mealPlanViewPage-alert-error">
          {error || 'Meal plan not found'}
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

  const groupedRecipes = groupMealPlanRecipesByDate(mealPlanRecipes);
  const mealPlanDates = getMealPlanDates(mealPlan);

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
        <Typography color="text.primary">{mealPlan.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h4" component="h1" data-testid="mealPlanViewPage-text-title">
              {mealPlan.name}
            </Typography>
            <Box data-testid="mealPlanViewPage-chip-status">
              {getMealPlanStatusChip(mealPlan)}
            </Box>
          </Box>

          {mealPlan.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }} data-testid="mealPlanViewPage-text-description">
              {mealPlan.description}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" data-testid="mealPlanViewPage-text-dateRange">
            {mealPlan.startDate} to {mealPlan.endDate} ({mealPlanDates.length} days)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ShoppingCartIcon />}
            onClick={() => setShoppingListGeneratorOpen(true)}
            data-testid="meal-plan-generate-shopping-list-button"
          >
            Shopping List
          </Button>
          <Button
            variant="outlined"
            startIcon={<ListIcon />}
            onClick={() => setShoppingListsDialogOpen(true)}
            data-testid="meal-plan-view-shopping-lists-button"
          >
            View Lists ({shoppingLists.length})
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            data-testid="meal-plan-edit-button"
          >
            Edit Plan
          </Button>
        </Box>
      </Box>

      {/* Meal Plan Calendar */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          Meal Calendar
        </Typography>

        {mealPlanDates.length === 0 ? (
          <Typography color="text.secondary">
            No dates in this meal plan.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {mealPlanDates.map((date: string) => {
              const dayRecipes = groupedRecipes[date] || {};
              const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
              const dayOfMonth = new Date(date).toLocaleDateString('en-US', { day: 'numeric' });
              const month = new Date(date).toLocaleDateString('en-US', { month: 'short' });

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={date}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      minHeight: 200,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    data-testid={`meal-plan-day-${date}`}
                  >
                    {/* Date Header */}
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <Typography variant="h6" component="div">
                        {dayOfWeek}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {month} {dayOfMonth}
                      </Typography>
                    </Box>

                    {/* Meals for this day */}
                    <Box sx={{ flexGrow: 1 }}>
                      {mealPlan.settings.enabledMealTypes
                        .sort((a, b) => getMealTypeOrder(a) - getMealTypeOrder(b))
                        .map((mealType) => {
                          const mealRecipes = dayRecipes[mealType] || [];
                          
                          return (
                            <Box key={mealType} sx={{ mb: 2 }}>
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ mb: 0.5 }}
                              >
                                {getMealTypeDisplayName(mealType)}
                              </Typography>
                              
                              {mealRecipes.length === 0 ? (
                                <Box
                                  sx={{
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    p: 1,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      backgroundColor: 'action.hover',
                                    },
                                  }}
                                  onClick={() => handleAddRecipe(date, mealType)}
                                  data-testid={`meal-plan-add-recipe-${date}-${mealType}`}
                                >
                                  <Typography variant="body2" color="text.secondary">
                                    + Add Recipe
                                  </Typography>
                                </Box>
                              ) : (
                                mealRecipes.map((mealPlanRecipe) => {
                                  const recipe = getRecipeById(mealPlanRecipe.recipeId);
                                  return (
                                    <Box
                                      key={mealPlanRecipe.id}
                                      sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        mb: 0.5,
                                        cursor: 'pointer',
                                        position: 'relative',
                                        '&:hover': {
                                          backgroundColor: 'action.hover',
                                          '& .remove-button': {
                                            opacity: 1,
                                          },
                                        },
                                      }}
                                      onClick={() => recipe && navigate(`/recipe/${recipe.id}`)}
                                      data-testid={`meal-plan-recipe-${mealPlanRecipe.id}`}
                                    >
                                      <Typography variant="body2" sx={{ fontWeight: 'medium', pr: 3 }}>
                                        {recipe?.title || 'Unknown Recipe'}
                                      </Typography>
                                      {mealPlanRecipe.servingMultiplier !== 1 && (
                                        <Typography variant="caption" color="text.secondary">
                                          {mealPlanRecipe.servingMultiplier}x servings
                                        </Typography>
                                      )}
                                      <IconButton
                                        className="remove-button"
                                        size="small"
                                        sx={{
                                          position: 'absolute',
                                          top: 2,
                                          right: 2,
                                          opacity: 0,
                                          transition: 'opacity 0.2s',
                                          backgroundColor: 'background.paper',
                                          '&:hover': {
                                            backgroundColor: 'error.light',
                                            color: 'error.contrastText',
                                          },
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveRecipe(mealPlanRecipe.id);
                                        }}
                                        data-testid={`meal-plan-remove-recipe-${mealPlanRecipe.id}`}
                                      >
                                        ×
                                      </IconButton>
                                    </Box>
                                  );
                                })
                              )}
                            </Box>
                          );
                        })}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>

      {/* Quick Actions */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleAddRecipe(mealPlanDates[0] || '', mealPlan.settings.enabledMealTypes[0] || 'dinner')}
          data-testid="meal-plan-add-recipe-button"
        >
          Add Recipe to Plan
        </Button>
        <Button
          variant="outlined"
          startIcon={<ShoppingCartIcon />}
          onClick={() => setShoppingListGeneratorOpen(true)}
          data-testid="meal-plan-create-shopping-list-button"
        >
          Create Shopping List
        </Button>
      </Box>

      {/* Recipe Assignment Dialog */}
      <RecipeAssignmentDialog
        open={recipeAssignmentOpen}
        onClose={() => setRecipeAssignmentOpen(false)}
        mealPlanId={mealPlan.id}
        selectedDate={selectedDate}
        selectedMealType={selectedMealType}
        enabledMealTypes={mealPlan.settings.enabledMealTypes}
        onRecipeAssigned={handleRecipeAssigned}
      />

      {/* Shopping List Generator Dialog */}
      <ShoppingListGenerator
        open={shoppingListGeneratorOpen}
        onClose={() => setShoppingListGeneratorOpen(false)}
        mealPlan={mealPlan}
        onShoppingListCreated={handleShoppingListCreated}
      />

      {/* Shopping Lists Dialog */}
      <Dialog
        open={shoppingListsDialogOpen}
        onClose={() => setShoppingListsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="shopping-lists-dialog"
      >
        <DialogTitle>Shopping Lists</DialogTitle>
        <DialogContent>
          {shoppingLists.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No shopping lists created yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setShoppingListsDialogOpen(false);
                  setShoppingListGeneratorOpen(true);
                }}
                sx={{ mt: 2 }}
              >
                Create Shopping List
              </Button>
            </Box>
          ) : (
            <List>
              {shoppingLists.map((list, index) => (
                <React.Fragment key={list.id}>
                  <ListItem>
                    <ListItemText
                      primary={list.name}
                      secondary={`${list.dateRangeStart} to ${list.dateRangeEnd}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => {
                          setShoppingListsDialogOpen(false);
                          navigate(`/shopping-lists/${list.id}`);
                        }}
                      >
                        View
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < shoppingLists.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MealPlanView;
