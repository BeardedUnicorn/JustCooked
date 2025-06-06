import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PantryItem } from '@app-types';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  BaseDirectory,
  exists
} from '@tauri-apps/plugin-fs';

interface PantryState {
  items: PantryItem[];
  loading: boolean;
  error: string | null;
}

const PANTRY_DIR = 'pantry';
const PANTRY_FILE = 'pantry/items.json';

// Ensure the pantry directory exists
async function ensureDirectory() {
  try {
    const dirExists = await exists(PANTRY_DIR, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!dirExists) {
      await mkdir(PANTRY_DIR, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true
      });
      console.log('Pantry directory created successfully');
    }
  } catch (error) {
    console.debug('Pantry directory check/create result:', error);
  }
}

// Async thunks
export const loadPantryItems = createAsyncThunk(
  'pantry/loadPantryItems',
  async () => {
    await ensureDirectory();

    try {
      const fileExists = await exists(PANTRY_FILE, {
        baseDir: BaseDirectory.AppLocalData
      });

      if (!fileExists) {
        return [];
      }

      const content = await readTextFile(PANTRY_FILE, {
        baseDir: BaseDirectory.AppLocalData
      });
      return JSON.parse(content) as PantryItem[];
    } catch (error) {
      console.debug('Error getting pantry items:', error);
      return [];
    }
  }
);

export const savePantryItems = createAsyncThunk(
  'pantry/savePantryItems',
  async (items: PantryItem[]) => {
    await ensureDirectory();
    await writeTextFile(PANTRY_FILE, JSON.stringify(items, null, 2), {
      baseDir: BaseDirectory.AppLocalData
    });
    return items;
  }
);

export const addPantryItem = createAsyncThunk(
  'pantry/addPantryItem',
  async (item: PantryItem, { getState, dispatch }) => {
    const state = getState() as { pantry: PantryState };
    const updatedItems = [...state.pantry.items, item];
    await dispatch(savePantryItems(updatedItems));
    return item;
  }
);

export const updatePantryItem = createAsyncThunk(
  'pantry/updatePantryItem',
  async (updatedItem: PantryItem, { getState, dispatch }) => {
    const state = getState() as { pantry: PantryState };
    const items = state.pantry.items;
    const index = items.findIndex(item => item.id === updatedItem.id);

    if (index === -1) {
      throw new Error('Pantry item not found');
    }

    const updatedItems = [...items];
    updatedItems[index] = updatedItem;
    
    await dispatch(savePantryItems(updatedItems));
    return updatedItem;
  }
);

export const deletePantryItem = createAsyncThunk(
  'pantry/deletePantryItem',
  async (id: string, { getState, dispatch }) => {
    const state = getState() as { pantry: PantryState };
    const items = state.pantry.items;
    const filteredItems = items.filter(item => item.id !== id);
    
    await dispatch(savePantryItems(filteredItems));
    return id;
  }
);

const initialState: PantryState = {
  items: [],
  loading: false,
  error: null,
};

const pantrySlice = createSlice({
  name: 'pantry',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load pantry items
      .addCase(loadPantryItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPantryItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(loadPantryItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load pantry items';
      })
      // Add pantry item
      .addCase(addPantryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPantryItem.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(addPantryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add pantry item';
      })
      // Update pantry item
      .addCase(updatePantryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePantryItem.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updatePantryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update pantry item';
      })
      // Delete pantry item
      .addCase(deletePantryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePantryItem.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(item => item.id !== action.payload);
      })
      .addCase(deletePantryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete pantry item';
      })
      // Save pantry items
      .addCase(savePantryItems.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to save pantry items';
      });
  },
});

export const { clearError } = pantrySlice.actions;

// Selectors with proper typing
export const selectPantryItems = (state: { pantry: PantryState }): PantryItem[] => 
  state.pantry.items;

export const selectPantryLoading = (state: { pantry: PantryState }): boolean => 
  state.pantry.loading;

export const selectPantryError = (state: { pantry: PantryState }): string | null => 
  state.pantry.error;

export const selectPantryItemById = (state: { pantry: PantryState }, id: string): PantryItem | null => 
  state.pantry.items.find(item => item.id === id) || null;

export default pantrySlice.reducer;
