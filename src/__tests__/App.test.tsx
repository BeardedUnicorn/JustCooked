import { render, screen } from '@testing-library/react';
import App from '../App';
import * as recipeStorage from '@services/recipeStorage';

// Mock the recipe storage for Home page
jest.mock('@services/recipeStorage');
const mockGetAllRecipes = recipeStorage.getAllRecipes as jest.MockedFunction<typeof recipeStorage.getAllRecipes>;

describe('App', () => {
  beforeEach(() => {
    mockGetAllRecipes.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    render(<App />);
    // Assuming Home renders something, or check for a common element
    // For example, if there is a header or something
    // From AppLayout, there is 'JustCooked'
    expect(screen.getByText('JustCooked')).toBeInTheDocument();
  });
});
