import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SmartCookbook from '../SmartCookbook';
import * as recipeStorage from '@services/recipeStorage';
import * as pantryStorage from '@services/pantryStorage';
import { mockRecipe } from '../../__tests__/fixtures/recipes';

// Mock the services
jest.mock('@services/recipeStorage');
jest.mock('@services/pantryStorage');

const mockGetAllRecipes = recipeStorage.getAllRecipes as jest.MockedFunction<typeof recipeStorage.getAllRecipes>;
const mockGetPantryItems = pantryStorage.getPantryItems as jest.MockedFunction<typeof pantryStorage.getPantryItems>;

const renderSmartCookbook = () => {
  return render(
    <BrowserRouter>
      <SmartCookbook />
    </BrowserRouter>
  );
};

describe('SmartCookbook Page', () => {
  it('renders without crashing', async () => {
    mockGetAllRecipes.mockResolvedValue([]);
    mockGetPantryItems.mockResolvedValue([]);
    renderSmartCookbook();
    expect(await screen.findByText('Smart Cookbook')).toBeInTheDocument();
  });

  it('shows recipes with matching ingredients and hides those with none', async () => {
    const mockRecipes = [
      {
        ...mockRecipe,
        id: '1',
        title: 'Recipe 1',
        ingredients: [{ name: 'apple', amount: 1, unit: '' }],
      },
      {
        ...mockRecipe,
        id: '2',
        title: 'Recipe 2',
        ingredients: [{ name: 'banana', amount: 1, unit: '' }],
      },
    ];
    const mockPantry = [
      { id: 'p1', name: 'apple', amount: 2, unit: '' } as any,
    ];

    mockGetAllRecipes.mockResolvedValue(mockRecipes);
    mockGetPantryItems.mockResolvedValue(mockPantry);

    renderSmartCookbook();

    expect(await screen.findByText('Recipe 1')).toBeInTheDocument();
    expect(screen.queryByText('Recipe 2')).not.toBeInTheDocument();
  });

  it('sorts recipes by missing ingredients', async () => {
    const mockRecipes = [
      {
        ...mockRecipe,
        id: '1',
        title: 'Recipe 1 - 0 missing',
        ingredients: [{ name: 'apple', amount: 1, unit: '' }],
      },
      {
        ...mockRecipe,
        id: '2',
        title: 'Recipe 2 - 1 missing',
        ingredients: [{ name: 'apple', amount: 1, unit: '' }, { name: 'cherry', amount: 1, unit: '' }],
      },
      {
        ...mockRecipe,
        id: '3',
        title: 'Recipe 3 - 2 missing',
        ingredients: [{ name: 'banana', amount: 1, unit: '' }, { name: 'cherry', amount: 1, unit: '' }],
      },
    ];
    const mockPantry = [
      { id: 'p1', name: 'apple', amount: 2, unit: '' } as any,
    ];

    mockGetAllRecipes.mockResolvedValue(mockRecipes);
    mockGetPantryItems.mockResolvedValue(mockPantry);

    renderSmartCookbook();

    await screen.findByText('Recipe 1 - 0 missing');
    const recipeTitles = screen.getAllByText(/Recipe \d/).map(el => el.textContent);
    expect(recipeTitles[0]).toBe('Recipe 1 - 0 missing');
    expect(recipeTitles[1]).toBe('Recipe 2 - 1 missing');
    expect(recipeTitles.length).toBe(2); // Recipe 3 has no matches
  });
});
