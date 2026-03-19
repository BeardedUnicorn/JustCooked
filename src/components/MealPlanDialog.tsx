import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@mui/material';
import {
  DEFAULT_MEAL_PLAN_SETTINGS,
  MealPlan,
  MEAL_TYPES,
  getMealTypeDisplayName,
} from '@app-types';
import { getTodayLocalDateString } from '@utils/timeUtils';

export interface MealPlanFormValues {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  enabledMealTypes: string[];
  defaultServings: number;
}

interface MealPlanDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialMealPlan?: MealPlan | null;
  onClose: () => void;
  onSave: (values: MealPlanFormValues) => Promise<void> | void;
}

function buildDefaultValues(): MealPlanFormValues {
  const today = getTodayLocalDateString();

  return {
    name: '',
    description: '',
    startDate: today,
    endDate: today,
    enabledMealTypes: [...DEFAULT_MEAL_PLAN_SETTINGS.enabledMealTypes],
    defaultServings: DEFAULT_MEAL_PLAN_SETTINGS.defaultServings,
  };
}

function buildValuesFromMealPlan(mealPlan: MealPlan): MealPlanFormValues {
  return {
    name: mealPlan.name,
    description: mealPlan.description || '',
    startDate: mealPlan.startDate,
    endDate: mealPlan.endDate,
    enabledMealTypes: [...mealPlan.settings.enabledMealTypes],
    defaultServings: mealPlan.settings.defaultServings,
  };
}

const MealPlanDialog: React.FC<MealPlanDialogProps> = ({
  open,
  mode,
  initialMealPlan,
  onClose,
  onSave,
}) => {
  const [formValues, setFormValues] = useState<MealPlanFormValues>(buildDefaultValues);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormValues(initialMealPlan ? buildValuesFromMealPlan(initialMealPlan) : buildDefaultValues());
    setError('');
    setSaving(false);
  }, [open, initialMealPlan]);

  const handleChange = <K extends keyof MealPlanFormValues>(key: K, value: MealPlanFormValues[K]) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleMealTypeToggle = (mealType: string) => {
    setFormValues((current) => {
      const enabledMealTypes = current.enabledMealTypes.includes(mealType)
        ? current.enabledMealTypes.filter((value) => value !== mealType)
        : [...current.enabledMealTypes, mealType];

      return {
        ...current,
        enabledMealTypes,
      };
    });
  };

  const handleSave = async () => {
    const trimmedName = formValues.name.trim();
    const trimmedDescription = formValues.description.trim();

    if (!trimmedName) {
      setError('Meal plan name is required');
      return;
    }

    if (formValues.startDate > formValues.endDate) {
      setError('Start date must be on or before the end date');
      return;
    }

    if (formValues.enabledMealTypes.length === 0) {
      setError('Select at least one meal type');
      return;
    }

    if (!Number.isFinite(formValues.defaultServings) || formValues.defaultServings < 1) {
      setError('Default servings must be at least 1');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        ...formValues,
        name: trimmedName,
        description: trimmedDescription,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save meal plan');
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="meal-plan-dialog">
      <DialogTitle>{mode === 'create' ? 'Create Meal Plan' : 'Edit Meal Plan'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error ? (
            <Alert severity="error" data-testid="meal-plan-form-error">
              {error}
            </Alert>
          ) : null}

          <TextField
            label="Meal Plan Name"
            value={formValues.name}
            onChange={(event) => handleChange('name', event.target.value)}
            fullWidth
            required
            data-testid="meal-plan-form-name"
          />

          <TextField
            label="Description"
            value={formValues.description}
            onChange={(event) => handleChange('description', event.target.value)}
            fullWidth
            multiline
            minRows={3}
            data-testid="meal-plan-form-description"
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Start Date"
              type="date"
              value={formValues.startDate}
              onChange={(event) => handleChange('startDate', event.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              data-testid="meal-plan-form-start-date"
            />
            <TextField
              label="End Date"
              type="date"
              value={formValues.endDate}
              onChange={(event) => handleChange('endDate', event.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              data-testid="meal-plan-form-end-date"
            />
          </Box>

          <TextField
            label="Default Servings"
            type="number"
            value={formValues.defaultServings}
            onChange={(event) => handleChange('defaultServings', Number(event.target.value))}
            inputProps={{ min: 1, step: 1 }}
            fullWidth
            data-testid="meal-plan-form-default-servings"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Enabled Meal Types
            </Typography>
            <FormGroup>
              {Object.values(MEAL_TYPES).map((mealType) => (
                <FormControlLabel
                  key={mealType}
                  control={(
                    <Checkbox
                      checked={formValues.enabledMealTypes.includes(mealType)}
                      onChange={() => handleMealTypeToggle(mealType)}
                      data-testid={`meal-plan-form-meal-type-${mealType}`}
                    />
                  )}
                  label={getMealTypeDisplayName(mealType)}
                />
              ))}
            </FormGroup>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} data-testid="meal-plan-form-cancel">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          data-testid="meal-plan-form-save"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Meal Plan' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MealPlanDialog;
