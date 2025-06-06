import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Recipe } from '@app-types';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  BaseDirectory,
  exists
} from '@tauri-apps/plugin-fs';
import { deleteRecipeImage } from '@services/imageService';
import { getCurrentTimestamp } from '@utils/timeUtils';

interface RecipesState {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
  currentRecipe: Recipe | null;
}

// Use simpler paths without app name (Tauri handles that)
const RECIPES_DIR = 'recipes';
const RECIPES_INDEX = 'recipes/index.json';

// Ensure the recipes directory exists
async function ensureDirectory() {
  try {
    const dirExists = await exists(RECIPES_DIR, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!dirExists) {
      await mkdir(RECIPES_DIR, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true
      });
      console.log('Directory created successfully');
    } else {
      console.log('Directory already exists');
    }
  } catch (error) {
    console.error('Error checking/creating directory:', error);
  }
}

// Async thunks
export const loadAllRecipes = createAsyncThunk(
  'recipes/loadAllRecipes',
  async () => {
    await ensureDirectory();

    try {
      const indexExists = await exists(RECIPES_INDEX, {
        baseDir: BaseDirectory.AppLocalData
      });

      if (!indexExists) {
        console.log('Recipe index not found, returning empty array');
        return [];
      }

      const indexContent = await readTextFile(RECIPES_INDEX, {
        baseDir: BaseDirectory.AppLocalData
      });
      const indexData = JSON.parse(indexContent);

      // Filter out recipes that don't have a corresponding file
      const validRecipes = [];
      const updatedIndex = [];

      for (const item of indexData) {
        try {
          const filePath = `${RECIPES_DIR}/${item.id}.json`;
          const fileExists = await exists(filePath, {
            baseDir: BaseDirectory.AppLocalData
          });

          if (fileExists) {
            const content = await readTextFile(filePath, {
              baseDir: BaseDirectory.AppLocalData
            });
            const recipe = JSON.parse(content);
            validRecipes.push(recipe);
            updatedIndex.push(item);
          } else {
            console.warn(`Recipe file missing for ${item.id} - removing from index`);
          }
        } catch (error) {
          console.warn(`Error reading recipe file for ${item.id}:`, error);
        }
      }

      // Update the index if any recipes were missing
      if (updatedIndex.length !== indexData.length) {
        console.log(`Updating recipe index: ${indexData.length} -> ${updatedIndex.length}`);
        await writeTextFile(RECIPES_INDEX, JSON.stringify(updatedIndex, null, 2), {
          baseDir: BaseDirectory.AppLocalData
        });
      }

      return validRecipes;
    } catch (error) {
      console.debug('Recipe index not found or error reading it:', error);
      return [];
    }
  }
);

export const loadRecipeById = createAsyncThunk(
  'recipes/loadRecipeById',
  async (id: string) => {
    await ensureDirectory();

    try {
      const filePath = `${RECIPES_DIR}/${id}.json`;
      const fileExists = await exists(filePath, {
        baseDir: BaseDirectory.AppLocalData
      });

      if (!fileExists) {
        return null;
      }

      const content = await readTextFile(filePath, {
        baseDir: BaseDirectory.AppLocalData
      });
      return JSON.parse(content) as Recipe;
    } catch (error) {
      console.warn(`Recipe not found: ${id}`, error);
      return null;
    }
  }
);

export const saveRecipe = createAsyncThunk(
  'recipes/saveRecipe',
  async (recipe: Recipe, { getState, dispatch }) => {
    await ensureDirectory();

    try {
      // Save the recipe file
      const filename = `${RECIPES_DIR}/${recipe.id}.json`;
      console.log(`Saving recipe to: ${filename} in AppLocalData`);

      await writeTextFile(filename, JSON.stringify(recipe, null, 2), {
        baseDir: BaseDirectory.AppLocalData
      });

      // Update the index
      const state = getState() as { recipes: RecipesState };
      let recipes = [...state.recipes.recipes];

      // Find existing recipe or add new one
      const existingIndex = recipes.findIndex(r => r.id === recipe.id);

      if (existingIndex >= 0) {
        recipes[existingIndex] = recipe;
      } else {
        recipes.push(recipe);
      }

      // Save updated index
      const indexData = recipes.map(r => ({
        id: r.id,
        title: r.title,
        image: r.image,
        tags: r.tags,
        dateAdded: r.dateAdded,
        dateModified: r.dateModified,
      }));

      await writeTextFile(RECIPES_INDEX, JSON.stringify(indexData, null, 2), {
        baseDir: BaseDirectory.AppLocalData
      });

      console.log('Recipe saved successfully');
      return recipe;
    } catch (error) {
      console.error('Failed to save recipe:', error);
      throw new Error(`Failed to save recipe: ${error}`);
    }
  }
);

export const updateRecipe = createAsyncThunk(
  'recipes/updateRecipe',
  async (recipe: Recipe, { dispatch }) => {
    // Update the dateModified field
    const updatedRecipe = {
      ...recipe,
      dateModified: getCurrentTimestamp(),
    };

    // Use the existing saveRecipe function which handles both create and update
    await dispatch(saveRecipe(updatedRecipe));
    return updatedRecipe;
  }
);

export const deleteRecipe = createAsyncThunk(
  'recipes/deleteRecipe',
  async (id: string, { getState, dispatch }) => {
    await ensureDirectory();

    try {
      const state = getState() as { recipes: RecipesState };
      const recipe = state.recipes.recipes.find(r => r.id === id);

      // Delete the associated image if it exists and is local
      if (recipe && recipe.image) {
        await deleteRecipeImage(recipe.image);
      }

      const filePath = `${RECIPES_DIR}/${id}.json`;
      const fileExists = await exists(filePath, {
        baseDir: BaseDirectory.AppLocalData
      });

      if (fileExists) {
        await remove(filePath, {
          baseDir: BaseDirectory.AppLocalData
        });
      }

      const recipes = state.recipes.recipes.filter(r => r.id !== id);

      await writeTextFile(RECIPES_INDEX, JSON.stringify(recipes.map(r => ({
        id: r.id,
        title: r.title,
        image: r.image,
        tags: r.tags,
        dateAdded: r.dateAdded,
        dateModified: r.dateModified,
      })), null, 2), {
        baseDir: BaseDirectory.AppLocalData
      });

      return id;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      throw new Error('Failed to delete recipe');
    }
  }
);

const initialState: RecipesState = {
  recipes: [],
  loading: false,
  error: null,
  currentRecipe: null,
};

const recipesSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {
    setCurrentRecipe: (state, action: PayloadAction<Recipe | null>) => {
      state.currentRecipe = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load all recipes
      .addCase(loadAllRecipes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadAllRecipes.fulfilled, (state, action) => {
        state.loading = false;
        state.recipes = action.payload;
      })
      .addCase(loadAllRecipes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recipes';
      })
      // Load recipe by ID
      .addCase(loadRecipeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRecipeById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRecipe = action.payload;
      })
      .addCase(loadRecipeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load recipe';
      })
      // Save recipe
      .addCase(saveRecipe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveRecipe.fulfilled, (state, action) => {
        state.loading = false;
        const existingIndex = state.recipes.findIndex(r => r.id === action.payload.id);
        if (existingIndex >= 0) {
          state.recipes[existingIndex] = action.payload;
        } else {
          state.recipes.push(action.payload);
        }
      })
      .addCase(saveRecipe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save recipe';
      })
      // Update recipe
      .addCase(updateRecipe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRecipe.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.recipes.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.recipes[index] = action.payload;
        }
        if (state.currentRecipe && state.currentRecipe.id === action.payload.id) {
          state.currentRecipe = action.payload;
        }
      })
      .addCase(updateRecipe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update recipe';
      })
      // Delete recipe
      .addCase(deleteRecipe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRecipe.fulfilled, (state, action) => {
        state.loading = false;
        state.recipes = state.recipes.filter(r => r.id !== action.payload);
        if (state.currentRecipe && state.currentRecipe.id === action.payload) {
          state.currentRecipe = null;
        }
      })
      .addCase(deleteRecipe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete recipe';
      });
  },
});

export const { setCurrentRecipe, clearError } = recipesSlice.actions;

// Selectors with proper typing
export const selectRecipes = (state: { recipes: RecipesState }): Recipe[] => 
  state.recipes?.recipes || [];

export const selectRecipesLoading = (state: { recipes: RecipesState }): boolean => 
  state.recipes?.loading || false;

export const selectRecipesError = (state: { recipes: RecipesState }): string | null => 
  state.recipes?.error || null;

export const selectCurrentRecipe = (state: { recipes: RecipesState }): Recipe | null => 
  state.recipes?.currentRecipe || null;

export const selectRecipeById = (state: { recipes: RecipesState }, id: string): Recipe | null => 
  state.recipes?.recipes?.find(recipe => recipe.id === id) || null;

export default recipesSlice.reducer;
