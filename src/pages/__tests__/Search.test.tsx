import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Search from '../Search';
import * as recipeStorage from '@services/recipeStorage';
import * as searchHistoryStorage from '@services/searchHistoryStorage';

// Mock the services
jest.mock('@services/recipeStorage');
jest.mock('@services/searchHistoryStorage');

const mockGetAllRecipes = recipeStorage.getAllRecipes as jest.MockedFunction<typeof recipeStorage.getAllRecipes>;
const mockGetRecentSearches = searchHistoryStorage.getRecentSearches as jest.MockedFunction<typeof searchHistoryStorage.getRecentSearches>;

const renderSearch = () => {
  return render(
    <BrowserRouter>
      <Search />
    </BrowserRouter>
  );
};

describe('Search Page', () => {
  beforeEach(() => {
    mockGetAllRecipes.mockResolvedValue([]);
    mockGetRecentSearches.mockReturnValue([]);
  });

  it('renders without crashing', () => {
    renderSearch();
    expect(screen.getByLabelText(/Sort By/i)).toBeInTheDocument();
  });
});
