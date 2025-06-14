import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ShoppingList, ShoppingListItem } from '@app-types';
import {
  getShoppingListsByMealPlan,
  getShoppingListById,
  saveShoppingList,
  deleteShoppingList,
  getShoppingListItems,
  saveShoppingListItem,
  updateShoppingListItemChecked,
  deleteShoppingListItem,
} from '@services/shoppingListStorage';

interface ShoppingListsState {
  shoppingLists: ShoppingList[];
  currentShoppingList: ShoppingList | null;
  currentShoppingListItems: ShoppingListItem[];
  loading: boolean;
  error: string | null;
}

const initialState: ShoppingListsState = {
  shoppingLists: [],
  currentShoppingList: null,
  currentShoppingListItems: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchShoppingListsByMealPlan = createAsyncThunk(
  'shoppingLists/fetchShoppingListsByMealPlan',
  async (mealPlanId: string) => {
    return await getShoppingListsByMealPlan(mealPlanId);
  }
);

export const fetchShoppingListById = createAsyncThunk(
  'shoppingLists/fetchShoppingListById',
  async (id: string) => {
    const shoppingList = await getShoppingListById(id);
    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }
    return shoppingList;
  }
);

export const fetchShoppingListItems = createAsyncThunk(
  'shoppingLists/fetchShoppingListItems',
  async (shoppingListId: string) => {
    return await getShoppingListItems(shoppingListId);
  }
);

export const createShoppingList = createAsyncThunk(
  'shoppingLists/createShoppingList',
  async (shoppingList: ShoppingList) => {
    await saveShoppingList(shoppingList);
    return shoppingList;
  }
);

export const updateShoppingList = createAsyncThunk(
  'shoppingLists/updateShoppingList',
  async (shoppingList: ShoppingList) => {
    await saveShoppingList(shoppingList);
    return shoppingList;
  }
);

export const removeShoppingList = createAsyncThunk(
  'shoppingLists/removeShoppingList',
  async (id: string) => {
    const success = await deleteShoppingList(id);
    if (!success) {
      throw new Error('Failed to delete shopping list');
    }
    return id;
  }
);

export const addShoppingListItem = createAsyncThunk(
  'shoppingLists/addShoppingListItem',
  async (item: ShoppingListItem) => {
    await saveShoppingListItem(item);
    return item;
  }
);

export const updateShoppingListItemStatus = createAsyncThunk(
  'shoppingLists/updateShoppingListItemStatus',
  async ({ id, isChecked }: { id: string; isChecked: boolean }) => {
    await updateShoppingListItemChecked(id, isChecked);
    return { id, isChecked };
  }
);

export const removeShoppingListItem = createAsyncThunk(
  'shoppingLists/removeShoppingListItem',
  async (id: string) => {
    const success = await deleteShoppingListItem(id);
    if (!success) {
      throw new Error('Failed to delete shopping list item');
    }
    return id;
  }
);

const shoppingListsSlice = createSlice({
  name: 'shoppingLists',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentShoppingList: (state) => {
      state.currentShoppingList = null;
      state.currentShoppingListItems = [];
    },
    // Optimistic updates for better UX
    toggleItemCheckedOptimistic: (state, action: PayloadAction<{ id: string; isChecked: boolean }>) => {
      const item = state.currentShoppingListItems.find(item => item.id === action.payload.id);
      if (item) {
        item.isChecked = action.payload.isChecked;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch shopping lists by meal plan
      .addCase(fetchShoppingListsByMealPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShoppingListsByMealPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.shoppingLists = action.payload;
      })
      .addCase(fetchShoppingListsByMealPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch shopping lists';
      })

      // Fetch shopping list by ID
      .addCase(fetchShoppingListById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShoppingListById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentShoppingList = action.payload;
      })
      .addCase(fetchShoppingListById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch shopping list';
      })

      // Fetch shopping list items
      .addCase(fetchShoppingListItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShoppingListItems.fulfilled, (state, action) => {
        state.loading = false;
        state.currentShoppingListItems = action.payload;
      })
      .addCase(fetchShoppingListItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch shopping list items';
      })

      // Create shopping list
      .addCase(createShoppingList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createShoppingList.fulfilled, (state, action) => {
        state.loading = false;
        state.shoppingLists.unshift(action.payload);
      })
      .addCase(createShoppingList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create shopping list';
      })

      // Update shopping list
      .addCase(updateShoppingList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateShoppingList.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.shoppingLists.findIndex(sl => sl.id === action.payload.id);
        if (index !== -1) {
          state.shoppingLists[index] = action.payload;
        }
        if (state.currentShoppingList?.id === action.payload.id) {
          state.currentShoppingList = action.payload;
        }
      })
      .addCase(updateShoppingList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update shopping list';
      })

      // Remove shopping list
      .addCase(removeShoppingList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeShoppingList.fulfilled, (state, action) => {
        state.loading = false;
        state.shoppingLists = state.shoppingLists.filter(sl => sl.id !== action.payload);
        if (state.currentShoppingList?.id === action.payload) {
          state.currentShoppingList = null;
          state.currentShoppingListItems = [];
        }
      })
      .addCase(removeShoppingList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove shopping list';
      })

      // Add shopping list item
      .addCase(addShoppingListItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addShoppingListItem.fulfilled, (state, action) => {
        state.loading = false;
        state.currentShoppingListItems.push(action.payload);
      })
      .addCase(addShoppingListItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add item to shopping list';
      })

      // Update shopping list item status
      .addCase(updateShoppingListItemStatus.fulfilled, (state, action) => {
        const item = state.currentShoppingListItems.find(item => item.id === action.payload.id);
        if (item) {
          item.isChecked = action.payload.isChecked;
        }
      })
      .addCase(updateShoppingListItemStatus.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update item status';
      })

      // Remove shopping list item
      .addCase(removeShoppingListItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeShoppingListItem.fulfilled, (state, action) => {
        state.loading = false;
        state.currentShoppingListItems = state.currentShoppingListItems.filter(
          item => item.id !== action.payload
        );
      })
      .addCase(removeShoppingListItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to remove item from shopping list';
      });
  },
});

export const { clearError, clearCurrentShoppingList, toggleItemCheckedOptimistic } = shoppingListsSlice.actions;

export default shoppingListsSlice.reducer;

// Selectors
export const selectShoppingLists = (state: { shoppingLists: ShoppingListsState }) => state.shoppingLists.shoppingLists;
export const selectCurrentShoppingList = (state: { shoppingLists: ShoppingListsState }) => state.shoppingLists.currentShoppingList;
export const selectCurrentShoppingListItems = (state: { shoppingLists: ShoppingListsState }) => state.shoppingLists.currentShoppingListItems;
export const selectShoppingListsLoading = (state: { shoppingLists: ShoppingListsState }) => state.shoppingLists.loading;
export const selectShoppingListsError = (state: { shoppingLists: ShoppingListsState }) => state.shoppingLists.error;
