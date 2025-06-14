import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  CalendarMonth as CalendarIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,

} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  MealPlan,
  MEAL_TYPES,
  DEFAULT_MEAL_PLAN_SETTINGS,
  getMealTypeDisplayName,
  isMealPlanActive,
  isMealPlanUpcoming,
  isMealPlanPast,
  getMealPlanDuration,
} from '@app-types';
import {
  getAllMealPlans,
  saveMealPlan,
  deleteMealPlan,
  createNewMealPlan,
} from '@services/mealPlanStorage';


const MealPlans: React.FC = () => {
  const navigate = useNavigate();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);

  // Form state for creating/editing meal plans
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
    enabledMealTypes: DEFAULT_MEAL_PLAN_SETTINGS.enabledMealTypes,
    defaultServings: DEFAULT_MEAL_PLAN_SETTINGS.defaultServings,
  });

  useEffect(() => {
    loadMealPlans();
  }, []);

  const loadMealPlans = async () => {
    try {
      setLoading(true);
      const plans = await getAllMealPlans();
      setMealPlans(plans);
      setError(null);
    } catch (err) {
      setError('Failed to load meal plans');
      console.error('Error loading meal plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMealPlan = async () => {
    try {
      const startDateStr = formData.startDate.toISOString().split('T')[0];
      const endDateStr = formData.endDate.toISOString().split('T')[0];

      const newMealPlan = createNewMealPlan(
        formData.name,
        startDateStr,
        endDateStr,
        formData.description || undefined
      );

      // Update settings
      newMealPlan.settings = {
        enabledMealTypes: formData.enabledMealTypes,
        defaultServings: formData.defaultServings,
      };

      await saveMealPlan(newMealPlan);
      await loadMealPlans();
      setCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      setError('Failed to create meal plan');
      console.error('Error creating meal plan:', err);
    }
  };

  const handleDeleteMealPlan = async (mealPlan: MealPlan) => {
    if (window.confirm(`Are you sure you want to delete "${mealPlan.name}"?`)) {
      try {
        await deleteMealPlan(mealPlan.id);
        await loadMealPlans();
      } catch (err) {
        setError('Failed to delete meal plan');
        console.error('Error deleting meal plan:', err);
      }
    }
    setMenuAnchor(null);
    setSelectedMealPlan(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      enabledMealTypes: DEFAULT_MEAL_PLAN_SETTINGS.enabledMealTypes,
      defaultServings: DEFAULT_MEAL_PLAN_SETTINGS.defaultServings,
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, mealPlan: MealPlan) => {
    setMenuAnchor(event.currentTarget);
    setSelectedMealPlan(mealPlan);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedMealPlan(null);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Meal Plans
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            data-testid="meal-plans-create-button"
          >
            Create Meal Plan
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Meal Plans Grid */}
        {mealPlans.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CalendarIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No meal plans yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Create your first meal plan to start organizing your meals.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              data-testid="meal-plans-empty-create-button"
            >
              Create Meal Plan
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {mealPlans.map((mealPlan) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mealPlan.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease-in-out',
                    },
                  }}
                  onClick={() => navigate(`/meal-plans/${mealPlan.id}`)}
                  data-testid={`meal-plan-card-${mealPlan.id}`}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                        {mealPlan.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, mealPlan);
                        }}
                        data-testid={`meal-plan-menu-${mealPlan.id}`}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>

                    {mealPlan.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {mealPlan.description}
                      </Typography>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {mealPlan.startDate} to {mealPlan.endDate}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getMealPlanDuration(mealPlan)} days
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {getMealPlanStatusChip(mealPlan)}
                      {mealPlan.settings.enabledMealTypes.map((mealType) => (
                        <Chip
                          key={mealType}
                          label={getMealTypeDisplayName(mealType)}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<CalendarIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/meal-plans/${mealPlan.id}`);
                      }}
                      data-testid={`meal-plan-view-${mealPlan.id}`}
                    >
                      View Plan
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create Meal Plan Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          data-testid="meal-plan-create-dialog"
        >
          <DialogTitle>Create New Meal Plan</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <TextField
                label="Meal Plan Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                data-testid="meal-plan-name-input"
              />

              <TextField
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
                data-testid="meal-plan-description-input"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(date) => date && setFormData({ ...formData, startDate: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      inputProps: { 'data-testid': 'meal-plan-start-date-input' },
                    },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={formData.endDate}
                  onChange={(date) => date && setFormData({ ...formData, endDate: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      inputProps: { 'data-testid': 'meal-plan-end-date-input' },
                    },
                  }}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel>Enabled Meal Types</InputLabel>
                <Select
                  multiple
                  value={formData.enabledMealTypes}
                  onChange={(e) => setFormData({ ...formData, enabledMealTypes: e.target.value as string[] })}
                  input={<OutlinedInput label="Enabled Meal Types" />}
                  renderValue={(selected) => selected.map(getMealTypeDisplayName).join(', ')}
                  data-testid="meal-plan-meal-types-select"
                >
                  {Object.values(MEAL_TYPES).map((mealType) => (
                    <MenuItem key={mealType} value={mealType}>
                      <Checkbox checked={formData.enabledMealTypes.indexOf(mealType) > -1} />
                      <ListItemText primary={getMealTypeDisplayName(mealType)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Default Servings"
                type="number"
                value={formData.defaultServings}
                onChange={(e) => setFormData({ ...formData, defaultServings: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1, max: 20 }}
                data-testid="meal-plan-default-servings-input"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} data-testid="meal-plan-create-cancel-button">
              Cancel
            </Button>
            <Button
              onClick={handleCreateMealPlan}
              variant="contained"
              disabled={!formData.name.trim()}
              data-testid="meal-plan-create-save-button"
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Meal Plan Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          data-testid="meal-plan-context-menu"
        >
          <MenuItem
            onClick={() => {
              if (selectedMealPlan) {
                navigate(`/meal-plans/${selectedMealPlan.id}`);
              }
              handleMenuClose();
            }}
            data-testid="meal-plan-menu-view"
          >
            <CalendarIcon sx={{ mr: 1 }} />
            View Plan
          </MenuItem>
          <MenuItem
            onClick={() => {
              // TODO: Implement edit functionality
              handleMenuClose();
            }}
            data-testid="meal-plan-menu-edit"
          >
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedMealPlan) {
                handleDeleteMealPlan(selectedMealPlan);
              }
            }}
            data-testid="meal-plan-menu-delete"
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      </Box>
    </LocalizationProvider>
  );
};

export default MealPlans;
