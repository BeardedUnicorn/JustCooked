import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeView from '../RecipeView';
import { getRecipeById } from '@services/recipeStorage';
import darkTheme from '@styles/theme';

// Mock the services
jest.mock('@services/recipeStorage');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-recipe-id' }),
  useNavigate: () => jest.fn(),
}));

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
    jest.clearAllMocks();
  });

  it('should render start cooking button when recipe is loaded', async () => {
    (getRecipeById as jest.Mock).mockResolvedValue(mockRecipe);

    renderWithProviders(<RecipeView />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    const startCookingButton = screen.getByRole('button', { name: /start cooking/i });
    expect(startCookingButton).toBeInTheDocument();
    expect(startCookingButton).toHaveAttribute('aria-label', 'start cooking mode');
  });

  it('should navigate to cooking mode when start cooking button is clicked', async () => {
    const mockNavigate = jest.fn();

    // Mock useNavigate before rendering
    const useNavigateSpy = jest.spyOn(require('react-router-dom'), 'useNavigate');
    useNavigateSpy.mockReturnValue(mockNavigate);

    (getRecipeById as jest.Mock).mockResolvedValue(mockRecipe);

    renderWithProviders(<RecipeView />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    const startCookingButton = screen.getByRole('button', { name: /start cooking/i });
    fireEvent.click(startCookingButton);

    expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-id/cook');

    useNavigateSpy.mockRestore();
  });

  it('should not render start cooking button when recipe is not loaded', () => {
    (getRecipeById as jest.Mock).mockResolvedValue(null);

    renderWithProviders(<RecipeView />);

    expect(screen.queryByRole('button', { name: /start cooking/i })).not.toBeInTheDocument();
  });
});
