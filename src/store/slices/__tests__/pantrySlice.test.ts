import { configureStore } from '@reduxjs/toolkit';
import pantryReducer, {
  selectPantryItems,
  selectPantryLoading,
  selectPantryError,
  selectPantryItemById,
} from '../pantrySlice';

// Mock any necessary globals if needed, but for now, seems not required

describe('pantrySlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        pantry: pantryReducer,
      },
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().pantry;
      expect(state.items).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('loading states and CRUD operations', () => {
    const mockItem = {
      id: '1',
      name: 'Salt',
      amount: 100,
      unit: 'g',
      category: 'herbs',
    };

    it('should handle loadPantryItems', () => {
      store.dispatch({ type: 'pantry/loadPantryItems/pending' });
      let state = store.getState().pantry;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'pantry/loadPantryItems/fulfilled', payload: [mockItem] });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.items).toEqual([mockItem]);

      store.dispatch({ type: 'pantry/loadPantryItems/rejected', error: { message: 'Load error' } });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Load error');
    });

    it('should handle addPantryItem', () => {
      store.dispatch({ type: 'pantry/addPantryItem/pending' });
      let state = store.getState().pantry;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'pantry/addPantryItem/fulfilled', payload: mockItem });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.items).toEqual([mockItem]);

      store.dispatch({ type: 'pantry/addPantryItem/rejected', error: { message: 'Add error' } });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Add error');
    });

    it('should handle updatePantryItem', () => {
      // First, add an item
      store.dispatch({ type: 'pantry/addPantryItem/fulfilled', payload: mockItem });

      const updatedItem = { ...mockItem, amount: 200 };

      store.dispatch({ type: 'pantry/updatePantryItem/pending' });
      let state = store.getState().pantry;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'pantry/updatePantryItem/fulfilled', payload: updatedItem });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.items[0].amount).toBe(200);

      store.dispatch({ type: 'pantry/updatePantryItem/rejected', error: { message: 'Update error' } });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Update error');
    });

    it('should handle deletePantryItem', () => {
      // First, add an item
      store.dispatch({ type: 'pantry/addPantryItem/fulfilled', payload: mockItem });

      store.dispatch({ type: 'pantry/deletePantryItem/pending' });
      let state = store.getState().pantry;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);

      store.dispatch({ type: 'pantry/deletePantryItem/fulfilled', payload: '1' });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.items).toEqual([]);

      store.dispatch({ type: 'pantry/deletePantryItem/rejected', error: { message: 'Delete error' } });
      state = store.getState().pantry;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Delete error');
    });
  });

  describe('selectors', () => {
    const mockState = {
      pantry: {
        items: [
          {
            id: '1',
            name: 'Salt',
            amount: 100,
            unit: 'g',
            category: 'herbs',
          },
        ],
        loading: false,
        error: null,
      },
    };

    it('should select pantry items', () => {
      const result = selectPantryItems(mockState);
      expect(result).toEqual(mockState.pantry.items);
    });

    it('should select loading state', () => {
      const result = selectPantryLoading(mockState);
      expect(result).toBe(false);
    });

    it('should select error state', () => {
      const result = selectPantryError(mockState);
      expect(result).toBe(null);
    });

    it('should select pantry item by id', () => {
      const result = selectPantryItemById(mockState, '1');
      expect(result).toEqual(mockState.pantry.items[0]);
      const missing = selectPantryItemById(mockState, '2');
      expect(missing).toBe(null);
    });
  });
});
