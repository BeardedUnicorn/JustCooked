import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import { vi } from 'vitest';
import RecipeView from './RecipeView';
import { getRecipeById, deleteRecipe } from '@services/recipeStorage';
import { mockRecipe } from '@/__tests__/fixtures/recipes';

// Mock the recipe storage service
vi.mock('@services/recipeStorage', () => ({
  getRecipeById: vi.fn(),
  deleteRecipe: vi.fn(),
}));

// Mock window.print
Object.defineProperty(window, 'print', {
  value: vi.fn(),
  writable: true,
});

const mockGetRecipeById = vi.mocked(getRecipeById);
const mockDeleteRecipe = vi.mocked(deleteRecipe);
const mockNavigate = fn();

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-recipe-123' }),
    useNavigate: () => mockNavigate,
  };
});

const meta: Meta<typeof RecipeView> = {
  title: 'Pages/RecipeView',
  component: RecipeView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The RecipeView page displays a recipe with actions for cooking, printing, and deletion. It uses the RecipeDetail component for the main recipe display.',
      },
    },
    router: {
      initialEntries: ['/recipe/test-recipe-123'],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecipeView>;

export const DefaultView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default view of a recipe page with all actions available.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockDeleteRecipe.mockResolvedValue();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
    
    // Verify all action buttons are present
    await expect(canvas.getByTestId('recipeViewPage-button-back')).toBeInTheDocument();
    await expect(canvas.getByTestId('recipeViewPage-button-startCooking')).toBeInTheDocument();
    await expect(canvas.getByTestId('recipeViewPage-button-print')).toBeInTheDocument();
    await expect(canvas.getByTestId('recipeViewPage-button-delete')).toBeInTheDocument();
  },
};

export const LoadingState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Loading state while fetching recipe data.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockRecipe), 5000))
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify loading state
    await expect(canvas.getByTestId('recipeViewPage-loading-main')).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Error state when recipe is not found or fails to load.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(null);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for error state to appear
    await expect(canvas.getByTestId('recipeViewPage-error-container')).toBeInTheDocument();
    await expect(canvas.getByTestId('recipeViewPage-alert-error')).toBeInTheDocument();
    await expect(canvas.getByTestId('recipeViewPage-button-goBack')).toBeInTheDocument();
  },
};

export const DeleteConfirmationOpen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe view with the delete confirmation dialog open.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockDeleteRecipe.mockResolvedValue();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Click delete button to open dialog
    const deleteButton = canvas.getByTestId('recipeViewPage-button-delete');
    await userEvent.click(deleteButton);

    // Verify dialog is open
    await expect(canvas.getByTestId('recipeViewPage-dialog-deleteConfirm')).toBeInTheDocument();
    await expect(canvas.getByText('Delete Recipe')).toBeInTheDocument();
    await expect(canvas.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  },
};

// Interaction Tests
export const StartCookingInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test clicking the Start Cooking button to navigate to cooking mode.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Click Start Cooking button
    const startCookingButton = canvas.getByTestId('recipeViewPage-button-startCooking');
    await userEvent.click(startCookingButton);

    // Verify navigation was called
    await expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-123/cook');
  },
};

export const PrintInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test clicking the Print button to trigger window.print().',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Click Print button
    const printButton = canvas.getByTestId('recipeViewPage-button-print');
    await userEvent.click(printButton);

    // Verify window.print was called
    await expect(window.print).toHaveBeenCalled();
  },
};

export const DeleteConfirmInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test the complete delete flow including confirmation.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockDeleteRecipe.mockResolvedValue();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Click delete button to open dialog
    const deleteButton = canvas.getByTestId('recipeViewPage-button-delete');
    await userEvent.click(deleteButton);

    // Verify dialog is open
    await expect(canvas.getByTestId('recipeViewPage-dialog-deleteConfirm')).toBeInTheDocument();

    // Click confirm delete
    const confirmButton = canvas.getByTestId('recipeViewPage-dialog-deleteConfirm-button-confirm');
    await userEvent.click(confirmButton);

    // Verify delete service was called and navigation occurred
    await expect(mockDeleteRecipe).toHaveBeenCalledWith('test-recipe-123');
    await expect(mockNavigate).toHaveBeenCalledWith('/cookbook');
  },
};

export const BackButtonInteraction: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Test clicking the Back button to navigate back.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();

    // Click Back button
    const backButton = canvas.getByTestId('recipeViewPage-button-back');
    await userEvent.click(backButton);

    // Verify navigation was called with -1 (go back)
    await expect(mockNavigate).toHaveBeenCalledWith(-1);
  },
};
