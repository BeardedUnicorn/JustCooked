import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import Cookbook from '../Cookbook';
import darkTheme from '../../theme';
import { Recipe, PantryItem } from '@app-types';
import {
  getRecipesPaginated,
  getRecipeCount,
  searchRecipesPaginated,
  getSearchRecipesCount,
  getAllRecipes,
} from '@services/recipeStorage';
import { getPantryItems } from '@services/pantryStorage';

const cookbookServiceMocks = vi.hoisted(() => ({
  getRecipesPaginated: vi.fn(),
  getRecipeCount: vi.fn(),
  searchRecipesPaginated: vi.fn(),
  getSearchRecipesCount: vi.fn(),
  getAllRecipes: vi.fn(),
  getPantryItems: vi.fn(),
}));

vi.mock('@services/recipeStorage', async () => {
  const actual = await vi.importActual<typeof import('@services/recipeStorage')>('@services/recipeStorage');

  return {
    ...actual,
    getRecipesPaginated: cookbookServiceMocks.getRecipesPaginated,
    getRecipeCount: cookbookServiceMocks.getRecipeCount,
    searchRecipesPaginated: cookbookServiceMocks.searchRecipesPaginated,
    getSearchRecipesCount: cookbookServiceMocks.getSearchRecipesCount,
    getAllRecipes: cookbookServiceMocks.getAllRecipes,
  };
});

vi.mock('@services/pantryStorage', async () => {
  const actual = await vi.importActual<typeof import('@services/pantryStorage')>('@services/pantryStorage');

  return {
    ...actual,
    getPantryItems: cookbookServiceMocks.getPantryItems,
  };
});

vi.mock('@components/SearchBar', () => ({
  default: () => <div data-testid="mock-search-bar" />,
}));

vi.mock('@components/BatchImportDialog', () => ({
  default: () => null,
}));

vi.mock('@components/AdvancedSearchModal', () => ({
  default: () => null,
}));

vi.mock('@components/RecipeCard', () => ({
  default: ({ recipe }: { recipe: Recipe }) => (
    <div data-testid={`mock-recipe-card-${recipe.id}`}>{recipe.title}</div>
  ),
}));

const mockGetRecipesPaginated = vi.mocked(getRecipesPaginated);
const mockGetRecipeCount = vi.mocked(getRecipeCount);
const mockSearchRecipesPaginated = vi.mocked(searchRecipesPaginated);
const mockGetSearchRecipesCount = vi.mocked(getSearchRecipesCount);
const mockGetAllRecipes = vi.mocked(getAllRecipes);
const mockGetPantryItems = vi.mocked(getPantryItems);

function createRecipe(id: string, title: string): Recipe {
  return {
    id,
    title,
    description: '',
    image: '',
    sourceUrl: `https://example.com/${id}`,
    prepTime: '',
    cookTime: '',
    totalTime: '',
    servings: 2,
    ingredients: [
      { name: 'pasta', amount: 1, unit: 'box' },
    ],
    instructions: ['Boil pasta'],
    tags: ['dinner'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  };
}

const pantryItems: PantryItem[] = [
  {
    id: 'pantry-1',
    name: 'pasta',
    amount: 1,
    unit: 'box',
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
];

const renderCookbook = () => render(
  <MemoryRouter initialEntries={['/cookbook']}>
    <ThemeProvider theme={darkTheme}>
      <Cookbook />
    </ThemeProvider>
  </MemoryRouter>
);

describe('Cookbook page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetRecipesPaginated.mockResolvedValue([]);
    mockGetRecipeCount.mockResolvedValue(0);
    mockSearchRecipesPaginated.mockResolvedValue([]);
    mockGetSearchRecipesCount.mockResolvedValue(0);
    mockGetPantryItems.mockResolvedValue(pantryItems);
  });

  it('refreshes Smart Cookbook results when returning to the tab after data changes', async () => {
    const user = userEvent.setup();

    mockGetAllRecipes
      .mockResolvedValueOnce([createRecipe('recipe-1', 'Pantry Pasta')])
      .mockResolvedValueOnce([createRecipe('recipe-2', 'Updated Pantry Pasta')]);

    renderCookbook();

    await screen.findByTestId('cookbook-tab-smart');

    await user.click(screen.getByTestId('cookbook-tab-smart'));

    expect(await screen.findByText('Pantry Pasta')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByTestId('cookbook-tab-all-recipes'));
    await user.click(screen.getByTestId('cookbook-tab-smart'));

    expect(await screen.findByText('Updated Pantry Pasta')).toBeInTheDocument();
    expect(screen.queryByText('Pantry Pasta')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetAllRecipes).toHaveBeenCalledTimes(2);
    });
  });
});
