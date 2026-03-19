import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  List as ListIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MealPlan,
  MealPlanRecipe,
  Recipe,
  getMealPlanDates,
  getMealTypeDisplayName,
  getMealTypeOrder,
  isMealPlanActive,
  isMealPlanPast,
  isMealPlanUpcoming,
} from '@app-types';
import {
  deleteMealPlanRecipe,
  getMealPlanById,
  getMealPlanRecipes,
  groupMealPlanRecipesByDate,
} from '@services/mealPlanStorage';
import { getAllRecipes } from '@services/recipeStorage';
import { getShoppingListsByMealPlan } from '@services/shoppingListStorage';
import RecipeAssignmentDialog from '@components/RecipeAssignmentDialog';
import ShoppingListGenerator from '@components/ShoppingListGenerator';
import { parseDateOnly } from '@utils/timeUtils';

interface MealPlanViewProps {
  mealPlanId?: string;
  embedded?: boolean;
  onEditPlan?: (mealPlan: MealPlan) => void;
  onSelectShoppingList?: (shoppingListId: string) => void;
}

const PLANNER_MEAL_PLANS_PATH = '/planner?tab=meal-plans';

const MealPlanView: React.FC<MealPlanViewProps> = ({
  mealPlanId,
  embedded = false,
  onEditPlan,
  onSelectShoppingList,
}) => {
  const { id: routeMealPlanId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resolvedMealPlanId = mealPlanId || routeMealPlanId;

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [mealPlanRecipes, setMealPlanRecipes] = useState<MealPlanRecipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeAssignmentOpen, setRecipeAssignmentOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('');
  const [shoppingListGeneratorOpen, setShoppingListGeneratorOpen] = useState(false);
  const [shoppingListsDialogOpen, setShoppingListsDialogOpen] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<any[]>([]);

  useEffect(() => {
    if (!resolvedMealPlanId) {
      setMealPlan(null);
      setMealPlanRecipes([]);
      setLoading(false);
      setError('Meal plan not found');
      return;
    }

    const loadMealPlanData = async () => {
      try {
        setLoading(true);

        const [mealPlanData, mealPlanRecipesData, recipesData] = await Promise.all([
          getMealPlanById(resolvedMealPlanId),
          getMealPlanRecipes(resolvedMealPlanId),
          getAllRecipes(),
        ]);

        if (!mealPlanData) {
          setMealPlan(null);
          setMealPlanRecipes([]);
          setRecipes([]);
          setError('Meal plan not found');
          return;
        }

        setMealPlan(mealPlanData);
        setMealPlanRecipes(mealPlanRecipesData);
        setRecipes(recipesData);
        setError(null);
      } catch (loadError) {
        setError('Failed to load meal plan data');
        console.error('Error loading meal plan data:', loadError);
      } finally {
        setLoading(false);
      }
    };

    loadMealPlanData();
  }, [resolvedMealPlanId]);

  const loadShoppingLists = async () => {
    if (!mealPlan) {
      return;
    }

    try {
      const lists = await getShoppingListsByMealPlan(mealPlan.id);
      setShoppingLists(lists);
    } catch (loadError) {
      console.error('Error loading shopping lists:', loadError);
    }
  };

  useEffect(() => {
    if (mealPlan) {
      loadShoppingLists();
    }
  }, [mealPlan]);

  const getMealPlanStatusChip = (value: MealPlan) => {
    if (isMealPlanActive(value)) {
      return <Chip label="Active" color="success" size="small" />;
    }

    if (isMealPlanUpcoming(value)) {
      return <Chip label="Upcoming" color="info" size="small" />;
    }

    if (isMealPlanPast(value)) {
      return <Chip label="Past" color="default" size="small" />;
    }

    return null;
  };

  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return recipes.find((recipe) => recipe.id === recipeId);
  };

  const handleAddRecipe = (date: string, mealType: string) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setRecipeAssignmentOpen(true);
  };

  const handleRecipeAssigned = () => {
    if (!resolvedMealPlanId) {
      return;
    }

    setLoading(true);
    Promise.all([
      getMealPlanById(resolvedMealPlanId),
      getMealPlanRecipes(resolvedMealPlanId),
      getAllRecipes(),
    ]).then(([mealPlanData, mealPlanRecipesData, recipesData]) => {
      if (!mealPlanData) {
        setMealPlan(null);
        setMealPlanRecipes([]);
        setRecipes([]);
        setError('Meal plan not found');
        return;
      }

      setMealPlan(mealPlanData);
      setMealPlanRecipes(mealPlanRecipesData);
      setRecipes(recipesData);
      setError(null);
    }).catch((loadError) => {
      setError('Failed to load meal plan data');
      console.error('Error loading meal plan data:', loadError);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleRemoveRecipe = async (mealPlanRecipeId: string) => {
    try {
      await deleteMealPlanRecipe(mealPlanRecipeId);
      handleRecipeAssigned();
    } catch (removeError) {
      setError('Failed to remove recipe from meal plan');
      console.error('Error removing recipe:', removeError);
    }
  };

  const handleOpenEditPlan = () => {
    if (mealPlan && onEditPlan) {
      onEditPlan(mealPlan);
    }
  };

  const handleViewShoppingList = (shoppingListId: string) => {
    setShoppingListsDialogOpen(false);

    if (onSelectShoppingList) {
      onSelectShoppingList(shoppingListId);
      return;
    }

    navigate(`/planner?tab=shopping-lists&shoppingListId=${shoppingListId}`);
  };

  const handleShoppingListCreated = (shoppingListId: string) => {
    loadShoppingLists();
    handleViewShoppingList(shoppingListId);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }} data-testid="mealPlanViewPage-loading-main">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mealPlan) {
    return (
      <Box sx={{ maxWidth: embedded ? undefined : 1200, mx: embedded ? 0 : 'auto', py: embedded ? 0 : 3 }}>
        <Alert severity="error" data-testid="mealPlanViewPage-alert-error">
          {error || 'Meal plan not found'}
        </Alert>
        {!embedded ? (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(PLANNER_MEAL_PLANS_PATH)}
            sx={{ mt: 2 }}
          >
            Back to Planner
          </Button>
        ) : null}
      </Box>
    );
  }

  const groupedRecipes = groupMealPlanRecipesByDate(mealPlanRecipes);
  const mealPlanDates = getMealPlanDates(mealPlan);

  return (
    <Box sx={{ maxWidth: embedded ? undefined : 1200, mx: embedded ? 0 : 'auto', py: embedded ? 0 : 3 }}>
      {!embedded ? (
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate(PLANNER_MEAL_PLANS_PATH)}
            sx={{ textDecoration: 'none' }}
          >
            Meal Plans
          </Link>
          <Typography color="text.primary">{mealPlan.name}</Typography>
        </Breadcrumbs>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="h4" component="h1" data-testid="mealPlanViewPage-text-title">
              {mealPlan.name}
            </Typography>
            <Box data-testid="mealPlanViewPage-chip-status">
              {getMealPlanStatusChip(mealPlan)}
            </Box>
          </Box>

          {mealPlan.description ? (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }} data-testid="mealPlanViewPage-text-description">
              {mealPlan.description}
            </Typography>
          ) : null}

          <Typography variant="body2" color="text.secondary" data-testid="mealPlanViewPage-text-dateRange">
            {mealPlan.startDate} to {mealPlan.endDate} ({mealPlanDates.length} days)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
          {onEditPlan ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleOpenEditPlan}
              data-testid="meal-plan-edit-button"
            >
              Edit Plan
            </Button>
          ) : null}
        </Box>
      </Box>

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
            {mealPlanDates.map((date) => {
              const dayRecipes = groupedRecipes[date] || {};
              const localDate = parseDateOnly(date);
              const dayOfWeek = localDate.toLocaleDateString('en-US', { weekday: 'short' });
              const dayOfMonth = localDate.toLocaleDateString('en-US', { day: 'numeric' });
              const month = localDate.toLocaleDateString('en-US', { month: 'short' });

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
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <Typography variant="h6" component="div">
                        {dayOfWeek}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {month} {dayOfMonth}
                      </Typography>
                    </Box>

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
                                      {mealPlanRecipe.servingMultiplier !== 1 ? (
                                        <Typography variant="caption" color="text.secondary">
                                          {mealPlanRecipe.servingMultiplier}x servings
                                        </Typography>
                                      ) : null}
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
                                        onClick={(event) => {
                                          event.stopPropagation();
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

      <RecipeAssignmentDialog
        open={recipeAssignmentOpen}
        onClose={() => setRecipeAssignmentOpen(false)}
        mealPlanId={mealPlan.id}
        selectedDate={selectedDate}
        selectedMealType={selectedMealType}
        enabledMealTypes={mealPlan.settings.enabledMealTypes}
        onRecipeAssigned={handleRecipeAssigned}
      />

      <ShoppingListGenerator
        open={shoppingListGeneratorOpen}
        onClose={() => setShoppingListGeneratorOpen(false)}
        mealPlan={mealPlan}
        onShoppingListCreated={handleShoppingListCreated}
      />

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
              {shoppingLists.map((shoppingList, index) => (
                <React.Fragment key={shoppingList.id}>
                  <ListItem>
                    <ListItemText
                      primary={shoppingList.name}
                      secondary={`${shoppingList.dateRangeStart} to ${shoppingList.dateRangeEnd}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => handleViewShoppingList(shoppingList.id)}
                      >
                        View
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < shoppingLists.length - 1 ? <Divider /> : null}
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
