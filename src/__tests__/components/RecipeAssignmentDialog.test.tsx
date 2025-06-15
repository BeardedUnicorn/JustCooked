import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import RecipeAssignmentDialog from '../../components/RecipeAssignmentDialog';
import { Recipe } from '../../types';

// Mock the services
vi.mock('@services/recipeStorage', () => ({
  getAllRecipes: vi.fn(),
}));

vi.mock('../../services/mealPlanStorage', () => ({
  createNewMealPlanRecipe: vi.fn(),
  saveMealPlanRecipe: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Test Recipe 1',
    description: 'A test recipe',
    ingredients: [
      { name: 'Flour', amount: 2, unit: 'cups', section: undefined },
      { name: 'Sugar', amount: 1, unit: 'cup', section: undefined },
    ],
    instructions: ['Mix ingredients', 'Bake'],
    prepTime: '15 minutes',
    cookTime: '30 minutes',
    totalTime: '45 minutes',
    servings: 4,
    tags: ['dessert', 'easy'],
    sourceUrl: 'https://example.com/recipe1',
    image: '',
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
    isFavorite: false,
  },
  {
    id: '2',
    title: 'Test Recipe 2',
    description: 'Another test recipe',
    ingredients: [
      { name: 'Chicken', amount: 1, unit: 'lb', section: undefined },
      { name: 'Rice', amount: 2, unit: 'cups', section: undefined },
    ],
    instructions: ['Cook chicken', 'Prepare rice'],
    prepTime: '10 minutes',
    cookTime: '25 minutes',
    totalTime: '35 minutes',
    servings: 6,
    tags: ['dinner', 'protein'],
    sourceUrl: 'https://example.com/recipe2',
    image: '',
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
    isFavorite: false,
  },
];

const mockStore = configureStore({
  reducer: {
    // Add minimal reducers for testing
    test: (state = {}) => state,
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={mockStore}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {component}
      </LocalizationProvider>
    </Provider>
  );
};

describe('RecipeAssignmentDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    mealPlanId: 'test-meal-plan',
    selectedDate: '2024-01-15',
    selectedMealType: 'dinner',
    enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
    onRecipeAssigned: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getAllRecipes } = await import('@services/recipeStorage');
    (getAllRecipes as any).mockResolvedValue(mockRecipes);
  });

  it('renders dialog with correct title and date', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    expect(screen.getByText('Assign Recipe to Meal Plan')).toBeInTheDocument();
    expect(screen.getByText(/Sunday, January 14, 2024/)).toBeInTheDocument();
    expect(screen.getAllByText(/Dinner/)).toHaveLength(2); // One in title, one in select
  });

  it('displays recipe search input', () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    expect(screen.getByLabelText('Search Recipes')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-search-input')).toBeInTheDocument();
  });

  it('displays meal type selector with enabled meal types', () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    expect(screen.getByTestId('recipe-assignment-meal-type-select')).toBeInTheDocument();
    expect(screen.getAllByText('Meal Type')).toHaveLength(2); // Label and legend
  });

  it('displays serving multiplier input', () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    expect(screen.getByLabelText('Serving Multiplier')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-assignment-serving-multiplier-input')).toBeInTheDocument();
  });

  it('loads and displays recipes', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    });
  });

  it('filters recipes based on search query', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('recipe-search-input').querySelector('input');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'chicken' } });
    }

    await waitFor(() => {
      expect(screen.queryByText('Test Recipe 1')).not.toBeInTheDocument();
      expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    });
  });

  it('allows recipe selection', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const recipeCard = screen.getByTestId('recipe-card-1');
    fireEvent.click(recipeCard);

    // Check if the recipe is selected (border should change)
    expect(recipeCard).toHaveStyle('border-color: rgb(25, 118, 210)'); // primary.main color
  });

  it('enables assign button when recipe is selected', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    const assignButton = screen.getByTestId('recipe-assignment-assign-button');
    expect(assignButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const recipeCard = screen.getByTestId('recipe-card-1');
    fireEvent.click(recipeCard);

    expect(assignButton).toBeEnabled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByTestId('recipe-assignment-cancel-button');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles serving multiplier changes', () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    const servingInput = screen.getByTestId('recipe-assignment-serving-multiplier-input').querySelector('input');
    if (servingInput) {
      fireEvent.change(servingInput, { target: { value: '2.5' } });
      expect(servingInput.value).toBe('2.5');
    }
  });

  it('handles notes input', () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    const notesInput = screen.getByTestId('recipe-assignment-notes-input').querySelector('textarea');
    if (notesInput) {
      fireEvent.change(notesInput, { target: { value: 'Special notes for this meal' } });
      expect(notesInput.value).toBe('Special notes for this meal');
    }
  });

  it('clears search when clear button is clicked', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    const searchInput = screen.getByTestId('recipe-search-input').querySelector('input');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'test search' } });
      expect(searchInput.value).toBe('test search');

      const clearButton = screen.getByTestId('recipe-search-clear-button');
      fireEvent.click(clearButton);

      expect(searchInput.value).toBe('');
    }
  });

  it('shows no recipes message when search returns no results', async () => {
    renderWithProviders(<RecipeAssignmentDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('recipe-search-input').querySelector('input');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'nonexistent recipe' } });
    }

    await waitFor(() => {
      expect(screen.getByText('No recipes found matching your search')).toBeInTheDocument();
    });
  });
});
