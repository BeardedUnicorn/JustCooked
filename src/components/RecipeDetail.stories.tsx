import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import RecipeDetail from './RecipeDetail';
import { mockRecipe, mockSectionedIngredients } from '@/__tests__/fixtures/recipes';
import { Recipe } from '@app-types';

const meta: Meta<typeof RecipeDetail> = {
  title: 'Display/RecipeDetail',
  component: RecipeDetail,
  parameters: {
    layout: 'padded',
    router: {
      initialEntries: ['/'],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onEdit: { action: 'edited' },
    onRecipeUpdated: { action: 'recipeUpdated' },
  },
  args: {
    onEdit: fn(),
    onRecipeUpdated: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Browser-compatible mock implementation variables
let mockUseImageUrlImplementation = fn().mockReturnValue({
  imageUrl: 'https://via.placeholder.com/400x300?text=Recipe+Image',
  isLoading: false,
  error: null,
});

let mockInvokeImplementation = fn().mockResolvedValue(undefined);
let mockReImportRecipeImplementation = fn().mockResolvedValue(undefined);

const applyStorybookUseImageUrlMock = () => {
  if (typeof window !== 'undefined') {
    (
      window as typeof window & {
        __STORYBOOK_HOOK_MOCKS__?: {
          useImageUrl?: (value: string | undefined) => ReturnType<typeof mockUseImageUrlImplementation>;
        };
      }
    ).__STORYBOOK_HOOK_MOCKS__ = {
      ...(
        window as typeof window & {
          __STORYBOOK_HOOK_MOCKS__?: {
            useImageUrl?: (value: string | undefined) => ReturnType<typeof mockUseImageUrlImplementation>;
          };
        }
      ).__STORYBOOK_HOOK_MOCKS__,
      useImageUrl: (imageUrl) => mockUseImageUrlImplementation(imageUrl),
    };
  }
};

// Mock services for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    recipeImport: {
      reImportRecipe: mockReImportRecipeImplementation,
    },
  };

  // @ts-ignore
  window.__TAURI__ = {
    core: {
      invoke: mockInvokeImplementation,
    },
  };
}

applyStorybookUseImageUrlMock();

// Browser-compatible mock configuration function for useImageUrl
const configureMockUseImageUrl = (imageUrl: string, isLoading = false, error: string | null = null) => {
  mockUseImageUrlImplementation = fn().mockReturnValue({
    imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=Recipe+Image',
    isLoading,
    error,
  });
  applyStorybookUseImageUrlMock();
};

// Browser-compatible mock configuration function for services
const setupMocks = (config: {
  invoke?: any;
  reImportRecipe?: any;
} = {}) => {
  mockInvokeImplementation = config.invoke || fn().mockResolvedValue(undefined);
  mockReImportRecipeImplementation = config.reImportRecipe || fn().mockResolvedValue(undefined);

  // Update service mocks
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      recipeImport: {
        reImportRecipe: mockReImportRecipeImplementation,
      },
    };

    // @ts-ignore
    window.__TAURI__ = {
      core: {
        invoke: mockInvokeImplementation,
      },
    };
  }
};

// Default Story: Basic recipe display
export const Default: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Chocolate+Chip+Cookies');
    setupMocks();
  },
};

// With Scaled Servings Story: Show recipe with different serving size
export const WithScaledServings: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      servings: 12, // Original servings
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Scaled+Recipe');
    setupMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the serving size input and change it to 24 (double the original)
    const servingInput = canvas.getByDisplayValue('12');
    await userEvent.clear(servingInput);
    await userEvent.type(servingInput, '24');
    
    // Verify that ingredients are scaled (amounts should be doubled)
    // Note: The actual scaling logic is tested in unit tests, here we just verify the UI updates
    expect(servingInput).toHaveValue(24);
  },
};

// No Image Story: Recipe without image
export const NoImage: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      image: '',
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=No+Image');
    setupMocks();
  },
};

// No Source URL Story: Recipe without source URL (re-import button should be hidden)
export const NoSourceUrl: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      sourceUrl: '',
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=No+Source+URL');
    setupMocks();
  },
};

// With Sectioned Ingredients Story: Recipe with ingredient sections
export const WithSectionedIngredients: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      title: 'Cinnamon Coffee Cake',
      description: 'A delicious layered coffee cake with cinnamon swirl',
      ingredients: mockSectionedIngredients,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Sectioned+Ingredients');
    setupMocks();
  },
};

// Complete Recipe Story: Recipe with all optional fields
export const CompleteRecipe: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      rating: 4.5,
      difficulty: 'Medium' as const,
      isFavorite: true,
      personalNotes: 'Family favorite recipe - add extra chocolate chips!',
      tags: ['dessert', 'cookies', 'baking', 'family-favorite', 'quick'],
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Complete+Recipe');
    setupMocks();
  },
};

// Long Title and Description Story: Test text overflow handling
export const LongContent: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      title: 'The Ultimate Super Delicious Extra Special Chocolate Chip Cookies with Vanilla Extract and Brown Butter',
      description: 'This is an extremely long description that goes on and on about how amazing these cookies are. They have the perfect balance of crispy edges and chewy centers, with just the right amount of chocolate chips distributed throughout. The brown butter adds a nutty depth of flavor that elevates these cookies from ordinary to extraordinary. Perfect for any occasion, whether it\'s a family gathering, office party, or just a quiet evening at home with a glass of milk.',
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Long+Content');
    setupMocks();
  },
};

// Re-import Loading Story: Show loading state during re-import
export const ReimportLoading: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Re-import+Loading');
    setupMocks({
      reImportRecipe: fn().mockImplementation(() => new Promise(() => {})), // Never resolves to keep loading
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click the re-import button
    const reimportButton = canvas.getByRole('button', { name: /re-import/i });
    await userEvent.click(reimportButton);
    
    // Verify loading state is shown
    expect(canvas.getByRole('progressbar')).toBeInTheDocument();
  },
};

// Re-import Success Story: Show success snackbar after re-import
export const ReimportSuccess: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Re-import+Success');
    setupMocks({
      reImportRecipe: fn().mockResolvedValue(undefined),
      invoke: fn().mockResolvedValue({ ...mockRecipe, dateModified: new Date().toISOString() }),
    });
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Click the re-import button
    const reimportButton = canvas.getByRole('button', { name: /re-import/i });
    await userEvent.click(reimportButton);
    
    // Wait for success message
    await expect(canvas.findByText(/recipe re-imported successfully/i)).resolves.toBeInTheDocument();
    
    // Verify onRecipeUpdated was called
    expect(args.onRecipeUpdated).toHaveBeenCalled();
  },
};

// Re-import Error Story: Show error snackbar after failed re-import
export const ReimportError: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Re-import+Error');
    setupMocks({
      reImportRecipe: fn().mockRejectedValue(new Error('Failed to fetch recipe from source')),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click the re-import button
    const reimportButton = canvas.getByRole('button', { name: /re-import/i });
    await userEvent.click(reimportButton);
    
    // Wait for error message
    await expect(canvas.findByText(/failed to fetch recipe from source/i)).resolves.toBeInTheDocument();
  },
};

// Interaction Tests Story: Test all interactive elements
export const InteractionTests: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/400x300?text=Interaction+Tests');
    setupMocks({
      invoke: fn().mockImplementation((command) => {
        if (command === 'open_external_url') {
          return Promise.resolve();
        }
        return Promise.resolve();
      }),
    });
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Test Edit button
    const editButton = canvas.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);
    expect(args.onEdit).toHaveBeenCalled();
    
    // Test source URL link
    const sourceLink = canvas.getByRole('link', { name: /view original recipe/i });
    await userEvent.click(sourceLink);
    expect(mockInvokeImplementation).toHaveBeenCalledWith('open_external_url', { url: mockRecipe.sourceUrl });
    
    // Test serving size adjustment
    const servingInput = canvas.getByDisplayValue('24');
    await userEvent.clear(servingInput);
    await userEvent.type(servingInput, '12');
    expect(servingInput).toHaveValue(12);
  },
};
