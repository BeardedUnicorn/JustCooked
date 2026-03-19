import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import Planner from '../Planner';
import darkTheme from '../../theme';
import { MealPlan, ShoppingList } from '@app-types';
import {
  getAllMealPlans,
  saveMealPlan,
  createNewMealPlan,
} from '@services/mealPlanStorage';
import { getAllShoppingLists } from '@services/shoppingListStorage';

const plannerServiceMocks = vi.hoisted(() => ({
  getAllMealPlans: vi.fn(),
  saveMealPlan: vi.fn(),
  createNewMealPlan: vi.fn(),
  getAllShoppingLists: vi.fn(),
}));

vi.mock('@services/mealPlanStorage', async () => {
  const actual = await vi.importActual<typeof import('@services/mealPlanStorage')>('@services/mealPlanStorage');

  return {
    ...actual,
    getAllMealPlans: plannerServiceMocks.getAllMealPlans,
    saveMealPlan: plannerServiceMocks.saveMealPlan,
    createNewMealPlan: plannerServiceMocks.createNewMealPlan,
  };
});

vi.mock('@services/shoppingListStorage', async () => {
  const actual = await vi.importActual<typeof import('@services/shoppingListStorage')>('@services/shoppingListStorage');

  return {
    ...actual,
    getAllShoppingLists: plannerServiceMocks.getAllShoppingLists,
  };
});

vi.mock('@pages/MealPlanView', () => ({
  default: ({
    mealPlanId,
    onEditPlan,
  }: {
    mealPlanId?: string;
    onEditPlan?: (mealPlan: MealPlan) => void;
  }) => (
    <div>
      <div data-testid="mock-meal-plan-view">{mealPlanId ?? 'missing'}</div>
      {onEditPlan ? (
        <button
          data-testid="mock-edit-plan-button"
          onClick={() => onEditPlan({
            id: mealPlanId || 'meal-plan-1',
            name: 'Weekly Plan',
            description: 'Current week meals',
            startDate: '2024-01-15',
            endDate: '2024-01-21',
            settings: {
              enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
              defaultServings: 4,
            },
            dateCreated: '2024-01-10T12:00:00Z',
            dateModified: '2024-01-10T12:00:00Z',
          })}
        >
          Edit selected plan
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@components/ShoppingListView', () => ({
  default: ({ shoppingList }: { shoppingList: ShoppingList }) => (
    <div data-testid="mock-shopping-list-view">{shoppingList.id}</div>
  ),
}));

const mockMealPlans: MealPlan[] = [
  {
    id: 'meal-plan-1',
    name: 'Weekly Plan',
    description: 'Current week meals',
    startDate: '2024-01-15',
    endDate: '2024-01-21',
    settings: {
      enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
      defaultServings: 4,
    },
    dateCreated: '2024-01-10T12:00:00Z',
    dateModified: '2024-01-10T12:00:00Z',
  },
  {
    id: 'meal-plan-2',
    name: 'Next Week Plan',
    description: 'Upcoming meals',
    startDate: '2024-01-22',
    endDate: '2024-01-28',
    settings: {
      enabledMealTypes: ['breakfast', 'dinner'],
      defaultServings: 2,
    },
    dateCreated: '2024-01-11T12:00:00Z',
    dateModified: '2024-01-11T12:00:00Z',
  },
];

const mockShoppingLists: ShoppingList[] = [
  {
    id: 'shopping-list-1',
    mealPlanId: 'meal-plan-1',
    name: 'Week One Groceries',
    dateRangeStart: '2024-01-15',
    dateRangeEnd: '2024-01-21',
    dateCreated: '2024-01-15T12:00:00Z',
    dateModified: '2024-01-15T12:00:00Z',
  },
  {
    id: 'shopping-list-2',
    mealPlanId: 'meal-plan-2',
    name: 'Week Two Groceries',
    dateRangeStart: '2024-01-22',
    dateRangeEnd: '2024-01-28',
    dateCreated: '2024-01-22T12:00:00Z',
    dateModified: '2024-01-22T12:00:00Z',
  },
];

const mockGetAllMealPlans = vi.mocked(getAllMealPlans);
const mockSaveMealPlan = vi.mocked(saveMealPlan);
const mockCreateNewMealPlan = vi.mocked(createNewMealPlan);
const mockGetAllShoppingLists = vi.mocked(getAllShoppingLists);

const renderPlanner = (initialEntry = '/planner') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider theme={darkTheme}>
        <Planner />
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('Planner page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAllMealPlans.mockResolvedValue(mockMealPlans);
    mockGetAllShoppingLists.mockResolvedValue(mockShoppingLists);
    mockSaveMealPlan.mockResolvedValue(undefined);
    mockCreateNewMealPlan.mockImplementation((name, startDate, endDate, description) => ({
      id: 'created-plan-id',
      name,
      description,
      startDate,
      endDate,
      settings: {
        enabledMealTypes: ['breakfast', 'lunch', 'dinner'],
        defaultServings: 4,
      },
      dateCreated: '2024-01-15T12:00:00Z',
      dateModified: '2024-01-15T12:00:00Z',
    }));
  });

  it('uses the mealPlanId query parameter to load the selected meal plan', async () => {
    renderPlanner('/planner?tab=meal-plans&mealPlanId=meal-plan-2');

    expect(await screen.findByTestId('mock-meal-plan-view')).toHaveTextContent('meal-plan-2');
  });

  it('uses the shoppingListId query parameter to show the selected shopping list', async () => {
    renderPlanner('/planner?tab=shopping-lists&shoppingListId=shopping-list-2');

    expect(await screen.findByTestId('mock-shopping-list-view')).toHaveTextContent('shopping-list-2');
  });

  it('opens a create meal plan dialog from the empty state and saves the new plan', async () => {
    const user = userEvent.setup();
    mockGetAllMealPlans.mockResolvedValue([]);

    renderPlanner('/planner?tab=meal-plans');

    await screen.findByText('No meal plans yet');
    await user.click(screen.getByTestId('plannerPage-mealPlan-button-createFirst'));

    const nameInput = await screen.findByTestId('meal-plan-form-name');
    const startDateInput = screen.getByTestId('meal-plan-form-start-date');
    const endDateInput = screen.getByTestId('meal-plan-form-end-date');
    const defaultServingsInput = screen.getByTestId('meal-plan-form-default-servings');

    await user.type(nameInput.querySelector('input')!, 'Weekend Plan');
    fireEvent.change(startDateInput.querySelector('input')!, { target: { value: '2024-02-01' } });
    fireEvent.change(endDateInput.querySelector('input')!, { target: { value: '2024-02-03' } });
    await user.clear(defaultServingsInput.querySelector('input')!);
    await user.type(defaultServingsInput.querySelector('input')!, '6');
    await user.click(screen.getByTestId('meal-plan-form-save'));

    await waitFor(() => {
      expect(mockSaveMealPlan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Weekend Plan',
        startDate: '2024-02-01',
        endDate: '2024-02-03',
        settings: expect.objectContaining({
          defaultServings: 6,
        }),
      }));
    });
  });

  it('opens the edit meal plan dialog from the selected meal plan view', async () => {
    const user = userEvent.setup();

    renderPlanner('/planner?tab=meal-plans&mealPlanId=meal-plan-1');

    const editButton = await screen.findByTestId('mock-edit-plan-button');
    await user.click(editButton);

    expect(await screen.findByDisplayValue('Weekly Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Current week meals')).toBeInTheDocument();
  });
});
