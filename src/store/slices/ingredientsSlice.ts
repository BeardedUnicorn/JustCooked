import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { IngredientDatabase, IngredientSearchResult } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';
import { cleanIngredientName, detectIngredientCategory } from '@utils/ingredientUtils';

export interface IngredientsState {
  ingredients: IngredientDatabase[];
  loading: boolean;
  error: string | null;
  searchResults: IngredientSearchResult[];
}

const STORAGE_KEY = 'justcooked_ingredients';

// Get default ingredients (common ingredients to start with)
function getDefaultIngredients(): IngredientDatabase[] {
  const defaultIngredients = [
    { name: 'Salt', category: 'herbs', aliases: ['table salt', 'sea salt', 'kosher salt'] },
    { name: 'Black Pepper', category: 'herbs', aliases: ['pepper', 'ground black pepper'] },
    { name: 'Olive Oil', category: 'oils', aliases: ['extra virgin olive oil', 'EVOO'] },
    { name: 'Garlic', category: 'vegetables', aliases: ['garlic cloves', 'fresh garlic'] },
    { name: 'Onion', category: 'vegetables', aliases: ['yellow onion', 'white onion', 'sweet onion'] },
    { name: 'Butter', category: 'dairy', aliases: ['unsalted butter', 'salted butter'] },
    { name: 'All-Purpose Flour', category: 'baking', aliases: ['flour', 'AP flour', 'plain flour'] },
    { name: 'Sugar', category: 'baking', aliases: ['white sugar', 'granulated sugar', 'caster sugar'] },
    { name: 'Eggs', category: 'dairy', aliases: ['egg', 'large eggs', 'chicken eggs'] },
    { name: 'Milk', category: 'dairy', aliases: ['whole milk', '2% milk', 'skim milk'] },
  ];
  
  return defaultIngredients.map(ingredient => ({
    ...ingredient,
    id: crypto.randomUUID(),
    dateAdded: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  }));
}

// Async thunks
export const loadIngredients = createAsyncThunk(
  'ingredients/loadIngredients',
  async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as IngredientDatabase[];
      }
    } catch (error) {
      console.error('Failed to load ingredients:', error);
    }
    return getDefaultIngredients();
  }
);

export const saveIngredientsToStorage = createAsyncThunk(
  'ingredients/saveIngredientsToStorage',
  async (ingredients: IngredientDatabase[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
      return ingredients;
    } catch (error) {
      console.error('Failed to save ingredients:', error);
      throw error;
    }
  }
);

export const addIngredient = createAsyncThunk(
  'ingredients/addIngredient',
  async (ingredient: Omit<IngredientDatabase, 'id' | 'dateAdded' | 'dateModified'>, { getState, dispatch }) => {
    const newIngredient: IngredientDatabase = {
      ...ingredient,
      id: crypto.randomUUID(),
      dateAdded: getCurrentTimestamp(),
      dateModified: getCurrentTimestamp(),
    };
    
    const state = getState() as { ingredients: IngredientsState };
    const updatedIngredients = [...state.ingredients.ingredients, newIngredient];
    
    await dispatch(saveIngredientsToStorage(updatedIngredients));
    return newIngredient;
  }
);

export const updateIngredient = createAsyncThunk(
  'ingredients/updateIngredient',
  async ({ id, updates }: { id: string; updates: Partial<IngredientDatabase> }, { getState, dispatch }) => {
    const state = getState() as { ingredients: IngredientsState };
    const ingredients = state.ingredients.ingredients;
    const index = ingredients.findIndex(ing => ing.id === id);
    
    if (index === -1) {
      throw new Error('Ingredient not found');
    }
    
    const updatedIngredient = {
      ...ingredients[index],
      ...updates,
      dateModified: getCurrentTimestamp(),
    };
    
    const updatedIngredients = [...ingredients];
    updatedIngredients[index] = updatedIngredient;
    
    await dispatch(saveIngredientsToStorage(updatedIngredients));
    return updatedIngredient;
  }
);

export const deleteIngredient = createAsyncThunk(
  'ingredients/deleteIngredient',
  async (id: string, { getState, dispatch }) => {
    const state = getState() as { ingredients: IngredientsState };
    const ingredients = state.ingredients.ingredients;
    const updatedIngredients = ingredients.filter(ing => ing.id !== id);
    
    await dispatch(saveIngredientsToStorage(updatedIngredients));
    return id;
  }
);

export const autoDetectIngredients = createAsyncThunk(
  'ingredients/autoDetectIngredients',
  async (ingredientNames: string[], { getState, dispatch }) => {
    const state = getState() as { ingredients: IngredientsState };
    const existingIngredients = state.ingredients.ingredients;
    const newIngredients: IngredientDatabase[] = [];

    for (const name of ingredientNames) {
      const cleanName = cleanIngredientName(name);
      const existing = existingIngredients.find(ingredient => 
        ingredient.name.toLowerCase() === cleanName.toLowerCase() ||
        ingredient.aliases.some(alias => alias.toLowerCase() === cleanName.toLowerCase())
      );

      if (!existing) {
        const category = detectIngredientCategory(cleanName);
        const newIngredient: IngredientDatabase = {
          id: crypto.randomUUID(),
          name: cleanName,
          category: category.id,
          aliases: [],
          dateAdded: getCurrentTimestamp(),
          dateModified: getCurrentTimestamp(),
        };
        newIngredients.push(newIngredient);
      }
    }

    if (newIngredients.length > 0) {
      const updatedIngredients = [...existingIngredients, ...newIngredients];
      await dispatch(saveIngredientsToStorage(updatedIngredients));
    }

    return newIngredients;
  }
);

const initialState: IngredientsState = {
  ingredients: [],
  loading: false,
  error: null,
  searchResults: [],
};

const ingredientsSlice = createSlice({
  name: 'ingredients',
  initialState,
  reducers: {
    searchIngredients: (state, action: PayloadAction<string>) => {
      const query = action.payload;
      const normalizedQuery = query.toLowerCase().trim();
      
      if (!normalizedQuery) {
        state.searchResults = state.ingredients.map(ingredient => ({
          ingredient,
          score: 1,
          matchType: 'exact' as const,
        }));
        return;
      }
      
      const results: IngredientSearchResult[] = [];
      
      for (const ingredient of state.ingredients) {
        const normalizedName = ingredient.name.toLowerCase();
        
        // Exact match
        if (normalizedName === normalizedQuery) {
          results.push({
            ingredient,
            score: 1,
            matchType: 'exact',
          });
          continue;
        }
        
        // Alias match
        const aliasMatch = ingredient.aliases.some(alias => 
          alias.toLowerCase() === normalizedQuery
        );
        if (aliasMatch) {
          results.push({
            ingredient,
            score: 0.9,
            matchType: 'alias',
          });
          continue;
        }
        
        // Fuzzy match (contains)
        if (normalizedName.includes(normalizedQuery)) {
          const score = normalizedQuery.length / normalizedName.length;
          results.push({
            ingredient,
            score,
            matchType: 'fuzzy',
          });
          continue;
        }
        
        // Fuzzy match in aliases
        for (const alias of ingredient.aliases) {
          if (alias.toLowerCase().includes(normalizedQuery)) {
            const score = (normalizedQuery.length / alias.length) * 0.8;
            results.push({
              ingredient,
              score,
              matchType: 'fuzzy',
            });
            break;
          }
        }
      }
      
      // Sort by score (highest first)
      state.searchResults = results.sort((a, b) => b.score - a.score);
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load ingredients
      .addCase(loadIngredients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadIngredients.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients = action.payload;
      })
      .addCase(loadIngredients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load ingredients';
      })
      // Add ingredient
      .addCase(addIngredient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addIngredient.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients.push(action.payload);
      })
      .addCase(addIngredient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add ingredient';
      })
      // Update ingredient
      .addCase(updateIngredient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateIngredient.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.ingredients.findIndex(ing => ing.id === action.payload.id);
        if (index !== -1) {
          state.ingredients[index] = action.payload;
        }
      })
      .addCase(updateIngredient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update ingredient';
      })
      // Delete ingredient
      .addCase(deleteIngredient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteIngredient.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients = state.ingredients.filter(ing => ing.id !== action.payload);
      })
      .addCase(deleteIngredient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete ingredient';
      })
      // Auto-detect ingredients
      .addCase(autoDetectIngredients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(autoDetectIngredients.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients.push(...action.payload);
      })
      .addCase(autoDetectIngredients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to auto-detect ingredients';
      })
      // Save ingredients to storage
      .addCase(saveIngredientsToStorage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to save ingredients';
      });
  },
});

export const { searchIngredients, clearSearchResults, clearError } = ingredientsSlice.actions;

// Selectors with proper typing
export const selectIngredients = (state: { ingredients: IngredientsState }): IngredientDatabase[] => 
  state.ingredients.ingredients;

export const selectIngredientsLoading = (state: { ingredients: IngredientsState }): boolean => 
  state.ingredients.loading;

export const selectIngredientsError = (state: { ingredients: IngredientsState }): string | null => 
  state.ingredients.error;

export const selectIngredientSearchResults = (state: { ingredients: IngredientsState }): IngredientSearchResult[] => 
  state.ingredients.searchResults;

export const selectIngredientByName = (state: { ingredients: IngredientsState }, name: string): IngredientDatabase | null => {
  const normalizedName = name.toLowerCase().trim();
  return state.ingredients.ingredients.find(ingredient => 
    ingredient.name.toLowerCase() === normalizedName ||
    ingredient.aliases.some(alias => alias.toLowerCase() === normalizedName)
  ) || null;
};

export default ingredientsSlice.reducer;
