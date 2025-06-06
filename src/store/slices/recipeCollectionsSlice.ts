import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RecipeCollection } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

interface RecipeCollectionsState {
  collections: RecipeCollection[];
  loading: boolean;
  error: string | null;
  currentCollection: RecipeCollection | null;
}

const COLLECTIONS_KEY = 'justcooked_recipe_collections';

// Async thunks
export const loadRecipeCollections = createAsyncThunk(
  'recipeCollections/loadRecipeCollections',
  async () => {
    try {
      const stored = localStorage.getItem(COLLECTIONS_KEY);
      return stored ? JSON.parse(stored) as RecipeCollection[] : [];
    } catch (error) {
      console.error('Failed to load recipe collections:', error);
      return [];
    }
  }
);

export const saveRecipeCollections = createAsyncThunk(
  'recipeCollections/saveRecipeCollections',
  async (collections: RecipeCollection[]) => {
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return collections;
    } catch (error) {
      console.error('Failed to save recipe collections:', error);
      throw error;
    }
  }
);

export const createRecipeCollection = createAsyncThunk(
  'recipeCollections/createRecipeCollection',
  async (collection: Omit<RecipeCollection, 'id' | 'dateCreated' | 'dateModified'>, { getState, dispatch }) => {
    const newCollection: RecipeCollection = {
      ...collection,
      id: crypto.randomUUID(),
      dateCreated: getCurrentTimestamp(),
      dateModified: getCurrentTimestamp(),
    };
    
    const state = getState() as { recipeCollections: RecipeCollectionsState };
    const updatedCollections = [...state.recipeCollections.collections, newCollection];
    
    await dispatch(saveRecipeCollections(updatedCollections));
    return newCollection;
  }
);

export const updateRecipeCollection = createAsyncThunk(
  'recipeCollections/updateRecipeCollection',
  async ({ id, updates }: { id: string; updates: Partial<RecipeCollection> }, { getState, dispatch }) => {
    const state = getState() as { recipeCollections: RecipeCollectionsState };
    const collections = state.recipeCollections.collections;
    const index = collections.findIndex(collection => collection.id === id);
    
    if (index === -1) {
      throw new Error('Recipe collection not found');
    }
    
    const updatedCollection = {
      ...collections[index],
      ...updates,
      dateModified: getCurrentTimestamp(),
    };
    
    const updatedCollections = [...collections];
    updatedCollections[index] = updatedCollection;
    
    await dispatch(saveRecipeCollections(updatedCollections));
    return updatedCollection;
  }
);

export const deleteRecipeCollection = createAsyncThunk(
  'recipeCollections/deleteRecipeCollection',
  async (id: string, { getState, dispatch }) => {
    const state = getState() as { recipeCollections: RecipeCollectionsState };
    const collections = state.recipeCollections.collections;
    const updatedCollections = collections.filter(collection => collection.id !== id);
    
    await dispatch(saveRecipeCollections(updatedCollections));
    return id;
  }
);

export const addRecipeToCollection = createAsyncThunk(
  'recipeCollections/addRecipeToCollection',
  async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }, { getState, dispatch }) => {
    const state = getState() as { recipeCollections: RecipeCollectionsState };
    const collections = state.recipeCollections.collections;
    const collection = collections.find(c => c.id === collectionId);
    
    if (!collection) {
      throw new Error('Recipe collection not found');
    }
    
    if (collection.recipeIds.includes(recipeId)) {
      return collection; // Recipe already in collection
    }
    
    const updates = {
      recipeIds: [...collection.recipeIds, recipeId],
      dateModified: getCurrentTimestamp(),
    };
    
    await dispatch(updateRecipeCollection({ id: collectionId, updates }));
    return { ...collection, ...updates };
  }
);

export const removeRecipeFromCollection = createAsyncThunk(
  'recipeCollections/removeRecipeFromCollection',
  async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }, { getState, dispatch }) => {
    const state = getState() as { recipeCollections: RecipeCollectionsState };
    const collections = state.recipeCollections.collections;
    const collection = collections.find(c => c.id === collectionId);
    
    if (!collection) {
      throw new Error('Recipe collection not found');
    }
    
    const updates = {
      recipeIds: collection.recipeIds.filter(id => id !== recipeId),
      dateModified: getCurrentTimestamp(),
    };
    
    await dispatch(updateRecipeCollection({ id: collectionId, updates }));
    return { ...collection, ...updates };
  }
);

const initialState: RecipeCollectionsState = {
  collections: [],
  loading: false,
  error: null,
  currentCollection: null,
};

const recipeCollectionsSlice = createSlice({
  name: 'recipeCollections',
  initialState,
  reducers: {
    setCurrentCollection: (state, action: PayloadAction<RecipeCollection | null>) => {
      state.currentCollection = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load recipe collections
      .addCase(loadRecipeCollections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRecipeCollections.fulfilled, (state, action) => {
        state.loading = false;
        state.collections = action.payload;
      })
      .addCase(loadRecipeCollections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recipe collections';
      })
      // Create recipe collection
      .addCase(createRecipeCollection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRecipeCollection.fulfilled, (state, action) => {
        state.loading = false;
        state.collections.push(action.payload);
      })
      .addCase(createRecipeCollection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create recipe collection';
      })
      // Update recipe collection
      .addCase(updateRecipeCollection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRecipeCollection.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.collections.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.collections[index] = action.payload;
        }
        if (state.currentCollection && state.currentCollection.id === action.payload.id) {
          state.currentCollection = action.payload;
        }
      })
      .addCase(updateRecipeCollection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update recipe collection';
      })
      // Delete recipe collection
      .addCase(deleteRecipeCollection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRecipeCollection.fulfilled, (state, action) => {
        state.loading = false;
        state.collections = state.collections.filter(c => c.id !== action.payload);
        if (state.currentCollection && state.currentCollection.id === action.payload) {
          state.currentCollection = null;
        }
      })
      .addCase(deleteRecipeCollection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete recipe collection';
      })
      // Add recipe to collection
      .addCase(addRecipeToCollection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addRecipeToCollection.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.collections.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.collections[index] = action.payload;
        }
        if (state.currentCollection && state.currentCollection.id === action.payload.id) {
          state.currentCollection = action.payload;
        }
      })
      .addCase(addRecipeToCollection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add recipe to collection';
      })
      // Remove recipe from collection
      .addCase(removeRecipeFromCollection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeRecipeFromCollection.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.collections.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.collections[index] = action.payload;
        }
        if (state.currentCollection && state.currentCollection.id === action.payload.id) {
          state.currentCollection = action.payload;
        }
      })
      .addCase(removeRecipeFromCollection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove recipe from collection';
      })
      // Save recipe collections
      .addCase(saveRecipeCollections.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to save recipe collections';
      });
  },
});

export const { setCurrentCollection, clearError } = recipeCollectionsSlice.actions;

// Selectors with proper typing
export const selectRecipeCollections = (state: { recipeCollections: RecipeCollectionsState }): RecipeCollection[] => 
  state.recipeCollections.collections;

export const selectRecipeCollectionsLoading = (state: { recipeCollections: RecipeCollectionsState }): boolean => 
  state.recipeCollections.loading;

export const selectRecipeCollectionsError = (state: { recipeCollections: RecipeCollectionsState }): string | null => 
  state.recipeCollections.error;

export const selectCurrentCollection = (state: { recipeCollections: RecipeCollectionsState }): RecipeCollection | null => 
  state.recipeCollections.currentCollection;

export const selectRecipeCollectionById = (state: { recipeCollections: RecipeCollectionsState }, id: string): RecipeCollection | null => 
  state.recipeCollections.collections.find(collection => collection.id === id) || null;

export const selectCollectionsContainingRecipe = (state: { recipeCollections: RecipeCollectionsState }, recipeId: string): RecipeCollection[] => 
  state.recipeCollections.collections.filter(collection => collection.recipeIds.includes(recipeId));

export default recipeCollectionsSlice.reducer;
