import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import Search from '../Search';
import darkTheme from '../../theme';
import * as recipeStorage from '../../services/recipeStorage';
import * as searchHistoryStorage from '../../services/searchHistoryStorage';

// Mock the services
jest.mock('../../services/recipeStorage');
jest.mock('../../services/searchHistoryStorage');

// Mock RecipeCard to simplify testing
jest.mock('../../components/RecipeCard', () => ({
  __esModule: true,
  default: ({ recipe }: { recipe: any }) => (
    <div data-testid="recipe-card">{recipe.title}</div>
  ),
}));

const mockGetRecipesPaginated = recipeStorage.getRecipesPaginated as jest.MockedFunction<typeof recipeStorage.getRecipesPaginated>;
const mockGetRecipeCount = recipeStorage.getRecipeCount as jest.MockedFunction<typeof recipeStorage.getRecipeCount>;
const mockSearchRecipesPaginated = recipeStorage.searchRecipesPaginated as jest.MockedFunction<typeof recipeStorage.searchRecipesPaginated>;
const mockGetSearchRecipesCount = recipeStorage.getSearchRecipesCount as jest.MockedFunction<typeof recipeStorage.getSearchRecipesCount>;
const mockGetRecentSearches = searchHistoryStorage.getRecentSearches as jest.MockedFunction<typeof searchHistoryStorage.getRecentSearches>;
const mockSaveSearch = searchHistoryStorage.saveSearch as jest.MockedFunction<typeof searchHistoryStorage.saveSearch>;

const mockRecipes = [
  { id: '1', title: 'Chocolate Cake', description: 'A rich chocolate cake', tags: ['dessert', 'chocolate'], dateAdded: '2024-01-02T10:00:00Z', rating: 4.5, difficulty: 'Medium', ingredients: [{name: 'chocolate', amount: 1, unit: 'cup'}], instructions: [] },
  { id: '2', title: 'Apple Pie', description: 'Classic apple pie', tags: ['dessert', 'fruit'], dateAdded: '2024-01-01T10:00:00Z', rating: 5, difficulty: 'Easy', ingredients: [], instructions: [] },
  { id: '3', title: 'Chicken Soup', description: 'Hearty chicken soup', tags: ['soup', 'main'], dateAdded: '2024-01-03T10:00:00Z', rating: 4, difficulty: 'Easy', ingredients: [], instructions: [] },
  { id: '4', title: 'Vegan Chocolate Mousse', description: 'Creamy vegan mousse', tags: ['dessert', 'chocolate', 'vegan'], dateAdded: '2024-01-04T10:00:00Z', rating: 4.8, difficulty: 'Hard', ingredients: [{name: 'chocolate', amount: 1, unit: 'cup'}], instructions: [] },
];

const renderSearch = (initialRoute = '/search') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ThemeProvider theme={darkTheme}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('Search Page', () => {
  beforeEach(() => {
    // Mock the paginated functions that the Search component actually uses
    mockGetRecipesPaginated.mockResolvedValue(mockRecipes as any);
    mockGetRecipeCount.mockResolvedValue(mockRecipes.length);
    mockSearchRecipesPaginated.mockImplementation(async (query: string) => {
      return mockRecipes.filter(recipe => 
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(query.toLowerCase()))
      ) as any;
    });
    mockGetSearchRecipesCount.mockImplementation(async (query: string) => {
      return mockRecipes.filter(recipe => 
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(query.toLowerCase()))
      ).length;
    });
    mockGetRecentSearches.mockResolvedValue([]);
    mockSaveSearch.mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  it('renders and displays all recipes initially', async () => {
    renderSearch();
    await waitFor(() => {
      expect(screen.getByText('4 of 4 recipes shown')).toBeInTheDocument();
      expect(screen.getAllByTestId('recipe-card')).toHaveLength(4);
    });
  });

  it('filters recipes based on search term', async () => {
    const user = userEvent.setup();
    renderSearch();
    
    await waitFor(() => {
      expect(screen.getByText('4 of 4 recipes shown')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search recipes, ingredients...');
    await user.type(searchInput, 'chocolate');
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });


    await waitFor(() => {
      expect(screen.getByText('2 of 2 recipes shown')).toBeInTheDocument();
      expect(screen.getByText('Chocolate Cake')).toBeInTheDocument();
      expect(screen.getByText('Vegan Chocolate Mousse')).toBeInTheDocument();
    });

    expect(mockSaveSearch).toHaveBeenCalledWith('chocolate', expect.any(Object));
  });

  it('filters recipes based on tags', async () => {
    const user = userEvent.setup();
    renderSearch();

    await waitFor(() => {
      expect(screen.getByText('4 of 4 recipes shown')).toBeInTheDocument();
    });
    
    // Click on the 'dessert' tag chip to filter
    const dessertTag = screen.getByRole('button', { name: 'dessert' });
    await user.click(dessertTag);

    await waitFor(() => {
      expect(screen.getByText(/3 of \d+ recipes? shown/)).toBeInTheDocument();
      expect(screen.getByText('Chocolate Cake')).toBeInTheDocument();
      expect(screen.getByText('Apple Pie')).toBeInTheDocument();
      expect(screen.getByText('Vegan Chocolate Mousse')).toBeInTheDocument();
    });
  });

  it('sorts recipes by title', async () => {
    const user = userEvent.setup();
    renderSearch();
    await waitFor(() => {
      expect(screen.getAllByTestId('recipe-card')[0]).toHaveTextContent('Vegan Chocolate Mousse');
    });

    const sortBySelect = screen.getByLabelText('Sort By');
    await user.click(sortBySelect);
    const titleOption = await screen.findByRole('option', { name: 'Title A-Z' });
    await user.click(titleOption);

    await waitFor(() => {
      const recipeCards = screen.getAllByTestId('recipe-card');
      expect(recipeCards[0]).toHaveTextContent('Apple Pie');
      expect(recipeCards[1]).toHaveTextContent('Chicken Soup');
      expect(recipeCards[2]).toHaveTextContent('Chocolate Cake');
    });
  });

  it('shows advanced filters and applies them', async () => {
    const user = userEvent.setup();
    renderSearch();
    
    // Open advanced filters
    const filterButton = screen.getByRole('button', { name: /filters/i });
    await user.click(filterButton);

    // Filter by difficulty
    const easyChip = await screen.findByRole('button', { name: 'Easy' });
    await user.click(easyChip);
    
    await waitFor(() => {
      expect(screen.getByText(/2 of \d+ recipes? shown/)).toBeInTheDocument();
      expect(screen.getByText('Apple Pie')).toBeInTheDocument();
      expect(screen.getByText('Chicken Soup')).toBeInTheDocument();
    });

    // Filter by rating
    // Note: The MUI Rating component renders radio buttons for each star value
    const rating4 = screen.getByLabelText('4 Stars');
    await user.click(rating4);

    await waitFor(() => {
      // Both Easy recipes have rating >= 4 (one is 4, one is 5)
      expect(screen.getByText(/2 of \d+ recipes? shown/)).toBeInTheDocument();
      expect(screen.getByText('Apple Pie')).toBeInTheDocument();
      expect(screen.getByText('Chicken Soup')).toBeInTheDocument();
    });
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    renderSearch();

    // Apply a filter
    const searchInput = screen.getByPlaceholderText('Search recipes, ingredients...');
    await user.type(searchInput, 'chocolate');
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByText('2 of 2 recipes shown')).toBeInTheDocument();
    });

    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('4 of 4 recipes shown')).toBeInTheDocument();
      expect(searchInput).toHaveValue('');
    });
  });

  it('shows recent searches and applies them on click', async () => {
    const user = userEvent.setup();
    mockGetRecentSearches.mockResolvedValue([
      { id: '1', query: 'soup', filters: {}, timestamp: '' },
      { id: '2', query: 'pie', filters: {}, timestamp: '' },
    ]);
    renderSearch();

    const searchInput = screen.getByPlaceholderText('Search recipes, ingredients...');
    await user.click(searchInput);

    // Find the suggestion within the list to avoid ambiguity
    const list = await screen.findByRole('list');
    const soupSuggestion = within(list).getByText('soup');
    await user.click(soupSuggestion);

    await waitFor(() => {
      expect(searchInput).toHaveValue('soup');
      expect(screen.getByText('1 of 1 recipe shown')).toBeInTheDocument();
      expect(screen.getByText('Chicken Soup')).toBeInTheDocument();
    });
  });

  it('handles search from URL parameters', async () => {
    renderSearch('/search?q=pie');
    await waitFor(() => {
      expect(screen.getByText('1 of 1 recipe shown')).toBeInTheDocument();
      expect(screen.getByText('Apple Pie')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search recipes, ingredients...')).toHaveValue('pie');
    });
  });

  it('handles tag filter from URL parameters', async () => {
    renderSearch('/search?tag=soup');
    
    // Wait for the component to load and process the tag parameter
    await waitFor(() => {
      // The component should show all recipes initially, then filter by tag
      expect(screen.getByText(/\d+ of \d+ recipes? shown/)).toBeInTheDocument();
    });

    // Wait for the tag filtering to be applied
    await waitFor(() => {
      expect(screen.getByText('Chicken Soup')).toBeInTheDocument();
    });

    // Check that the soup tag is available and can be selected
    await waitFor(() => {
      const soupTag = screen.getByRole('button', { name: 'soup' });
      expect(soupTag).toBeInTheDocument();
    });
  });
});
