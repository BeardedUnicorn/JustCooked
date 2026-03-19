import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeView from '../RecipeView';
import { getRecipeById, deleteRecipe } from '@services/recipeStorage';
import darkTheme from '@styles/theme';

// Mock the services
vi.mock('@services/recipeStorage');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-recipe-id' }),
    useNavigate: () => mockNavigate,
  };
});

const mockRecipe = {
  id: 'test-recipe-id',
  title: 'Test Recipe',
  description: 'A test recipe',
  ingredients: [
    { name: 'flour', amount: 1, unit: 'cup' },
    { name: 'eggs', amount: 2, unit: 'piece' }
  ],
  instructions: ['Mix ingredients', 'Bake for 30 minutes'],
  prepTime: 'PT15M',
  cookTime: 'PT30M',
  totalTime: 'PT45M',
  servings: 4,
  image: 'test-image.jpg',
  sourceUrl: 'https://example.com/recipe',
  tags: ['easy', 'quick'],
  dateAdded: '2024-01-01T00:00:00Z',
  dateModified: '2024-01-01T00:00:00Z',
  difficulty: 'Easy',
  isFavorite: false,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('RecipeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render start cooking button when recipe is loaded', async () => {
    (getRecipeById as any).mockResolvedValue(mockRecipe);

    renderWithProviders(<RecipeView />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    const startCookingButton = screen.getByRole('button', { name: /start cooking/i });
    expect(startCookingButton).toBeInTheDocument();
    expect(startCookingButton).toHaveAttribute('aria-label', 'start cooking mode');
  });

  it('should navigate to cooking mode when start cooking button is clicked', async () => {
    (getRecipeById as any).mockResolvedValue(mockRecipe);

    renderWithProviders(<RecipeView />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    const startCookingButton = screen.getByRole('button', { name: /start cooking/i });
    fireEvent.click(startCookingButton);

    expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-id/cook');
  });

  it('should navigate back to the cookbook after deleting a recipe', async () => {
    (getRecipeById as any).mockResolvedValue(mockRecipe);
    (deleteRecipe as any).mockResolvedValue(undefined);

    renderWithProviders(<RecipeView />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('recipeViewPage-button-delete'));
    fireEvent.click(screen.getByTestId('recipeViewPage-dialog-deleteConfirm-button-confirm'));

    await waitFor(() => {
      expect(deleteRecipe).toHaveBeenCalledWith('test-recipe-id');
      expect(mockNavigate).toHaveBeenCalledWith('/cookbook');
    });
  });

  it('should not render start cooking button when recipe is not loaded', () => {
    (getRecipeById as any).mockResolvedValue(null);

    renderWithProviders(<RecipeView />);

    expect(screen.queryByRole('button', { name: /start cooking/i })).not.toBeInTheDocument();
  });
});
