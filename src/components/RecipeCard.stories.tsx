import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import RecipeCard from './RecipeCard';
import { mockRecipe } from '@/__tests__/fixtures/recipes';
import { Recipe } from '@app-types';

// Mock the useImageUrl hook
import * as useImageUrlModule from '@hooks/useImageUrl';

// Browser-compatible mock implementation variable
let mockUseImageUrlImplementation = fn().mockReturnValue({
  imageUrl: 'https://via.placeholder.com/345x180?text=Mock+Image',
  isLoading: false,
  error: null,
});

// Mock useImageUrl for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore - Override the hook for Storybook
  useImageUrlModule.useImageUrl = mockUseImageUrlImplementation;
}

const meta: Meta<typeof RecipeCard> = {
  title: 'Cards/RecipeCard',
  component: RecipeCard,
  parameters: {
    layout: 'centered',
    router: {
      initialEntries: ['/'],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 345 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onDelete: { action: 'deleted' },
    onUpdate: { action: 'updated' },
  },
  args: {
    onDelete: fn(),
    onUpdate: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Browser-compatible mock configuration function
const configureMockUseImageUrl = (imageUrl: string, isLoading = false, error: string | null = null) => {
  mockUseImageUrlImplementation = fn().mockReturnValue({
    imageUrl: imageUrl || 'https://via.placeholder.com/345x180?text=Mock+Image',
    isLoading,
    error,
  });

  if (typeof window !== 'undefined') {
    // @ts-ignore - Override the hook for Storybook
    useImageUrlModule.useImageUrl = mockUseImageUrlImplementation;
  }
};

// Default Story: Basic recipe card
export const Default: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Default+Recipe');
  },
};

// Favorite Recipe Story: isFavorite=true
export const FavoriteRecipe: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      isFavorite: true,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Favorite+Recipe');
  },
};

// With Rating Story: rating=4.5
export const WithRating: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      rating: 4.5,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Rated+Recipe');
  },
};

// Different Difficulties Story: Easy, Medium, Hard
export const EasyDifficulty: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      difficulty: 'Easy' as const,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Easy+Recipe');
  },
};

export const MediumDifficulty: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      difficulty: 'Medium' as const,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Medium+Recipe');
  },
};

export const HardDifficulty: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      difficulty: 'Hard' as const,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Hard+Recipe');
  },
};

// Long Title Story: Test text overflow
export const LongTitle: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      title: 'This is a very long recipe title that should wrap to multiple lines and test the text overflow behavior',
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Long+Title');
  },
};

// No Image Story: Test placeholder behavior
export const NoImage: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      image: '',
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=No+Image');
  },
};

// Loading Image Story: isLoading=true
export const LoadingImage: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('', true);
  },
};

// Image Error Story: error state
export const ImageError: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('', false, 'Failed to load image');
  },
};

// Complete Recipe Story: All fields populated
export const CompleteRecipe: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      rating: 4.8,
      difficulty: 'Medium' as const,
      isFavorite: true,
      tags: ['Italian', 'Pasta', 'Dinner', 'Quick'],
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Complete+Recipe');
  },
};

// Interaction Test: Click favorite button toggles favorite state
export const InteractionTestFavorite: Story = {
  args: {
    recipe: {
      ...mockRecipe,
      isFavorite: false,
    },
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Favorite+Test');
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the favorite button
    const favoriteButton = canvas.getByTestId(`recipe-card-${args.recipe.id}-favorite-button`);
    await userEvent.click(favoriteButton);

    // Verify onUpdate was called (since favorite toggle triggers update)
    await expect(args.onUpdate).toHaveBeenCalled();
  },
};

// Interaction Test: Click main area navigates to recipe detail
export const InteractionTestNavigation: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Navigation+Test');
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the main card area
    const mainArea = canvas.getByTestId(`recipe-card-${args.recipe.id}-main-area`);
    await userEvent.click(mainArea);

    // Note: Navigation testing would require mocking react-router-dom
    // In a real test, we would verify the navigate function was called
  },
};

// Interaction Test: Click Cook Now button
export const InteractionTestCookNow: Story = {
  args: {
    recipe: mockRecipe,
  },
  beforeEach: () => {
    configureMockUseImageUrl('https://via.placeholder.com/345x180?text=Cook+Now+Test');
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the Cook Now button
    const cookNowButton = canvas.getByTestId(`recipe-card-${args.recipe.id}-cook-now-button`);
    await userEvent.click(cookNowButton);

    // Note: Navigation testing would require mocking react-router-dom
    // In a real test, we would verify the navigate function was called with cooking mode
  },
};
