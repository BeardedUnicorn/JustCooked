import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeDetail from '../RecipeDetail';
import darkTheme from '../../theme';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock the hooks and utils
vi.mock('@hooks/useImageUrl', () => ({
  useImageUrl: () => ({ imageUrl: 'test-image-url.jpg' }),
}));

// Mock the re-import service
vi.mock('@services/recipeImport', () => ({
  reImportRecipe: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock ingredient and serving utils
vi.mock('../../utils/servingUtils', () => ({
  scaleIngredients: vi.fn((ingredients, _, newServings) => {
    // Simple mock scaling for testing
    const scalingFactor = newServings / 4; // Original servings is 4 in mockRecipe
    return ingredients.map((ing: any) => ({ ...ing, amount: ing.amount * scalingFactor }));
  }),
  getScalingDescription: vi.fn((originalServings, newServings) => {
    return `Scaled from ${originalServings} to ${newServings} servings`;
  }),
  isValidServingSize: vi.fn((servings) => {
    return servings > 0 && servings <= 100;
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

const mockOnEdit = vi.fn();

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
    vi.clearAllMocks();
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

    // Check for the source URL button with testid
    const sourceLink = screen.getByTestId('recipe-detail-source-link');
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink).toHaveTextContent('example.com');
    expect(sourceLink).toHaveAttribute('aria-label', 'Open recipe source at example.com');
  });

  it('should call onEdit when the edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should call Tauri command when source URL link is clicked', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    const sourceLink = screen.getByTestId('recipe-detail-source-link');
    await user.click(sourceLink);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('open_external_url', {
        url: 'https://example.com/recipe',
      });
    });
  });

  it('should fall back to window.open when Tauri command fails', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockRejectedValue(new Error('Tauri command failed'));

    const mockWindowOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);

    const sourceLink = screen.getByTestId('recipe-detail-source-link');
    await user.click(sourceLink);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('open_external_url', {
        url: 'https://example.com/recipe',
      });
    });

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com/recipe',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('should not display source URL when sourceUrl is empty', () => {
    const recipeWithoutSource = { ...mockRecipe, sourceUrl: '' };
    renderWithProviders(<RecipeDetail recipe={recipeWithoutSource} onEdit={mockOnEdit} />);

    expect(screen.queryByTestId('recipe-detail-source-link')).not.toBeInTheDocument();
  });

  it('should display more than 20 ingredients correctly', () => {
    // Create a recipe with 25 ingredients to test large ingredient lists
    const manyIngredients = Array.from({ length: 25 }, (_, index) => ({
      name: `ingredient ${index + 1}`,
      amount: index + 1,
      unit: index % 3 === 0 ? 'cups' : index % 3 === 1 ? 'tablespoons' : 'teaspoons',
      section: index < 10 ? 'Main Ingredients' : index < 20 ? 'Spices' : 'Garnish',
    }));

    const recipeWithManyIngredients = {
      ...mockRecipe,
      ingredients: manyIngredients,
    };

    renderWithProviders(<RecipeDetail recipe={recipeWithManyIngredients} onEdit={mockOnEdit} />);

    // Check that all ingredients are rendered
    expect(screen.getByText('ingredient 1')).toBeInTheDocument();
    expect(screen.getByText('ingredient 10')).toBeInTheDocument();
    expect(screen.getByText('ingredient 20')).toBeInTheDocument();
    expect(screen.getByText('ingredient 25')).toBeInTheDocument();

    // Check that section headers are displayed
    expect(screen.getByText('Main Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Spices')).toBeInTheDocument();
    expect(screen.getByText('Garnish')).toBeInTheDocument();

    // Verify that all 25 ingredients are present by checking the ingredient tables
    const ingredientTables = screen.getAllByRole('table');
    expect(ingredientTables).toHaveLength(3); // 3 sections

    // Count total ingredient rows across all tables
    const allIngredientRows = screen.getAllByRole('row').filter(row =>
      row.getAttribute('data-testid')?.includes('ingredient-row')
    );
    expect(allIngredientRows).toHaveLength(25);
  });

  it('should adjust serving size and scale ingredients', async () => {
    const servingUtils = await import('../../utils/servingUtils');
    const scaleIngredients = vi.mocked(servingUtils.scaleIngredients);
    
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
    const servingUtils = await import('../../utils/servingUtils');
    const scaleIngredients = vi.mocked(servingUtils.scaleIngredients);
    
    renderWithProviders(<RecipeDetail recipe={mockRecipe} onEdit={mockOnEdit} />);
    
    const servingsInput = screen.getByDisplayValue('4');
    
    // Use fireEvent.change for direct and reliable input manipulation
    fireEvent.change(servingsInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(servingsInput).toHaveValue(10);
    });
    
    expect(scaleIngredients).toHaveBeenCalledWith(mockRecipe.ingredients, 4, 10);
  });

  it('should show re-import button when recipe has source URL', () => {
    renderWithProviders(<RecipeDetail recipe={mockRecipe} />);

    const reImportButton = screen.getByTestId('recipe-detail-reimport-button');
    expect(reImportButton).toBeInTheDocument();
    expect(reImportButton).toHaveTextContent('Re-import Recipe');
  });

  it('should not show re-import button when recipe has no source URL', () => {
    const recipeWithoutSource = { ...mockRecipe, sourceUrl: '' };
    renderWithProviders(<RecipeDetail recipe={recipeWithoutSource} />);

    expect(screen.queryByTestId('recipe-detail-reimport-button')).not.toBeInTheDocument();
  });

  it('should handle re-import success', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    const { reImportRecipe } = await import('@services/recipeImport');
    const mockReImportRecipe = vi.mocked(reImportRecipe);

    mockReImportRecipe.mockResolvedValue('test-recipe-id');
    mockInvoke.mockResolvedValue(mockRecipe);

    const mockOnRecipeUpdated = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <RecipeDetail recipe={mockRecipe} onRecipeUpdated={mockOnRecipeUpdated} />
    );

    const reImportButton = screen.getByTestId('recipe-detail-reimport-button');
    await user.click(reImportButton);

    await waitFor(() => {
      expect(mockReImportRecipe).toHaveBeenCalledWith('test-recipe-id', 'https://example.com/recipe');
    });

    await waitFor(() => {
      expect(screen.getByTestId('recipe-detail-reimport-success-snackbar')).toBeInTheDocument();
    });

    expect(mockOnRecipeUpdated).toHaveBeenCalledWith(mockRecipe);
  });

  it('should handle re-import error', async () => {
    const { reImportRecipe } = await import('@services/recipeImport');
    const mockReImportRecipe = vi.mocked(reImportRecipe);
    mockReImportRecipe.mockRejectedValue(new Error('Failed to re-import'));

    const user = userEvent.setup();

    renderWithProviders(<RecipeDetail recipe={mockRecipe} />);

    const reImportButton = screen.getByTestId('recipe-detail-reimport-button');
    await user.click(reImportButton);

    await waitFor(() => {
      expect(mockReImportRecipe).toHaveBeenCalledWith('test-recipe-id', 'https://example.com/recipe');
    });

    await waitFor(() => {
      expect(screen.getByTestId('recipe-detail-reimport-error-snackbar')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to re-import')).toBeInTheDocument();
  });
});
