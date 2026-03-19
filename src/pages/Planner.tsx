import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  EventNote as EventNoteIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { MealPlan, ShoppingList, isMealPlanActive, isMealPlanPast, isMealPlanUpcoming } from '@app-types';
import { createNewMealPlan, getAllMealPlans, saveMealPlan } from '@services/mealPlanStorage';
import { getAllShoppingLists } from '@services/shoppingListStorage';
import MealPlanView from '@pages/MealPlanView';
import ShoppingListView from '@components/ShoppingListView';
import MealPlanDialog, { MealPlanFormValues } from '@components/MealPlanDialog';
import { getCurrentTimestamp } from '@utils/timeUtils';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const PLANNER_TABS = {
  mealPlans: 'meal-plans',
  shoppingLists: 'shopping-lists',
} as const;

type PlannerTab = typeof PLANNER_TABS[keyof typeof PLANNER_TABS];

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
      {value === index ? (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      ) : null}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `planner-tab-${index}`,
    'aria-controls': `planner-tabpanel-${index}`,
  };
}

function getPlannerTab(searchParams: URLSearchParams): PlannerTab {
  return searchParams.get('tab') === PLANNER_TABS.shoppingLists
    ? PLANNER_TABS.shoppingLists
    : PLANNER_TABS.mealPlans;
}

function getPlannerTabIndex(tab: PlannerTab): number {
  return tab === PLANNER_TABS.shoppingLists ? 1 : 0;
}

function getDefaultMealPlan(mealPlans: MealPlan[]): MealPlan | undefined {
  const activePlan = mealPlans.find((plan) => isMealPlanActive(plan));
  const upcomingPlan = mealPlans.find((plan) => isMealPlanUpcoming(plan));
  return activePlan || upcomingPlan || mealPlans[0];
}

const Planner: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealPlansLoading, setMealPlansLoading] = useState(false);
  const [mealPlansError, setMealPlansError] = useState<string | null>(null);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [shoppingListsLoading, setShoppingListsLoading] = useState(false);
  const [shoppingListsError, setShoppingListsError] = useState<string | null>(null);
  const [shoppingListsLoaded, setShoppingListsLoaded] = useState(false);
  const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
  const [editingMealPlan, setEditingMealPlan] = useState<MealPlan | null>(null);

  const activeTab = getPlannerTab(searchParams);
  const selectedMealPlanId = searchParams.get('mealPlanId') || '';
  const selectedShoppingListId = searchParams.get('shoppingListId') || '';

  const updatePlannerSearchParams = useCallback((updates: Record<string, string | null>, replace = false) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        nextSearchParams.set(key, value);
      } else {
        nextSearchParams.delete(key);
      }
    });

    setSearchParams(nextSearchParams, { replace });
  }, [searchParams, setSearchParams]);

  const loadMealPlans = useCallback(async (): Promise<MealPlan[]> => {
    try {
      setMealPlansLoading(true);
      const mealPlansData = await getAllMealPlans();
      const sortedMealPlans = [...mealPlansData].sort(
        (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      );
      setMealPlans(sortedMealPlans);
      setMealPlansError(null);
      return sortedMealPlans;
    } catch (error) {
      setMealPlansError('Failed to load meal plans');
      console.error('Error loading meal plans:', error);
      return [];
    } finally {
      setMealPlansLoading(false);
    }
  }, []);

  const loadShoppingLists = useCallback(async (): Promise<ShoppingList[]> => {
    try {
      setShoppingListsLoading(true);
      const shoppingListsData = await getAllShoppingLists();
      const sortedShoppingLists = [...shoppingListsData].sort(
        (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      );
      setShoppingLists(sortedShoppingLists);
      setShoppingListsError(null);
      setShoppingListsLoaded(true);
      return sortedShoppingLists;
    } catch (error) {
      setShoppingListsError('Failed to load shopping lists');
      console.error('Error loading shopping lists:', error);
      setShoppingListsLoaded(true);
      return [];
    } finally {
      setShoppingListsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMealPlans();
  }, [loadMealPlans]);

  useEffect(() => {
    if (activeTab === PLANNER_TABS.shoppingLists || selectedShoppingListId) {
      loadShoppingLists();
    }
  }, [activeTab, selectedShoppingListId, loadShoppingLists]);

  useEffect(() => {
    if (mealPlansLoading) {
      return;
    }

    if (mealPlans.length === 0) {
      if (selectedMealPlanId) {
        updatePlannerSearchParams({ mealPlanId: null }, true);
      }
      return;
    }

    if (mealPlans.some((mealPlan) => mealPlan.id === selectedMealPlanId)) {
      return;
    }

    const defaultMealPlan = getDefaultMealPlan(mealPlans);
    if (defaultMealPlan) {
      updatePlannerSearchParams({ mealPlanId: defaultMealPlan.id }, true);
    }
  }, [mealPlans, mealPlansLoading, selectedMealPlanId, updatePlannerSearchParams]);

  useEffect(() => {
    if (!shoppingListsLoaded || shoppingListsLoading || !selectedShoppingListId) {
      return;
    }

    if (!shoppingLists.some((shoppingList) => shoppingList.id === selectedShoppingListId)) {
      updatePlannerSearchParams({ shoppingListId: null }, true);
    }
  }, [shoppingLists, shoppingListsLoaded, shoppingListsLoading, selectedShoppingListId, updatePlannerSearchParams]);

  const selectedMealPlan = useMemo(
    () => mealPlans.find((mealPlan) => mealPlan.id === selectedMealPlanId) || null,
    [mealPlans, selectedMealPlanId]
  );

  const selectedShoppingList = useMemo(
    () => shoppingLists.find((shoppingList) => shoppingList.id === selectedShoppingListId) || null,
    [shoppingLists, selectedShoppingListId]
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    updatePlannerSearchParams({
      tab: newValue === 1 ? PLANNER_TABS.shoppingLists : PLANNER_TABS.mealPlans,
    });
  };

  const handleOpenCreateMealPlanDialog = () => {
    setEditingMealPlan(null);
    setMealPlanDialogOpen(true);
  };

  const handleOpenEditMealPlanDialog = (mealPlan: MealPlan) => {
    setEditingMealPlan(mealPlan);
    setMealPlanDialogOpen(true);
  };

  const handleCloseMealPlanDialog = () => {
    setMealPlanDialogOpen(false);
    setEditingMealPlan(null);
  };

  const handleSaveMealPlan = async (values: MealPlanFormValues) => {
    const mealPlanToSave = editingMealPlan
      ? {
          ...editingMealPlan,
          name: values.name,
          description: values.description || undefined,
          startDate: values.startDate,
          endDate: values.endDate,
          settings: {
            enabledMealTypes: values.enabledMealTypes,
            defaultServings: values.defaultServings,
          },
          dateModified: getCurrentTimestamp(),
        }
      : {
          ...createNewMealPlan(
            values.name,
            values.startDate,
            values.endDate,
            values.description || undefined
          ),
          settings: {
            enabledMealTypes: values.enabledMealTypes,
            defaultServings: values.defaultServings,
          },
        };

    await saveMealPlan(mealPlanToSave);
    await loadMealPlans();

    updatePlannerSearchParams({
      tab: PLANNER_TABS.mealPlans,
      mealPlanId: mealPlanToSave.id,
    });

    handleCloseMealPlanDialog();
  };

  const handleSelectShoppingList = (shoppingListId: string) => {
    updatePlannerSearchParams({
      tab: PLANNER_TABS.shoppingLists,
      shoppingListId,
    });
  };

  const getMealPlanStatusChip = (mealPlan: MealPlan) => {
    if (isMealPlanActive(mealPlan)) {
      return <Chip label="Active" color="success" size="small" />;
    }

    if (isMealPlanUpcoming(mealPlan)) {
      return <Chip label="Upcoming" color="info" size="small" />;
    }

    if (isMealPlanPast(mealPlan)) {
      return <Chip label="Past" color="default" size="small" />;
    }

    return null;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="plannerPage-title-main">
        Planner
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }} data-testid="plannerPage-tabs-main">
        <Tabs value={getPlannerTabIndex(activeTab)} onChange={handleTabChange} aria-label="planner tabs">
          <Tab label="Meal Plan" {...a11yProps(0)} data-testid="plannerPage-tab-mealPlan" />
          <Tab label="Shopping Lists" {...a11yProps(1)} data-testid="plannerPage-tab-shoppingLists" />
        </Tabs>
      </Box>

      <TabPanel value={getPlannerTabIndex(activeTab)} index={0}>
        {mealPlansLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px" data-testid="plannerPage-mealPlan-loading">
            <CircularProgress />
          </Box>
        ) : mealPlansError ? (
          <Alert severity="error" sx={{ mb: 3 }} data-testid="plannerPage-mealPlan-alert-error">
            {mealPlansError}
          </Alert>
        ) : mealPlans.length === 0 ? (
          <Card data-testid="plannerPage-mealPlans-text-noPlans">
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
                onClick={handleOpenCreateMealPlanDialog}
                data-testid="plannerPage-mealPlan-button-createFirst"
              >
                Create Meal Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 300 }}>
                <InputLabel>Select Meal Plan</InputLabel>
                <Select
                  value={selectedMealPlan?.id || ''}
                  onChange={(event) => updatePlannerSearchParams({ mealPlanId: event.target.value })}
                  label="Select Meal Plan"
                  data-testid="plannerPage-mealPlan-select-plan"
                >
                  {mealPlans.map((mealPlan) => (
                    <MenuItem key={mealPlan.id} value={mealPlan.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography sx={{ flexGrow: 1 }}>{mealPlan.name}</Typography>
                        {getMealPlanStatusChip(mealPlan)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateMealPlanDialog}
                data-testid="plannerPage-mealPlan-button-createNewPlan"
              >
                Create New Plan
              </Button>
            </Box>

            {selectedMealPlan ? (
              <Box sx={{ '& > div': { p: 0 } }}>
                <MealPlanView
                  mealPlanId={selectedMealPlan.id}
                  embedded
                  onEditPlan={handleOpenEditMealPlanDialog}
                  onSelectShoppingList={handleSelectShoppingList}
                />
              </Box>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }} data-testid="plannerPage-mealPlans-text-selectPlan">
                <Typography variant="h6" color="text.secondary">
                  Select a meal plan to view details
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={getPlannerTabIndex(activeTab)} index={1}>
        {selectedShoppingList ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Button
                onClick={() => updatePlannerSearchParams({ shoppingListId: null })}
                startIcon={<CalendarIcon />}
                data-testid="plannerPage-shoppingLists-button-back"
              >
                Back to Shopping Lists
              </Button>
            </Box>

            <ShoppingListView
              shoppingList={selectedShoppingList}
              onItemsChanged={() => {
                loadShoppingLists();
              }}
              onDelete={() => {
                updatePlannerSearchParams({ shoppingListId: null });
                loadShoppingLists();
              }}
            />
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">
                Shopping Lists
              </Typography>
              <Button
                variant="outlined"
                onClick={() => updatePlannerSearchParams({ tab: PLANNER_TABS.mealPlans })}
                data-testid="plannerPage-shoppingLists-button-createFromMealPlan"
              >
                Create from Meal Plan
              </Button>
            </Box>

            {shoppingListsError ? (
              <Alert severity="error" sx={{ mb: 3 }} data-testid="plannerPage-shoppingLists-alert-error">
                {shoppingListsError}
              </Alert>
            ) : null}

            {shoppingListsLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px" data-testid="plannerPage-shoppingLists-loading">
                <CircularProgress />
              </Box>
            ) : shoppingLists.length === 0 ? (
              <Card data-testid="plannerPage-shoppingLists-text-noLists">
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
                    onClick={() => updatePlannerSearchParams({ tab: PLANNER_TABS.mealPlans })}
                    data-testid="plannerPage-shoppingLists-button-goToMealPlans"
                  >
                    Go to Meal Plans
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Paper data-testid="plannerPage-shoppingLists-list-main">
                <List>
                  {shoppingLists.map((shoppingList, index) => (
                    <React.Fragment key={shoppingList.id}>
                      <ListItem
                        component="button"
                        onClick={() => handleSelectShoppingList(shoppingList.id)}
                        data-testid={`plannerPage-shoppingLists-listItem-${shoppingList.id}`}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <ListItemText
                          primary={shoppingList.name}
                          secondary={`${shoppingList.dateRangeStart} to ${shoppingList.dateRangeEnd}`}
                        />
                      </ListItem>
                      {index < shoppingLists.length - 1 ? <Divider /> : null}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        )}
      </TabPanel>

      <MealPlanDialog
        open={mealPlanDialogOpen}
        mode={editingMealPlan ? 'edit' : 'create'}
        initialMealPlan={editingMealPlan}
        onClose={handleCloseMealPlanDialog}
        onSave={handleSaveMealPlan}
      />
    </Box>
  );
};

export default Planner;
