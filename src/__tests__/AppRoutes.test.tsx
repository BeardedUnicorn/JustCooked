import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

const routerState = vi.hoisted(() => ({
  initialEntries: ['/'],
}));

const routeMocks = vi.hoisted(() => ({
  migrateJsonRecipes: vi.fn().mockResolvedValue(0),
}));

vi.mock('@services/recipeStorage', async () => {
  const actual = await vi.importActual<typeof import('@services/recipeStorage')>('@services/recipeStorage');
  return {
    ...actual,
    migrateJsonRecipes: routeMocks.migrateJsonRecipes,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={routerState.initialEntries}>
        {children}
      </actual.MemoryRouter>
    ),
  };
});

vi.mock('@components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-app-layout">{children}</div>
  ),
}));

vi.mock('@pages/Dashboard', () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock('@pages/Cookbook', () => ({
  default: () => <div>Cookbook Page</div>,
}));

vi.mock('@pages/Planner', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    default: () => {
      const location = actual.useLocation();
      return (
        <div data-testid="planner-page">
          Planner Page {location.search}
        </div>
      );
    },
  };
});

vi.mock('@pages/PantryHub', () => ({
  default: () => <div>Pantry Page</div>,
}));

vi.mock('@pages/Settings', () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock('@pages/RecipeView', () => ({
  default: () => <div>Recipe View Page</div>,
}));

vi.mock('@pages/CookingMode', () => ({
  default: () => <div>Cooking Mode Page</div>,
}));

describe('App route handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.initialEntries = ['/'];
  });

  it('redirects retired search URLs to the cookbook', async () => {
    routerState.initialEntries = ['/search'];

    render(<App />);

    expect(await screen.findByText('Cookbook Page')).toBeInTheDocument();
  });

  it('redirects legacy meal plan detail URLs into planner query state', async () => {
    routerState.initialEntries = ['/meal-plans/meal-plan-2'];

    render(<App />);

    expect(await screen.findByTestId('planner-page')).toHaveTextContent(
      'Planner Page ?tab=meal-plans&mealPlanId=meal-plan-2'
    );
  });

  it('redirects legacy shopping list URLs into planner query state', async () => {
    routerState.initialEntries = ['/shopping-lists/shopping-list-7'];

    render(<App />);

    expect(await screen.findByTestId('planner-page')).toHaveTextContent(
      'Planner Page ?tab=shopping-lists&shoppingListId=shopping-list-7'
    );
  });

  it('renders a not found screen for unknown routes', async () => {
    routerState.initialEntries = ['/does-not-exist'];

    render(<App />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
