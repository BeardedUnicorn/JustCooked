import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CookingMode from './CookingMode';
import { getRecipeById } from '@services/recipeStorage';
import { formatIngredientForDisplay } from '@utils/ingredientUtils';
import { mockRecipe } from '@/__tests__/fixtures/recipes';

// Mock the recipe storage service
vi.mock('@services/recipeStorage', () => ({
  getRecipeById: vi.fn(),
}));

// Mock ingredient utils
vi.mock('@utils/ingredientUtils', () => ({
  formatIngredientForDisplay: vi.fn((ingredient) => {
    if (ingredient.unit && ingredient.unit.trim() !== '') {
      return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
    } else {
      return `${ingredient.amount} ${ingredient.name}`;
    }
  }),
}));

// Mock useMediaQuery and useTheme
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: vi.fn(),
    useTheme: vi.fn(() => ({
      breakpoints: {
        down: vi.fn(() => 'md'),
      },
    })),
  };
});

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  writable: true,
  value: null,
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(document, 'exitFullscreen', {
  writable: true,
  value: vi.fn(),
});

const mockGetRecipeById = vi.mocked(getRecipeById);
const mockFormatIngredientForDisplay = vi.mocked(formatIngredientForDisplay);

const meta: Meta<typeof CookingMode> = {
  title: 'Pages/CookingMode',
  component: CookingMode,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Cooking mode page for step-by-step recipe guidance with timer and ingredient tracking.',
      },
    },
    router: {
      initialEntries: ['/recipe/test-recipe-123/cook'],
      initialIndex: 0,
    },
  },
  decorators: [
    (Story, context) => {
      const { initialEntries = ['/recipe/test-recipe-123/cook'], initialIndex = 0 } = context.parameters.router || {};
      return (
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
          <Story />
        </MemoryRouter>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CookingMode>;

export const LoadingRecipe: Story = {
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
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify loading state
    await expect(canvas.getByText('Loading recipe...')).toBeInTheDocument();
  },
};

export const RecipeLoadedDesktop: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default desktop view with recipe loaded.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for recipe to load
    await expect(canvas.getByTestId('cookingModePage-text-title')).toBeInTheDocument();
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
    
    // Verify desktop layout elements
    await expect(canvas.getByTestId('cookingModePage-panel-ingredients')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookingModePage-panel-instructions')).toBeInTheDocument();
    await expect(canvas.getByTestId('cookingModePage-progressBar-steps')).toBeInTheDocument();
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();
    await expect(canvas.getByText('Preheat oven to 375°F')).toBeInTheDocument();
  },
};

export const RecipeLoadedMobile: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile view with responsive layout.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(true); // Mobile
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for recipe to load
    await expect(canvas.getByTestId('cookingModePage-text-title')).toBeInTheDocument();
    await expect(canvas.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
    
    // Verify mobile layout (no desktop ingredients panel)
    await expect(canvas.queryByTestId('cookingModePage-panel-ingredients')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('cookingModePage-panel-instructions')).toBeInTheDocument();
    
    // Should have ingredients FAB for mobile
    await expect(canvas.getByTestId('cooking-mode-ingredients-fab')).toBeInTheDocument();
  },
};

export const FirstStep: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe at the first step.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for recipe to load
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();
    await expect(canvas.getByText('Preheat oven to 375°F')).toBeInTheDocument();
    
    // Verify step counter
    await expect(canvas.getByTestId('cookingModePage-text-stepCounter')).toBeInTheDocument();
    await expect(canvas.getByText('Step 1 of 5')).toBeInTheDocument();
    
    // Previous button should be disabled
    const prevButton = canvas.getByTestId('cooking-mode-previous-step');
    await expect(prevButton).toBeDisabled();

    // Next button should be enabled
    const nextButton = canvas.getByTestId('cooking-mode-next-step');
    await expect(nextButton).toBeEnabled();
  },
};

export const MiddleStep: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe at a middle step.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for recipe to load
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();
    
    // Navigate to middle step
    const nextButton = canvas.getByTestId('cooking-mode-next-step');
    await userEvent.click(nextButton);
    await userEvent.click(nextButton);
    
    // Verify we're at step 3
    await expect(canvas.getByText('Step 3')).toBeInTheDocument();
    await expect(canvas.getByText('Add wet ingredients and mix until combined')).toBeInTheDocument();
    await expect(canvas.getByText('Step 3 of 5')).toBeInTheDocument();
    
    // Both buttons should be enabled
    const prevButton = canvas.getByTestId('cooking-mode-previous-step');
    await expect(prevButton).toBeEnabled();
    await expect(nextButton).toBeEnabled();
  },
};

export const LastStep: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe at the last step.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();

    // Navigate to last step
    const nextButton = canvas.getByTestId('cooking-mode-next-step');
    await userEvent.click(nextButton);
    await userEvent.click(nextButton);
    await userEvent.click(nextButton);
    await userEvent.click(nextButton);

    // Verify we're at the last step
    await expect(canvas.getByText('Step 5')).toBeInTheDocument();
    await expect(canvas.getByText('Bake for 10-12 minutes until golden brown')).toBeInTheDocument();
    await expect(canvas.getByText('Step 5 of 5')).toBeInTheDocument();

    // Previous button should be enabled, next should be disabled
    const prevButton = canvas.getByTestId('cooking-mode-previous-step');
    await expect(prevButton).toBeEnabled();
    await expect(nextButton).toBeDisabled();
  },
};

export const TimerActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe with active timer running.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();

    // Open timer dialog
    const timerButton = canvas.getByTestId('cooking-mode-timer-button');
    await userEvent.click(timerButton);

    // Start 5 minute timer
    const fiveMinButton = canvas.getByText('5m');
    await userEvent.click(fiveMinButton);

    // Verify timer is displayed
    await expect(canvas.getByTestId('cookingModePage-container-timer')).toBeInTheDocument();
    await expect(canvas.getByText('5:00')).toBeInTheDocument();

    // Verify timer controls
    await expect(canvas.getByTestId('cooking-mode-timer-play-pause')).toBeInTheDocument();
    await expect(canvas.getByTestId('cooking-mode-timer-stop')).toBeInTheDocument();
  },
};

export const IngredientsChecked: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Recipe with some ingredients checked off.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Ingredients')).toBeInTheDocument();

    // Check first two ingredients
    const firstCheckbox = canvas.getByTestId('cooking-mode-ingredient-checkbox-0');
    const secondCheckbox = canvas.getByTestId('cooking-mode-ingredient-checkbox-1');

    await userEvent.click(firstCheckbox);
    await userEvent.click(secondCheckbox);

    // Verify checkboxes are checked
    await expect(firstCheckbox).toBeChecked();
    await expect(secondCheckbox).toBeChecked();

    // Verify remaining checkboxes are unchecked
    const thirdCheckbox = canvas.getByTestId('cooking-mode-ingredient-checkbox-2');
    await expect(thirdCheckbox).not.toBeChecked();
  },
};

export const MobileIngredientsDrawerOpen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile view with ingredients drawer open.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(true); // Mobile
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByTestId('cookingModePage-text-title')).toBeInTheDocument();

    // Open ingredients drawer
    const ingredientsFab = canvas.getByTestId('cooking-mode-ingredients-fab');
    await userEvent.click(ingredientsFab);

    // Verify drawer is open with mobile ingredients
    await expect(canvas.getByTestId('cooking-mode-ingredient-mobile-0')).toBeInTheDocument();
    await expect(canvas.getByTestId('cooking-mode-ingredients-drawer-close')).toBeInTheDocument();
  },
};

export const InteractionTest: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive interaction test covering navigation, ingredients, and timer.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(mockRecipe);
    mockFormatIngredientForDisplay.mockImplementation((ingredient) => {
      if (ingredient.unit && ingredient.unit.trim() !== '') {
        return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      } else {
        return `${ingredient.amount} ${ingredient.name}`;
      }
    });
    const { useMediaQuery } = require('@mui/material');
    vi.mocked(useMediaQuery).mockReturnValue(false); // Desktop
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for recipe to load
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();

    // Test step navigation
    const nextButton = canvas.getByTestId('cooking-mode-next-step');
    await userEvent.click(nextButton);
    await expect(canvas.getByText('Step 2')).toBeInTheDocument();

    const prevButton = canvas.getByTestId('cooking-mode-previous-step');
    await userEvent.click(prevButton);
    await expect(canvas.getByText('Step 1')).toBeInTheDocument();

    // Test ingredient checking
    const firstCheckbox = canvas.getByTestId('cooking-mode-ingredient-checkbox-0');
    await userEvent.click(firstCheckbox);
    await expect(firstCheckbox).toBeChecked();

    // Test fullscreen toggle
    const fullscreenButton = canvas.getByTestId('cooking-mode-fullscreen-button');
    await userEvent.click(fullscreenButton);
    await expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  },
};
