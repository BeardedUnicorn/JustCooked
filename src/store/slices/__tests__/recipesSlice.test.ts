import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import recipesReducer, {
  selectRecipes,
  selectRecipesLoading,
  selectRecipesError,
  selectCurrentRecipe,
  selectRecipeById,
  setCurrentRecipe,
  RecipesState,
} from '../recipesSlice';
import { Recipe } from '@app-types';

// Mock the fs plugin
vi.mock('@tauri-apps/plugin-fs');

const mockRecipe1: Recipe = {
  id: '1',
  title: 'Test Recipe 1',
  description: '',
  image: '',
  sourceUrl: '',
  prepTime: '',
  cookTime: '',
  totalTime: '',
  servings: 4,
  ingredients: [],
  instructions: [],
  tags: [],
  dateAdded: '2023-01-01',
  dateModified: '2023-01-01',
};

const mockRecipe2: Recipe = {
  id: '2',
  title: 'Test Recipe 2',
  description: '',
  image: '',
  sourceUrl: '',
  prepTime: '',
  cookTime: '',
  totalTime: '',
  servings: 2,
  ingredients: [],
  instructions: [],
  tags: [],
  dateAdded: '2023-01-02',
  dateModified: '2023-01-02',
};

describe('recipesSlice', () => {
  let store: EnhancedStore<{ recipes: RecipesState }>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        recipes: recipesReducer,
      },
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().recipes;
      expect(state.recipes).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.currentRecipe).toBe(null);
    });
  });

  describe('reducers', () => {
    it('should set current recipe', () => {
      store.dispatch(setCurrentRecipe(mockRecipe1));
      const state = store.getState().recipes;
      expect(state.currentRecipe).toEqual(mockRecipe1);
    });
  });

  describe('extraReducers', () => {
    it('should handle loadAllRecipes states', () => {
      store.dispatch({ type: 'recipes/loadAllRecipes/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/loadAllRecipes/fulfilled', payload: [mockRecipe1] });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.recipes).toEqual([mockRecipe1]);

      store.dispatch({ type: 'recipes/loadAllRecipes/rejected', error: { message: 'Load error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Load error');
    });

    it('should handle saveRecipe fulfilled for a new recipe', () => {
      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: mockRecipe1 });
      const state = store.getState().recipes;
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0]).toEqual(mockRecipe1);
    });

    it('should handle saveRecipe fulfilled for an existing recipe', () => {
      // Pre-fill state with recipe 1
      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: mockRecipe1 });
      
      const updatedRecipe1 = { ...mockRecipe1, title: 'Updated Title' };
      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: updatedRecipe1 });

      const state = store.getState().recipes;
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0].title).toBe('Updated Title');
    });

    it('should handle updateRecipe fulfilled', () => {
      // Pre-fill state with two recipes and set one as current
      store.dispatch({ type: 'recipes/loadAllRecipes/fulfilled', payload: [mockRecipe1, mockRecipe2] });
      store.dispatch(setCurrentRecipe(mockRecipe1));
      
      const updatedRecipe1 = { ...mockRecipe1, title: 'Updated Title' };
      store.dispatch({ type: 'recipes/updateRecipe/fulfilled', payload: updatedRecipe1 });

      const state = store.getState().recipes;
      
      // Check list of all recipes
      expect(state.recipes).toHaveLength(2);
      expect(state.recipes.find(r => r.id === '1')?.title).toBe('Updated Title');
      
      // Check that current recipe is also updated
      expect(state.currentRecipe?.title).toBe('Updated Title');
    });

    it('should handle deleteRecipe fulfilled', () => {
      // Pre-fill state
      store.dispatch({ type: 'recipes/loadAllRecipes/fulfilled', payload: [mockRecipe1, mockRecipe2] });
      store.dispatch(setCurrentRecipe(mockRecipe1));

      store.dispatch({ type: 'recipes/deleteRecipe/fulfilled', payload: '1' });

      const state = store.getState().recipes;
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0].id).toBe('2');
      // Current recipe should be cleared if it was the one deleted
      expect(state.currentRecipe).toBeNull();
    });
  });

  describe('selectors', () => {
    const mockState = {
      recipes: {
        recipes: [mockRecipe1, mockRecipe2],
        loading: false,
        error: null,
        currentRecipe: mockRecipe1,
      },
    };

    it('should select recipe by id', () => {
      expect(selectRecipeById(mockState, '1')).toEqual(mockRecipe1);
      expect(selectRecipeById(mockState, '2')).toEqual(mockRecipe2);
      expect(selectRecipeById(mockState, '3')).toBe(null);
    });
    
    it('should select all recipes', () => {
      expect(selectRecipes(mockState)).toEqual([mockRecipe1, mockRecipe2]);
    });

    it('should select loading state', () => {
      expect(selectRecipesLoading(mockState)).toBe(false);
    });

    it('should select error state', () => {
      expect(selectRecipesError(mockState)).toBe(null);
    });

    it('should select current recipe', () => {
      expect(selectCurrentRecipe(mockState)).toEqual(mockRecipe1);
    });
  });
});