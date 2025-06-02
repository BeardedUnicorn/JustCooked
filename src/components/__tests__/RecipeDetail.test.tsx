import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeDetail from '../RecipeDetail';
import darkTheme from '@styles/theme';

// Mock the hooks
jest.mock('@hooks/useImageUrl', () => ({
  useImageUrl: () => ({ imageUrl: 'test-image-url.jpg' }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const mockRecipe = {
  id: 'test-recipe-id',
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  ingredients: [
    { name: 'flour', amount: 1, unit: 'cup' },
    { name: 'eggs', amount: 2, unit: 'piece' },
    { name: 'sugar', amount: 0.5, unit: 'cup' }
  ],
  instructions: ['Mix ingredients', 'Bake for 30 minutes', 'Let cool'],
  prepTime: 'PT15M',
  cookTime: 'PT30M',
  totalTime: 'PT45M',
  servings: 4,
  image: 'test-image.jpg',
  sourceUrl: 'https://example.com/recipe',
  tags: ['dessert', 'easy', 'baking'],
  dateAdded: '2024-01-01T00:00:00Z',
  dateModified: '2024-01-01T00:00:00Z',
  difficulty: 'Easy' as const,
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

describe('RecipeDetail', () => {




  it('should render recipe title and description', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} />);

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('A delicious test recipe')).toBeInTheDocument();
  });

  it('should render ingredients and instructions', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} />);

    expect(screen.getByText('1 cup flour')).toBeInTheDocument();
    expect(screen.getByText('2 piece eggs')).toBeInTheDocument();
    expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
    expect(screen.getByText('Bake for 30 minutes')).toBeInTheDocument();
  });
});
