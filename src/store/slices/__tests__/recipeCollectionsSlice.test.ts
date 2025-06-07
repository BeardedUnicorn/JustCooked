import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import recipeCollectionsReducer, {
  selectRecipeCollections,
  selectRecipeCollectionsLoading,
  selectRecipeCollectionsError,
  selectCurrentCollection,
  selectRecipeCollectionById,
  selectCollectionsContainingRecipe,
  setCurrentCollection,
  RecipeCollectionsState,
} from '../recipeCollectionsSlice';

describe('recipeCollectionsSlice', () => {
  let store: EnhancedStore<{ recipeCollections: RecipeCollectionsState }>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        recipeCollections: recipeCollectionsReducer,
      },
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().recipeCollections;
      expect(state.collections).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.currentCollection).toBe(null);
    });
  });

  describe('reducers', () => {
    it('should set current collection', () => {
      const mockCollection = {
        id: '1',
        name: 'Favorites',
        recipeIds: [],
        dateCreated: '2023-01-01',
        dateModified: '2023-01-01',
      };
      store.dispatch(setCurrentCollection(mockCollection));
      const state = store.getState().recipeCollections;
      expect(state.currentCollection).toEqual(mockCollection);
    });
  });

  describe('loading states and CRUD operations', () => {
    const mockCollection = {
      id: '1',
      name: 'Favorites',
      recipeIds: [],
      dateCreated: '2023-01-01',
      dateModified: '2023-01-01',
    };

    it('should handle loadRecipeCollections', () => {
      store.dispatch({ type: 'recipeCollections/loadRecipeCollections/pending' });
      let state = store.getState().recipeCollections;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipeCollections/loadRecipeCollections/fulfilled', payload: [mockCollection] });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.collections).toEqual([mockCollection]);

      store.dispatch({ type: 'recipeCollections/loadRecipeCollections/rejected', error: { message: 'Load error' } });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Load error');
    });

    it('should handle createRecipeCollection', () => {
      store.dispatch({ type: 'recipeCollections/createRecipeCollection/pending' });
      let state = store.getState().recipeCollections;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipeCollections/createRecipeCollection/fulfilled', payload: mockCollection });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.collections).toEqual([mockCollection]);

      store.dispatch({ type: 'recipeCollections/createRecipeCollection/rejected', error: { message: 'Create error' } });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Create error');
    });

    it('should handle updateRecipeCollection', () => {
      // First, add a collection
      store.dispatch({ type: 'recipeCollections/createRecipeCollection/fulfilled', payload: mockCollection });

      const updatedCollection = { ...mockCollection, name: 'Updated Favorites' };

      store.dispatch({ type: 'recipeCollections/updateRecipeCollection/pending' });
      let state = store.getState().recipeCollections;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipeCollections/updateRecipeCollection/fulfilled', payload: updatedCollection });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.collections[0].name).toBe('Updated Favorites');

      store.dispatch({ type: 'recipeCollections/updateRecipeCollection/rejected', error: { message: 'Update error' } });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Update error');
    });

    it('should handle deleteRecipeCollection', () => {
      // First, add a collection
      store.dispatch({ type: 'recipeCollections/createRecipeCollection/fulfilled', payload: mockCollection });

      store.dispatch({ type: 'recipeCollections/deleteRecipeCollection/pending' });
      let state = store.getState().recipeCollections;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'recipeCollections/deleteRecipeCollection/fulfilled', payload: '1' });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.collections).toEqual([]);

      // @ts-ignore
      store.dispatch({ type: 'recipeCollections/deleteRecipeCollection/rejected', error: { message: 'Delete error' } });
      state = store.getState().recipeCollections;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Delete error');
    });

    // Can add for addRecipeToCollection, etc., but to keep similar
  });

  describe('selectors', () => {
    const mockState = {
      recipeCollections: {
        collections: [
          {
            id: '1',
            name: 'Favorites',
            recipeIds: ['recipe1'],
            dateCreated: '2023-01-01',
            dateModified: '2023-01-01',
          },
        ],
        loading: false,
        error: null,
        currentCollection: null,
      },
    };

    it('should select recipe collections', () => {
      const result = selectRecipeCollections(mockState);
      expect(result).toEqual(mockState.recipeCollections.collections);
    });

    it('should select loading state', () => {
      const result = selectRecipeCollectionsLoading(mockState);
      expect(result).toBe(false);
    });

    it('should select error state', () => {
      const result = selectRecipeCollectionsError(mockState);
      expect(result).toBe(null);
    });

    it('should select current collection', () => {
      const result = selectCurrentCollection(mockState);
      expect(result).toBe(null);
    });

    it('should select recipe collection by id', () => {
      const result = selectRecipeCollectionById(mockState, '1');
      expect(result).toEqual(mockState.recipeCollections.collections[0]);
      const missing = selectRecipeCollectionById(mockState, '2');
      expect(missing).toBe(null);
    });

    it('should select collections containing recipe', () => {
      const result = selectCollectionsContainingRecipe(mockState, 'recipe1');
      expect(result).toEqual([mockState.recipeCollections.collections[0]]);
      const missing = selectCollectionsContainingRecipe(mockState, 'recipe2');
      expect(missing).toEqual([]);
    });
  });
});
