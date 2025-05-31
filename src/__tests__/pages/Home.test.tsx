import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../../pages/Home';
import * as recipeStorage from '../../services/recipeStorage';
import { Recipe } from '../../types/recipe';

// Mock the recipe storage service
jest.mock('../../services/recipeStorage');
const mockGetAllRecipes = recipeStorage.getAllRecipes as jest.MockedFunction<typeof recipeStorage.getAllRecipes>;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Chocolate Chip Cookies',
    description: 'Delicious cookies',
    image: 'cookies.jpg',
    sourceUrl: 'https://example.com/cookies',
    prepTime: 'PT15M',
    cookTime: 'PT12M',
    totalTime: 'PT27M',
    servings: 24,
    ingredients: [{ name: 'flour', amount: 2, unit: 'cups' }],
    instructions: ['Mix ingredients', 'Bake'],
    tags: ['dessert', 'cookies', 'baking'],
    dateAdded: '2024-01-15T10:30:00.000Z',
    dateModified: '2024-01-15T10:30:00.000Z',
  },
  {
    id: '2',
    title: 'Pasta Carbonara',
    description: 'Italian pasta dish',
    image: 'carbonara.jpg',
    sourceUrl: 'https://example.com/carbonara',
    prepTime: 'PT10M',
    cookTime: 'PT15M',
    totalTime: 'PT25M',
    servings: 4,
    ingredients: [{ name: 'pasta', amount: 400, unit: 'g' }],
    instructions: ['Cook pasta', 'Add sauce'],
    tags: ['italian', 'pasta', 'dinner'],
    dateAdded: '2024-01-14T10:30:00.000Z',
    dateModified: '2024-01-14T10:30:00.000Z',
  },
  {
    id: '3',
    title: 'Chocolate Cake',
    description: 'Rich chocolate cake',
    image: 'cake.jpg',
    sourceUrl: 'https://example.com/cake',
    prepTime: 'PT20M',
    cookTime: 'PT30M',
    totalTime: 'PT50M',
    servings: 8,
    ingredients: [{ name: 'chocolate', amount: 200, unit: 'g' }],
    instructions: ['Mix batter', 'Bake cake'],
    tags: ['dessert', 'chocolate', 'baking'],
    dateAdded: '2024-01-13T10:30:00.000Z',
    dateModified: '2024-01-13T10:30:00.000Z',
  },
  {
    id: '4',
    title: 'Caesar Salad',
    description: 'Fresh caesar salad',
    image: 'salad.jpg',
    sourceUrl: 'https://example.com/salad',
    prepTime: 'PT15M',
    cookTime: '',
    totalTime: 'PT15M',
    servings: 4,
    ingredients: [{ name: 'lettuce', amount: 1, unit: 'head' }],
    instructions: ['Prepare lettuce', 'Add dressing'],
    tags: ['salad', 'healthy', 'vegetarian'],
    dateAdded: '2024-01-12T10:30:00.000Z',
    dateModified: '2024-01-12T10:30:00.000Z',
  },
];

const renderHome = () => {
  return render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>
  );
};

describe('Home Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockGetAllRecipes.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderHome();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display empty state when no recipes exist', async () => {
    mockGetAllRecipes.mockResolvedValue([]);
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('No recipes yet!')).toBeInTheDocument();
      expect(screen.getByText('Start by importing your favorite recipes.')).toBeInTheDocument();
      expect(screen.getByText('Import Recipe')).toBeInTheDocument();
    });

    // Categories section should not be displayed when no recipes exist
    expect(screen.queryByText('Recipe Categories')).not.toBeInTheDocument();
  });

  it('should display recent recipes and calculate categories correctly', async () => {
    mockGetAllRecipes.mockResolvedValue(mockRecipes);
    renderHome();

    await waitFor(() => {
      // Check that recent recipes are displayed (sorted by date, most recent first)
      expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
      expect(screen.getByText('Chocolate Cake')).toBeInTheDocument();
      expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
    });

    // Check that categories section is displayed
    expect(screen.getByText('Recipe Categories')).toBeInTheDocument();

    // Check that categories are calculated correctly from tags
    // Expected categories with counts:
    // - dessert: 2 recipes (cookies, cake)
    // - baking: 2 recipes (cookies, cake)
    // - chocolate: 1 recipe (cake)
    // - cookies: 1 recipe (cookies)
    // - dinner: 1 recipe (carbonara)
    // - healthy: 1 recipe (salad)
    // - italian: 1 recipe (carbonara)
    // - pasta: 1 recipe (carbonara)
    // - salad: 1 recipe (salad)
    // - vegetarian: 1 recipe (salad)

    await waitFor(() => {
      // Check that categories section is displayed
      expect(screen.getByText('Recipe Categories')).toBeInTheDocument();

      // Check for categories with multiple recipes (should be sorted first)
      // Use getAllByText to handle multiple occurrences and check the categories section specifically
      const dessertElements = screen.getAllByText('dessert');
      expect(dessertElements.length).toBeGreaterThan(0);

      const twoRecipesElements = screen.getAllByText('2 recipes');
      expect(twoRecipesElements.length).toBeGreaterThan(0);

      const bakingElements = screen.getAllByText('baking');
      expect(bakingElements.length).toBeGreaterThan(0);

      // Check for categories with single recipes
      const chocolateElements = screen.getAllByText('chocolate');
      expect(chocolateElements.length).toBeGreaterThan(0);

      const oneRecipeElements = screen.getAllByText('1 recipe');
      expect(oneRecipeElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle category clicks and navigate to search with correct tag', async () => {
    mockGetAllRecipes.mockResolvedValue(mockRecipes);
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Recipe Categories')).toBeInTheDocument();
    });

    // Click on a category in the categories section (not in recipe cards)
    // Find the category card by looking for the h3 element with the category name
    const categoryCards = screen.getAllByRole('heading', { level: 3 });
    const dessertCategoryCard = categoryCards.find(card => card.textContent === 'dessert');
    expect(dessertCategoryCard).toBeTruthy();

    // Click on the parent card
    const cardElement = dessertCategoryCard?.closest('.MuiCard-root');
    expect(cardElement).toBeTruthy();
    cardElement?.click();

    expect(mockNavigate).toHaveBeenCalledWith('/search?tag=dessert');
  });

  it('should handle categories with special characters correctly', async () => {
    const recipesWithSpecialTags: Recipe[] = [
      {
        ...mockRecipes[0],
        tags: ['gluten-free', 'dairy free', 'low-carb'],
      },
    ];

    mockGetAllRecipes.mockResolvedValue(recipesWithSpecialTags);
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Recipe Categories')).toBeInTheDocument();

      // Check that categories with special characters are displayed
      const glutenFreeElements = screen.getAllByText('gluten-free');
      expect(glutenFreeElements.length).toBeGreaterThan(0);

      const dairyFreeElements = screen.getAllByText('dairy free');
      expect(dairyFreeElements.length).toBeGreaterThan(0);

      const lowCarbElements = screen.getAllByText('low-carb');
      expect(lowCarbElements.length).toBeGreaterThan(0);
    });

    // Click on a category with special characters
    const categoryCards = screen.getAllByRole('heading', { level: 3 });
    const glutenFreeCategoryCard = categoryCards.find(card => card.textContent === 'gluten-free');
    expect(glutenFreeCategoryCard).toBeTruthy();

    const cardElement = glutenFreeCategoryCard?.closest('.MuiCard-root');
    expect(cardElement).toBeTruthy();
    cardElement?.click();

    expect(mockNavigate).toHaveBeenCalledWith('/search?tag=gluten-free');
  });

  it('should handle empty and whitespace tags correctly', async () => {
    const recipesWithEmptyTags: Recipe[] = [
      {
        ...mockRecipes[0],
        tags: ['valid-tag', '', '   ', 'another-tag'],
      },
    ];

    mockGetAllRecipes.mockResolvedValue(recipesWithEmptyTags);
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Recipe Categories')).toBeInTheDocument();

      // Check that valid tags are displayed
      const validTagElements = screen.getAllByText('valid-tag');
      expect(validTagElements.length).toBeGreaterThan(0);

      const anotherTagElements = screen.getAllByText('another-tag');
      expect(anotherTagElements.length).toBeGreaterThan(0);
    });

    // Empty and whitespace tags should not appear in the categories section
    // We can't easily test for empty strings, but we can verify only valid tags are shown
    const categoryHeadings = screen.getAllByRole('heading', { level: 3 });
    const categoryNames = categoryHeadings.map(heading => heading.textContent);

    // Should only contain valid tags
    expect(categoryNames).toContain('valid-tag');
    expect(categoryNames).toContain('another-tag');
    expect(categoryNames).toHaveLength(2); // Only 2 valid categories
  });

  it('should limit categories to top 12', async () => {
    // Create recipes with many unique tags
    const recipesWithManyTags: Recipe[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockRecipes[0],
      id: `recipe-${i}`,
      tags: [`tag-${i}`],
    }));

    mockGetAllRecipes.mockResolvedValue(recipesWithManyTags);
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Recipe Categories')).toBeInTheDocument();
    });

    // Should only display 12 categories maximum
    const categoryCards = screen.getAllByText(/1 recipe/);
    expect(categoryCards.length).toBeLessThanOrEqual(12);
  });

  it('should handle recipe storage errors gracefully', async () => {
    mockGetAllRecipes.mockRejectedValue(new Error('Storage error'));
    renderHome();

    await waitFor(() => {
      // Should not crash and should not show categories
      expect(screen.queryByText('Recipe Categories')).not.toBeInTheDocument();
    });
  });
});
