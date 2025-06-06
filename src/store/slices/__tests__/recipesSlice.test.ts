import { configureStore } from '@reduxjs/toolkit';
import recipesReducer, {
  selectRecipes,
  selectRecipesLoading,
  selectRecipesError,
  selectCurrentRecipe,
  selectRecipeById,
  setCurrentRecipe,
} from '../recipesSlice';

describe('recipesSlice', () => {
  let store: ReturnType<typeof configureStore>;

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
      const mockRecipe = {
        id: '1',
        title: 'Test Recipe',
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
      store.dispatch(setCurrentRecipe(mockRecipe));
      const state = store.getState().recipes;
      expect(state.currentRecipe).toEqual(mockRecipe);
    });
  });

  describe('loading states and CRUD operations', () => {
    const mockRecipe = {
      id: '1',
      title: 'Test Recipe',
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

    it('should handle loadAllRecipes', () => {
      store.dispatch({ type: 'recipes/loadAllRecipes/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/loadAllRecipes/fulfilled', payload: [mockRecipe] });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.recipes).toEqual([mockRecipe]);

      // @ts-ignore
      store.dispatch({ type: 'recipes/loadAllRecipes/rejected', error: { message: 'Load error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Load error');
    });

    it('should handle loadRecipeById', () => {
      store.dispatch({ type: 'recipes/loadRecipeById/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/loadRecipeById/fulfilled', payload: mockRecipe });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.currentRecipe).toEqual(mockRecipe);

      // @ts-ignore
      store.dispatch({ type: 'recipes/loadRecipeById/rejected', error: { message: 'Load error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Load error');
    });

    it('should handle saveRecipe', () => {
      store.dispatch({ type: 'recipes/saveRecipe/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: mockRecipe });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.recipes).toEqual([mockRecipe]);

      // @ts-ignore
      store.dispatch({ type: 'recipes/saveRecipe/rejected', error: { message: 'Save error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Save error');
    });

    it('should handle updateRecipe', () => {
      // First, add a recipe
      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: mockRecipe });

      const updatedRecipe = { ...mockRecipe, title: 'Updated Recipe' };

      store.dispatch({ type: 'recipes/updateRecipe/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/updateRecipe/fulfilled', payload: updatedRecipe });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.recipes[0].title).toBe('Updated Recipe');

      // @ts-ignore
      store.dispatch({ type: 'recipes/updateRecipe/rejected', error: { message: 'Update error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Update error');
    });

    it('should handle deleteRecipe', () => {
      // First, add a recipe
      store.dispatch({ type: 'recipes/saveRecipe/fulfilled', payload: mockRecipe });

      store.dispatch({ type: 'recipes/deleteRecipe/pending' });
      let state = store.getState().recipes;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipes/deleteRecipe/fulfilled', payload: '1' });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.recipes).toEqual([]);

      // @ts-ignore
      store.dispatch({ type: 'recipes/deleteRecipe/rejected', error: { message: 'Delete error' } });
      state = store.getState().recipes;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Delete error');
    });
  });

  describe('selectors', () => {
    const mockState = {
      recipes: {
        recipes: [
          {
            id: '1',
            title: 'Test Recipe',
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
          },
        ],
        loading: false,
        error: null,
        currentRecipe: null,
      },
    };

    it('should select recipes', () => {
      const result = selectRecipes(mockState);
      expect(result).toEqual(mockState.recipes.recipes);
    });

    it('should select loading state', () => {
      const result = selectRecipesLoading(mockState);
      expect(result).toBe(false);
    });

    it('should select error state', () => {
      const result = selectRecipesError(mockState);
      expect(result).toBe(null);
    });

    it('should select current recipe', () => {
      const result = selectCurrentRecipe(mockState);
      expect(result).toBe(null);
    });

    it('should select recipe by id', () => {
      const result = selectRecipeById(mockState, '1');
      expect(result).toEqual(mockState.recipes.recipes[0]);
      const missing = selectRecipeById(mockState, '2');
      expect(missing).toBe(null);
    });
  });
});
