import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import ingredientsReducer from './slices/ingredientsSlice';
import pantryReducer from './slices/pantrySlice';
import recipesReducer from './slices/recipesSlice';
import searchHistoryReducer from './slices/searchHistorySlice';
import recipeCollectionsReducer from './slices/recipeCollectionsSlice';
import importQueueReducer from './slices/importQueueSlice';
import mealPlansReducer from './slices/mealPlansSlice';
import shoppingListsReducer from './slices/shoppingListsSlice';

export const store = configureStore({
  reducer: {
    ingredients: ingredientsReducer,
    pantry: pantryReducer,
    recipes: recipesReducer,
    searchHistory: searchHistoryReducer,
    recipeCollections: recipeCollectionsReducer,
    importQueue: importQueueReducer,
    mealPlans: mealPlansReducer,
    shoppingLists: shoppingListsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: {
    // Enable Redux DevTools for Tauri v2
    name: 'JustCooked Redux Store',
    trace: true,
    traceLimit: 25,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
