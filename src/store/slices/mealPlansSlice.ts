import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { MealPlan, MealPlanRecipe } from '@app-types';
import {
  getAllMealPlans,
  getMealPlanById,
  saveMealPlan,
  deleteMealPlan,
  getMealPlanRecipes,
  saveMealPlanRecipe,
  deleteMealPlanRecipe,
} from '@services/mealPlanStorage';

interface MealPlansState {
  mealPlans: MealPlan[];
  currentMealPlan: MealPlan | null;
  currentMealPlanRecipes: MealPlanRecipe[];
  loading: boolean;
  error: string | null;
}

const initialState: MealPlansState = {
  mealPlans: [],
  currentMealPlan: null,
  currentMealPlanRecipes: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchMealPlans = createAsyncThunk(
  'mealPlans/fetchMealPlans',
  async () => {
    return await getAllMealPlans();
  }
);

export const fetchMealPlanById = createAsyncThunk(
  'mealPlans/fetchMealPlanById',
  async (id: string) => {
    const mealPlan = await getMealPlanById(id);
    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }
    return mealPlan;
  }
);

export const fetchMealPlanRecipes = createAsyncThunk(
  'mealPlans/fetchMealPlanRecipes',
  async (mealPlanId: string) => {
    return await getMealPlanRecipes(mealPlanId);
  }
);

export const createMealPlan = createAsyncThunk(
  'mealPlans/createMealPlan',
  async (mealPlan: MealPlan) => {
    await saveMealPlan(mealPlan);
    return mealPlan;
  }
);

export const updateMealPlan = createAsyncThunk(
  'mealPlans/updateMealPlan',
  async (mealPlan: MealPlan) => {
    await saveMealPlan(mealPlan);
    return mealPlan;
  }
);

export const removeMealPlan = createAsyncThunk(
  'mealPlans/removeMealPlan',
  async (id: string) => {
    const success = await deleteMealPlan(id);
    if (!success) {
      throw new Error('Failed to delete meal plan');
    }
    return id;
  }
);

export const addMealPlanRecipe = createAsyncThunk(
  'mealPlans/addMealPlanRecipe',
  async (mealPlanRecipe: MealPlanRecipe) => {
    await saveMealPlanRecipe(mealPlanRecipe);
    return mealPlanRecipe;
  }
);

export const removeMealPlanRecipe = createAsyncThunk(
  'mealPlans/removeMealPlanRecipe',
  async (id: string) => {
    const success = await deleteMealPlanRecipe(id);
    if (!success) {
      throw new Error('Failed to delete meal plan recipe');
    }
    return id;
  }
);

const mealPlansSlice = createSlice({
  name: 'mealPlans',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentMealPlan: (state) => {
      state.currentMealPlan = null;
      state.currentMealPlanRecipes = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch meal plans
      .addCase(fetchMealPlans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMealPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.mealPlans = action.payload;
      })
      .addCase(fetchMealPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch meal plans';
      })

      // Fetch meal plan by ID
      .addCase(fetchMealPlanById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMealPlanById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMealPlan = action.payload;
      })
      .addCase(fetchMealPlanById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch meal plan';
      })

      // Fetch meal plan recipes
      .addCase(fetchMealPlanRecipes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMealPlanRecipes.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMealPlanRecipes = action.payload;
      })
      .addCase(fetchMealPlanRecipes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch meal plan recipes';
      })

      // Create meal plan
      .addCase(createMealPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createMealPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.mealPlans.unshift(action.payload);
      })
      .addCase(createMealPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create meal plan';
      })

      // Update meal plan
      .addCase(updateMealPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMealPlan.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.mealPlans.findIndex(mp => mp.id === action.payload.id);
        if (index !== -1) {
          state.mealPlans[index] = action.payload;
        }
        if (state.currentMealPlan?.id === action.payload.id) {
          state.currentMealPlan = action.payload;
        }
      })
      .addCase(updateMealPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update meal plan';
      })

      // Remove meal plan
      .addCase(removeMealPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeMealPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.mealPlans = state.mealPlans.filter(mp => mp.id !== action.payload);
        if (state.currentMealPlan?.id === action.payload) {
          state.currentMealPlan = null;
          state.currentMealPlanRecipes = [];
        }
      })
      .addCase(removeMealPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove meal plan';
      })

      // Add meal plan recipe
      .addCase(addMealPlanRecipe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addMealPlanRecipe.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMealPlanRecipes.push(action.payload);
      })
      .addCase(addMealPlanRecipe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add recipe to meal plan';
      })

      // Remove meal plan recipe
      .addCase(removeMealPlanRecipe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeMealPlanRecipe.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMealPlanRecipes = state.currentMealPlanRecipes.filter(
          mpr => mpr.id !== action.payload
        );
      })
      .addCase(removeMealPlanRecipe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove recipe from meal plan';
      });
  },
});

export const { clearError, clearCurrentMealPlan } = mealPlansSlice.actions;

export default mealPlansSlice.reducer;

// Selectors
export const selectMealPlans = (state: { mealPlans: MealPlansState }) => state.mealPlans.mealPlans;
export const selectCurrentMealPlan = (state: { mealPlans: MealPlansState }) => state.mealPlans.currentMealPlan;
export const selectCurrentMealPlanRecipes = (state: { mealPlans: MealPlansState }) => state.mealPlans.currentMealPlanRecipes;
export const selectMealPlansLoading = (state: { mealPlans: MealPlansState }) => state.mealPlans.loading;
export const selectMealPlansError = (state: { mealPlans: MealPlansState }) => state.mealPlans.error;
