import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Tabs, Tab, FormControl, InputLabel, Select, MenuItem,
  Button, CircularProgress, Alert, Paper, List, ListItem, ListItemText,
  Divider, Card, CardContent, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  ShoppingCart as ShoppingCartIcon,
  EventNote as EventNoteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MealPlan, ShoppingList, isMealPlanActive, isMealPlanUpcoming, isMealPlanPast } from '@app-types';
import { getAllMealPlans } from '@services/mealPlanStorage';
import { getAllShoppingLists } from '@services/shoppingListStorage';
import MealPlanView from '@pages/MealPlanView';
import ShoppingListView from '@components/ShoppingListView';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`planner-tabpanel-${index}`}
      aria-labelledby={`planner-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `planner-tab-${index}`,
    'aria-controls': `planner-tabpanel-${index}`,
  };
}

const Planner: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Meal Plans state
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [mealPlansLoading, setMealPlansLoading] = useState(false);
  const [mealPlansError, setMealPlansError] = useState<string | null>(null);

  // Shopping Lists state
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [selectedShoppingList, setSelectedShoppingList] = useState<ShoppingList | null>(null);
  const [shoppingListsLoading, setShoppingListsLoading] = useState(false);
  const [shoppingListsError, setShoppingListsError] = useState<string | null>(null);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Load data for the selected tab
    if (newValue === 0 && mealPlans.length === 0) {
      loadMealPlans();
    } else if (newValue === 1 && shoppingLists.length === 0) {
      loadShoppingLists();
    }
  };

  const loadMealPlans = async () => {
    try {
      setMealPlansLoading(true);
      const mealPlansData = await getAllMealPlans();
      // Sort by date created (most recent first)
      const sortedMealPlans = mealPlansData.sort((a, b) =>
        new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      );
      setMealPlans(sortedMealPlans);

      // Auto-select the first active meal plan, or the first upcoming, or the first one
      const activePlan = sortedMealPlans.find(plan => isMealPlanActive(plan));
      const upcomingPlan = sortedMealPlans.find(plan => isMealPlanUpcoming(plan));
      const defaultPlan = activePlan || upcomingPlan || sortedMealPlans[0];

      if (defaultPlan) {
        setSelectedMealPlan(defaultPlan);
      }

      setMealPlansError(null);
    } catch (err) {
      setMealPlansError('Failed to load meal plans');
      console.error('Error loading meal plans:', err);
    } finally {
      setMealPlansLoading(false);
    }
  };

  const loadShoppingLists = async () => {
    try {
      setShoppingListsLoading(true);
      const shoppingListsData = await getAllShoppingLists();
      // Sort by date created (most recent first)
      const sortedShoppingLists = shoppingListsData.sort((a, b) =>
        new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      );
      setShoppingLists(sortedShoppingLists);
      setShoppingListsError(null);
    } catch (err) {
      setShoppingListsError('Failed to load shopping lists');
      console.error('Error loading shopping lists:', err);
    } finally {
      setShoppingListsLoading(false);
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

  // Initialize with meal plans
  useEffect(() => {
    loadMealPlans();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="planner-title">
        Planner
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="planner tabs">
          <Tab label="Meal Plan" {...a11yProps(0)} data-testid="planner-tab-meal-plan" />
          <Tab label="Shopping Lists" {...a11yProps(1)} data-testid="planner-tab-shopping-lists" />
        </Tabs>
      </Box>

      {/* Meal Plan Tab */}
      <TabPanel value={tabValue} index={0}>
        {mealPlansLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : mealPlansError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {mealPlansError}
          </Alert>
        ) : mealPlans.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <EventNoteIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>
                No meal plans yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Create your first meal plan to start organizing your meals.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => navigate('/meal-plans')}
                data-testid="planner-create-first-meal-plan-button"
              >
                Create Meal Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box>
            {/* Meal Plan Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <FormControl sx={{ minWidth: 300 }}>
                <InputLabel>Select Meal Plan</InputLabel>
                <Select
                  value={selectedMealPlan?.id || ''}
                  onChange={(e) => {
                    const plan = mealPlans.find(p => p.id === e.target.value);
                    setSelectedMealPlan(plan || null);
                  }}
                  label="Select Meal Plan"
                  data-testid="planner-meal-plan-selector"
                >
                  {mealPlans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography sx={{ flexGrow: 1 }}>{plan.name}</Typography>
                        {getMealPlanStatusChip(plan)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/meal-plans')}
                data-testid="planner-create-meal-plan-button"
              >
                Create New Plan
              </Button>
            </Box>

            {/* Selected Meal Plan View */}
            {selectedMealPlan ? (
              <Box sx={{
                '& > div': {
                  p: 0 // Remove padding from MealPlanView since we're already in a padded container
                }
              }}>
                <MealPlanView />
              </Box>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  Select a meal plan to view details
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Shopping Lists Tab */}
      <TabPanel value={tabValue} index={1}>
        {selectedShoppingList ? (
          /* Shopping List View */
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Button
                onClick={() => setSelectedShoppingList(null)}
                startIcon={<CalendarIcon />}
                data-testid="planner-shopping-lists-back-button"
              >
                Back to Shopping Lists
              </Button>
            </Box>

            <ShoppingListView
              shoppingList={selectedShoppingList}
              onItemsChanged={() => {
                // Refresh shopping lists
                loadShoppingLists();
              }}
              onDelete={() => {
                setSelectedShoppingList(null);
                loadShoppingLists();
              }}
            />
          </Box>
        ) : (
          /* Shopping Lists List */
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">
                Shopping Lists
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setTabValue(0)}
                data-testid="planner-create-shopping-list-button"
              >
                Create from Meal Plan
              </Button>
            </Box>

            {shoppingListsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {shoppingListsError}
              </Alert>
            )}

            {shoppingListsLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
              </Box>
            ) : shoppingLists.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 8 }}>
                  <ShoppingCartIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    No shopping lists yet
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Create shopping lists from your meal plans to organize your grocery shopping.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => setTabValue(0)}
                    data-testid="planner-create-first-shopping-list-button"
                  >
                    Go to Meal Plans
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Paper>
                <List>
                  {shoppingLists.map((list, index) => (
                    <React.Fragment key={list.id}>
                      <ListItem
                        component="button"
                        onClick={() => setSelectedShoppingList(list)}
                        data-testid={`planner-shopping-list-${list.id}`}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <ListItemText
                          primary={list.name}
                          secondary={`${list.dateRangeStart} to ${list.dateRangeEnd}`}
                        />
                      </ListItem>
                      {index < shoppingLists.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};

export default Planner;
