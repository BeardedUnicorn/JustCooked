import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeDetail from '../RecipeDetail';
import darkTheme from '../../theme';

// Mock the hooks and utils
jest.mock('@hooks/useImageUrl', () => ({
  useImageUrl: () => ({ imageUrl: 'test-image-url.jpg' }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock ingredient and serving utils
jest.mock('@utils/servingUtils', () => ({
  ...jest.requireActual('@utils/servingUtils'),
  scaleIngredients: jest.fn((ingredients, _, newServings) => {
    // Simple mock scaling for testing
    const scalingFactor = newServings / 4; // Original servings is 4 in mockRecipe
    return ingredients.map((ing: any) => ({ ...ing, amount: ing.amount * scalingFactor }));
  }),
}));

const mockRecipe = {
  id: 'test-recipe-id',
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  ingredients: [
    { name: 'flour', amount: 1, unit: 'cup' },
    { name: 'eggs', amount: 2, unit: '' }, // No unit for eggs
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

const mockOnEdit = jest.fn();

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render recipe title and description', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('A delicious test recipe')).toBeInTheDocument();
  });

  it('should render ingredients and instructions', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    // Check ingredients table headers
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Ingredient')).toBeInTheDocument();
    expect(screen.getByText('Preparation')).toBeInTheDocument();
    
    // Check ingredient amounts and names
    expect(screen.getByText('1 cup')).toBeInTheDocument();
    expect(screen.getByText('flour')).toBeInTheDocument();
    // Use getAllByText as '2' can appear multiple times (e.g., ingredient amount and instruction step)
    expect(screen.getAllByText('2')[0]).toBeInTheDocument();
    expect(screen.getByText('eggs')).toBeInTheDocument();
    expect(screen.getByText('1/2 cup')).toBeInTheDocument();
    expect(screen.getByText('sugar')).toBeInTheDocument();
    
    // Check instructions
    expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
    expect(screen.getByText('Bake for 30 minutes')).toBeInTheDocument();
  });

  it('should render meta information like time and servings', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);
    
    expect(screen.getByText('Prep Time')).toBeInTheDocument();
    expect(screen.getByText('15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Cook Time')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('Total Time')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('Servings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  it('should render tags and source URL', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    expect(screen.getByText('dessert')).toBeInTheDocument();
    expect(screen.getByText('easy')).toBeInTheDocument();
    expect(screen.getByText('baking')).toBeInTheDocument();
    
    // A Button with an href renders an <a> tag, which has the 'link' role
    const sourceLink = screen.getByRole('link', { name: /example.com/i });
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/recipe');
  });

  it('should call onEdit when the edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should adjust serving size and scale ingredients', async () => {
    const { scaleIngredients } = require('@utils/servingUtils');
    const user = userEvent.setup();
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);
    
    const servingsInput = screen.getByDisplayValue('4');
    const incrementButton = screen.getByRole('button', { name: /increase servings/i });

    // Initial call
    expect(scaleIngredients).toHaveBeenCalledWith(mockRecipe.ingredients, 4, 4);

    // Increment servings to 8 (double)
    await user.click(incrementButton); // 5
    await user.click(incrementButton); // 6
    await user.click(incrementButton); // 7
    await user.click(incrementButton); // 8

    await waitFor(() => {
      expect(servingsInput).toHaveValue(8);
    });

    // Check if scaling function was called with new serving size
    expect(scaleIngredients).toHaveBeenCalledWith(mockRecipe.ingredients, 4, 8);
  });

  it('should handle manual input for serving size', async () => {
    const { scaleIngredients } = require('@utils/servingUtils');
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);
    
    const servingsInput = screen.getByDisplayValue('4');
    
    // Use fireEvent.change for direct and reliable input manipulation
    fireEvent.change(servingsInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(servingsInput).toHaveValue(10);
    });
    
    expect(scaleIngredients).toHaveBeenCalledWith(mockRecipe.ingredients, 4, 10);
  });
});