import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { getPantryItems, getExpiringItems } from '@services/pantryStorage';

const cookbookServiceMocks = vi.hoisted(() => ({
  getRecipesPaginated: vi.fn(),
  getRecipeCount: vi.fn(),
  searchRecipesPaginated: vi.fn(),
  getSearchRecipesCount: vi.fn(),
  getAllRecipes: vi.fn(),
  getPantryItems: vi.fn(),
  getExpiringItems: vi.fn(),
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
    getExpiringItems: cookbookServiceMocks.getExpiringItems,
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
const mockGetExpiringItems = vi.mocked(getExpiringItems);

type IngredientSpec = string | { name: string; amount: number; unit: string };

function createRecipe(
  id: string,
  title: string,
  ingredients: IngredientSpec[] = ['pasta'],
): Recipe {
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
    ingredients: ingredients.map((spec) =>
      typeof spec === 'string' ? { name: spec, amount: 1, unit: 'unit' } : spec,
    ),
    instructions: ['Cook'],
    tags: ['dinner'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  };
}

function createPantryItem(
  id: string,
  name: string,
  expiryDate?: string,
  amount: number = 1,
  unit: string = 'unit',
): PantryItem {
  return {
    id,
    name,
    amount,
    unit,
    expiryDate,
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
    mockGetExpiringItems.mockResolvedValue([]);
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

  describe('Use It Up tab', () => {
    it('renders the Use It Up tab alongside the other tabs', async () => {
      mockGetAllRecipes.mockResolvedValue([]);

      renderCookbook();

      expect(await screen.findByTestId('cookbook-tab-use-it-up')).toHaveTextContent('Use It Up');
    });

    it('shows an empty state when there are no expiring pantry items', async () => {
      const user = userEvent.setup();
      mockGetAllRecipes.mockResolvedValue([createRecipe('r1', 'Soup', ['carrot'])]);
      mockGetExpiringItems.mockResolvedValue([]);

      renderCookbook();
      await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

      const emptyState = await screen.findByTestId('cookbookPage-useItUp-text-noExpiring');
      expect(emptyState).toHaveTextContent(/no expiring pantry items/i);
      expect(mockGetExpiringItems).toHaveBeenCalledWith(7);
    });

    it('shows an empty state when expiring items exist but no recipes use them', async () => {
      const user = userEvent.setup();
      mockGetAllRecipes.mockResolvedValue([createRecipe('r1', 'Soup', ['carrot'])]);
      mockGetExpiringItems.mockResolvedValue([
        createPantryItem('p1', 'milk', '2024-01-02'),
      ]);

      renderCookbook();
      await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

      const emptyState = await screen.findByTestId('cookbookPage-useItUp-text-noMatches');
      expect(emptyState).toHaveTextContent(/no recipes/i);
    });

    it('ranks recipes by expiring-count desc, then missing asc, then soonest expiry, then title', async () => {
      const user = userEvent.setup();

      mockGetExpiringItems.mockResolvedValue([
        createPantryItem('p1', 'milk', '2024-01-02'),
        createPantryItem('p2', 'eggs', '2024-01-05'),
        createPantryItem('p3', 'spinach', '2024-01-03'),
      ]);

      mockGetAllRecipes.mockResolvedValue([
        // 1 expiring (milk), 0 missing → third tier, but 1 expiring → comes after 2-expiring ones
        createRecipe('a', 'Zebra Latte', ['milk']),
        // 2 expiring (milk+eggs), 1 missing (flour)
        createRecipe('b', 'Pancakes', ['milk', 'eggs', 'flour']),
        // 2 expiring (milk+eggs), 0 missing → ties with Pancakes on expiring, wins on fewer missing
        createRecipe('c', 'Omelette', ['milk', 'eggs']),
        // 2 expiring (eggs+spinach), 0 missing → ties with Omelette on expiring+missing;
        // soonest match is spinach (01-03) vs Omelette milk (01-02) → Omelette wins
        createRecipe('d', 'Frittata', ['eggs', 'spinach']),
        // 1 expiring (milk), 0 missing → ties Zebra Latte on expiring+missing+soonest; wins alphabetically
        createRecipe('e', 'Alpha Latte', ['milk']),
        // 0 expiring → excluded
        createRecipe('f', 'Dry Toast', ['bread']),
      ]);

      renderCookbook();
      await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

      const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
      const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
      const order = cards.map((el) => el.textContent);

      expect(order).toEqual([
        'Omelette',
        'Frittata',
        'Pancakes',
        'Alpha Latte',
        'Zebra Latte',
      ]);
    });

    it('shows a summary of expiring and missing ingredients under each result', async () => {
      const user = userEvent.setup();

      mockGetExpiringItems.mockResolvedValue([
        createPantryItem('p1', 'milk', '2024-01-02'),
        createPantryItem('p2', 'eggs', '2024-01-05'),
      ]);
      mockGetAllRecipes.mockResolvedValue([
        createRecipe('b', 'Pancakes', ['milk', 'eggs', 'flour']),
        createRecipe('c', 'Warm Milk', ['milk']),
      ]);

      renderCookbook();
      await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

      const pancakes = await screen.findByTestId('cookbookPage-useItUp-result-b');
      expect(pancakes).toHaveTextContent('Uses 2 expiring items');
      expect(pancakes).toHaveTextContent('1 ingredient missing');

      const warmMilk = screen.getByTestId('cookbookPage-useItUp-result-c');
      expect(warmMilk).toHaveTextContent('Uses 1 expiring item');
      expect(warmMilk).toHaveTextContent('0 ingredients missing');
    });

    it('refreshes results every time the tab is opened', async () => {
      const user = userEvent.setup();

      mockGetExpiringItems
        .mockResolvedValueOnce([createPantryItem('p1', 'milk', '2024-01-02')])
        .mockResolvedValueOnce([createPantryItem('p2', 'eggs', '2024-01-03')]);
      mockGetAllRecipes
        .mockResolvedValueOnce([createRecipe('r1', 'Milk Recipe', ['milk'])])
        .mockResolvedValueOnce([createRecipe('r2', 'Egg Recipe', ['eggs'])]);

      renderCookbook();

      await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));
      expect(await screen.findByText('Milk Recipe')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockGetExpiringItems).toHaveBeenCalledTimes(1);
        expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByTestId('cookbook-tab-all-recipes'));
      await user.click(screen.getByTestId('cookbook-tab-use-it-up'));

      expect(await screen.findByText('Egg Recipe')).toBeInTheDocument();
      expect(screen.queryByText('Milk Recipe')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(mockGetExpiringItems).toHaveBeenCalledTimes(2);
        expect(mockGetAllRecipes).toHaveBeenCalledTimes(2);
      });
    });

    describe('quantity-aware ranking', () => {
      it('ranks a recipe consuming a larger share of an expiring item above an incidental reference', async () => {
        const user = userEvent.setup();

        // 4 cups of spinach expiring
        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'spinach', '2024-01-02', 4, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // Uses 0.25 cup (6% of pantry) — incidental
          createRecipe('garnish', 'Garnish Plate', [
            { name: 'spinach', amount: 0.25, unit: 'cup' },
          ]),
          // Uses 3 cups (75% of pantry) — meaningful
          createRecipe('saute', 'Spinach Sauté', [
            { name: 'spinach', amount: 3, unit: 'cups' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
        expect(cards.map((el) => el.textContent)).toEqual([
          'Spinach Sauté',
          'Garnish Plate',
        ]);
      });

      it('treats incompatible or missing units conservatively without penalizing the expiring-count match', async () => {
        const user = userEvent.setup();

        // Pantry measures spinach in cups
        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'spinach', '2024-01-02', 4, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // Different dimension (weight) — cannot compare, no consumption score.
          // Still beats Tiny Garnish because consumption-share is a tie-break
          // ONLY when both have a comparable share, and falls through to title.
          createRecipe('grams', 'Grams Of Spinach', [
            { name: 'spinach', amount: 500, unit: 'g' },
          ]),
          // Comparable and meaningful (≥50%) — ranks first
          createRecipe('big', 'Big Sauté', [
            { name: 'spinach', amount: 2, unit: 'cup' },
          ]),
          // Comparable but tiny share — ranks below incomparable one,
          // because we do not punish an incomparable match relative to a weak one
          createRecipe('tiny', 'Tiny Garnish', [
            { name: 'spinach', amount: 0.1, unit: 'cup' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
        expect(cards.map((el) => el.textContent)).toEqual([
          'Big Sauté',
          'Grams Of Spinach',
          'Tiny Garnish',
        ]);
      });

      it('surfaces a high-confidence consumption explanation in the result summary', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02', 2, 'cup'),
          createPantryItem('p2', 'spinach', '2024-01-03', 3, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // 1.5 / 2 = 75% of milk → "Consumes 75% of expiring milk"
          createRecipe('a', 'Creamy Thing', [
            { name: 'milk', amount: 1.5, unit: 'cups' },
          ]),
          // 3 / 3 = 100% of spinach → "Uses most of your spinach"
          createRecipe('b', 'Spinach Blowout', [
            { name: 'spinach', amount: 3, unit: 'cup' },
          ]),
          // 0.25 / 2 = 12.5% → below threshold → no explanation line
          createRecipe('c', 'Splash Of Milk', [
            { name: 'milk', amount: 0.25, unit: 'cup' },
          ]),
          // Incompatible unit → no explanation line
          createRecipe('d', 'Heavy Milk', [
            { name: 'milk', amount: 500, unit: 'g' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        await screen.findByTestId('cookbookPage-useItUp-grid-recipes');

        const creamy = screen.getByTestId('cookbookPage-useItUp-result-a');
        expect(
          within(creamy).getByTestId('cookbookPage-useItUp-explanation-a'),
        ).toHaveTextContent(/consumes 75% of expiring milk/i);

        const blowout = screen.getByTestId('cookbookPage-useItUp-result-b');
        expect(
          within(blowout).getByTestId('cookbookPage-useItUp-explanation-b'),
        ).toHaveTextContent(/uses most of your spinach/i);

        const splash = screen.getByTestId('cookbookPage-useItUp-result-c');
        expect(
          within(splash).queryByTestId('cookbookPage-useItUp-explanation-c'),
        ).toBeNull();

        const heavy = screen.getByTestId('cookbookPage-useItUp-result-d');
        expect(
          within(heavy).queryByTestId('cookbookPage-useItUp-explanation-d'),
        ).toBeNull();
      });

      it('applies the consumption signal as a tie-break within the same expiring-count tier', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02', 2, 'cup'),
          createPantryItem('p2', 'eggs', '2024-01-03', 6, 'piece'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // 2 expiring (milk+eggs), weak consumption (0.1 cup, 1 egg ≈ 22%) ≈ 0.22 total
          createRecipe('weak', 'Weak Two', [
            { name: 'milk', amount: 0.1, unit: 'cup' },
            { name: 'eggs', amount: 1, unit: 'piece' },
          ]),
          // 2 expiring (milk+eggs), strong consumption (2 cup = 100%, 4 eggs ≈ 67%) ≈ 1.67 total
          createRecipe('strong', 'Strong Two', [
            { name: 'milk', amount: 2, unit: 'cup' },
            { name: 'eggs', amount: 4, unit: 'piece' },
          ]),
          // 1 expiring only — must rank below both 2-expiring recipes
          // regardless of its own consumption score
          createRecipe('one', 'One Strong', [
            { name: 'milk', amount: 2, unit: 'cup' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
        expect(cards.map((el) => el.textContent)).toEqual([
          'Strong Two',
          'Weak Two',
          'One Strong',
        ]);
      });
    });

    describe('urgency-aware ranking', () => {
      const daysFromNow = (n: number) =>
        new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

      it('ranks an item expiring tomorrow above one expiring in six days even at lower consumption', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'yogurt', daysFromNow(1), 2, 'cup'),
          createPantryItem('p2', 'cheese', daysFromNow(6), 1, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // 100% of cheese, but expires in 6 days
          createRecipe('cheese', 'Full Cheese', [
            { name: 'cheese', amount: 1, unit: 'cup' },
          ]),
          // 50% of yogurt, but expires tomorrow — should win on urgency
          createRecipe('yogurt', 'Some Yogurt', [
            { name: 'yogurt', amount: 1, unit: 'cup' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
        expect(cards.map((el) => el.textContent)).toEqual([
          'Some Yogurt',
          'Full Cheese',
        ]);
      });

      it('does not let urgency override the expiring-count tier', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', daysFromNow(1), 1, 'cup'),
          createPantryItem('p2', 'butter', daysFromNow(5), 1, 'cup'),
          createPantryItem('p3', 'cream', daysFromNow(5), 1, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          // 1 expiring, very urgent (milk, tomorrow, 100%)
          createRecipe('urgent-one', 'Urgent Milk', [
            { name: 'milk', amount: 1, unit: 'cup' },
          ]),
          // 2 expiring, less urgent (butter+cream, day 5, both 100%)
          createRecipe('two-later', 'Butter Cream', [
            { name: 'butter', amount: 1, unit: 'cup' },
            { name: 'cream', amount: 1, unit: 'cup' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        const grid = await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        const cards = within(grid).getAllByTestId(/^mock-recipe-card-/);
        expect(cards.map((el) => el.textContent)).toEqual([
          'Butter Cream',
          'Urgent Milk',
        ]);
      });

      it('shows an urgency hint when a matched item expires within a day', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'yogurt', daysFromNow(0.5), 1, 'cup'),
          createPantryItem('p2', 'cheese', daysFromNow(5), 1, 'cup'),
        ]);

        mockGetAllRecipes.mockResolvedValue([
          createRecipe('a', 'Yogurt Bowl', [
            { name: 'yogurt', amount: 1, unit: 'cup' },
          ]),
          createRecipe('b', 'Cheese Toast', [
            { name: 'cheese', amount: 1, unit: 'cup' },
          ]),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        await screen.findByTestId('cookbookPage-useItUp-grid-recipes');

        const yogurt = screen.getByTestId('cookbookPage-useItUp-result-a');
        expect(
          within(yogurt).getByTestId('cookbookPage-useItUp-urgency-a'),
        ).toHaveTextContent(/expiring tomorrow/i);

        const cheese = screen.getByTestId('cookbookPage-useItUp-result-b');
        expect(
          within(cheese).queryByTestId('cookbookPage-useItUp-urgency-b'),
        ).toBeNull();
      });
    });

    describe('exclusions', () => {
      it('excluding an ingredient stops promoting recipes that only match via that ingredient', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02'),
          createPantryItem('p2', 'eggs', '2024-01-03'),
        ]);
        mockGetAllRecipes.mockResolvedValue([
          createRecipe('m', 'Milk Only', ['milk']),
          createRecipe('e', 'Egg Only', ['eggs']),
          createRecipe('me', 'Milk And Eggs', ['milk', 'eggs']),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        await screen.findByTestId('cookbookPage-useItUp-grid-recipes');
        expect(screen.getByTestId('mock-recipe-card-m')).toBeInTheDocument();

        // Exclude "milk" from the expiring-ingredient chips
        await user.click(
          screen.getByTestId('cookbookPage-useItUp-excludeIngredient-milk'),
        );

        // Milk-only recipe no longer matches any expiring item → removed
        await waitFor(() => {
          expect(screen.queryByTestId('mock-recipe-card-m')).not.toBeInTheDocument();
        });
        // Recipes that still match via eggs remain
        expect(screen.getByTestId('mock-recipe-card-e')).toBeInTheDocument();
        expect(screen.getByTestId('mock-recipe-card-me')).toBeInTheDocument();

        // Excluded ingredient surfaced in a review strip
        expect(
          screen.getByTestId('cookbookPage-useItUp-excludedIngredient-milk'),
        ).toHaveTextContent(/milk/i);
      });

      it('excluding a recipe removes it from results and surfaces it for review', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02'),
        ]);
        mockGetAllRecipes.mockResolvedValue([
          createRecipe('keep', 'Keeper', ['milk']),
          createRecipe('hide', 'Disliked', ['milk']),
        ]);

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        await screen.findByTestId('mock-recipe-card-hide');

        await user.click(
          screen.getByTestId('cookbookPage-useItUp-excludeRecipe-hide'),
        );

        await waitFor(() => {
          expect(screen.queryByTestId('mock-recipe-card-hide')).not.toBeInTheDocument();
        });
        expect(screen.getByTestId('mock-recipe-card-keep')).toBeInTheDocument();

        expect(
          screen.getByTestId('cookbookPage-useItUp-excludedRecipe-hide'),
        ).toHaveTextContent(/disliked/i);
      });

      it('persists exclusions across reopen and restores them on undo', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02'),
        ]);
        mockGetAllRecipes.mockResolvedValue([
          createRecipe('r1', 'Milk Shake', ['milk']),
        ]);

        // Seed persisted exclusions
        window.localStorage.setItem(
          'useItUpExclusions',
          JSON.stringify({ ingredients: ['milk'], recipeIds: [] }),
        );

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        // With milk excluded from the start, Milk Shake has no expiring match
        // and we fall back to the no-expiring empty state (milk was the only one).
        expect(
          await screen.findByTestId('cookbookPage-useItUp-text-noExpiring'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('cookbookPage-useItUp-excludedIngredient-milk'),
        ).toHaveTextContent(/milk/i);

        // Restore the ingredient
        await user.click(
          screen.getByTestId('cookbookPage-useItUp-restoreIngredient-milk'),
        );

        expect(
          await screen.findByTestId('mock-recipe-card-r1'),
        ).toBeInTheDocument();

        // Persisted state updated
        const stored = JSON.parse(
          window.localStorage.getItem('useItUpExclusions') ?? '{}',
        );
        expect(stored.ingredients).toEqual([]);
      });

      it('restores an excluded recipe and removes it from the review strip', async () => {
        const user = userEvent.setup();

        mockGetExpiringItems.mockResolvedValue([
          createPantryItem('p1', 'milk', '2024-01-02'),
        ]);
        mockGetAllRecipes.mockResolvedValue([
          createRecipe('r1', 'Milk Shake', ['milk']),
        ]);

        window.localStorage.setItem(
          'useItUpExclusions',
          JSON.stringify({ ingredients: [], recipeIds: ['r1'] }),
        );

        renderCookbook();
        await user.click(await screen.findByTestId('cookbook-tab-use-it-up'));

        // Recipe excluded → no results, but expiring items exist → noMatches state
        expect(
          await screen.findByTestId('cookbookPage-useItUp-text-noMatches'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('cookbookPage-useItUp-excludedRecipe-r1'),
        ).toHaveTextContent(/milk shake/i);

        await user.click(
          screen.getByTestId('cookbookPage-useItUp-restoreRecipe-r1'),
        );

        expect(
          await screen.findByTestId('mock-recipe-card-r1'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('cookbookPage-useItUp-excludedRecipe-r1'),
        ).not.toBeInTheDocument();

        const stored = JSON.parse(
          window.localStorage.getItem('useItUpExclusions') ?? '{}',
        );
        expect(stored.recipeIds).toEqual([]);
      });
    });
  });
});
