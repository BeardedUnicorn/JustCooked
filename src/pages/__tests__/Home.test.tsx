import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Home from '../../pages/Home';
import recipesReducer from '../../store/slices/recipesSlice';
import ingredientsReducer from '../../store/slices/ingredientsSlice';
import pantryReducer from '../../store/slices/pantrySlice';
import searchHistoryReducer from '../../store/slices/searchHistorySlice';
import recipeCollectionsReducer from '../../store/slices/recipeCollectionsSlice';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// Mock the loadAllRecipes thunk to prevent it from overriding our test data
vi.mock('../../store/slices/recipesSlice', async () => {
  const actual = await vi.importActual('../../store/slices/recipesSlice');
  return {
    ...actual,
    default: (actual as any).default,
    loadAllRecipes: vi.fn(() => ({ type: 'recipes/loadAllRecipes/fulfilled', payload: [] })),
  };
});

const createMockStore = (recipes = [], loading = false, error: string | null = null) => {
  return configureStore({
    reducer: {
      recipes: recipesReducer,
      ingredients: ingredientsReducer,
      pantry: pantryReducer,
      searchHistory: searchHistoryReducer,
      recipeCollections: recipeCollectionsReducer,
    },
    preloadedState: {
      recipes: {
        recipes,
        loading,
        error,
        currentRecipe: null,
      },
      ingredients: {
        ingredients: [],
        loading: false,
        error: null,
        searchResults: [],
      },
      pantry: {
        items: [],
        loading: false,
        error: null,
      },
      searchHistory: {
        searches: [],
        loading: false,
        error: null,
      },
      recipeCollections: {
        collections: [],
        loading: false,
        error: null,
        currentCollection: null,
      },
    },
  });
};

const renderHome = (recipes = [], loading = false, error: string | null = null) => {
  const store = createMockStore(recipes, loading, error);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </Provider>
  );
};

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('should display empty state when no recipes exist', async () => {
    renderHome([]);

    await waitFor(() => {
      expect(screen.getByText('No recipes yet!')).toBeInTheDocument();
      expect(screen.getByText('Start by importing your favorite recipes.')).toBeInTheDocument();
      expect(screen.getByText('Import Recipe')).toBeInTheDocument();
    });

    // Categories section should not be displayed when no recipes exist
    expect(screen.queryByText('Recipe Categories')).not.toBeInTheDocument();
  });

  it('should handle recipe storage errors gracefully', async () => {
    renderHome([], false, 'Storage error');

    await waitFor(() => {
      // Should not crash and should show empty state
      expect(screen.getByText('No recipes yet!')).toBeInTheDocument();
      expect(screen.queryByText('Recipe Categories')).not.toBeInTheDocument();
    });
  });

  it('should render Recently Added section header', () => {
    renderHome([]);
    expect(screen.getByText('Recently Added')).toBeInTheDocument();
    expect(screen.getByText('View All')).toBeInTheDocument();
  });

  it('should navigate to import page when Import Recipe button is clicked', async () => {
    renderHome([]);

    await waitFor(() => {
      expect(screen.getByText('Import Recipe')).toBeInTheDocument();
    });

    const importButton = screen.getByText('Import Recipe');
    importButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/import');
  });

  it('should navigate to search page when View All button is clicked', () => {
    renderHome([]);

    const viewAllButton = screen.getByText('View All');
    viewAllButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/search');
  });

  it('should render the component without crashing with various states', () => {
    // Test with empty recipes
    const { unmount } = renderHome([]);
    expect(screen.getByText('Recently Added')).toBeInTheDocument();
    unmount();

    // Test with error state
    const { unmount: unmount2 } = renderHome([], false, 'Test error');
    expect(screen.getByText('Recently Added')).toBeInTheDocument();
    unmount2();
  });

  it('should have proper accessibility structure', () => {
    renderHome([]);

    // Check for proper heading structure
    const mainHeading = screen.getByRole('heading', { level: 2, name: 'Recently Added' });
    expect(mainHeading).toBeInTheDocument();

    // Check for proper button roles
    const viewAllButton = screen.getByRole('button', { name: 'View All' });
    expect(viewAllButton).toBeInTheDocument();

    const importButton = screen.getByRole('button', { name: 'Import Recipe' });
    expect(importButton).toBeInTheDocument();
  });
});
