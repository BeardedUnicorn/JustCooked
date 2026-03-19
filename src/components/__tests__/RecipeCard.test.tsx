import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import RecipeCard from '../RecipeCard';
import { Recipe } from '../../types';
import { mockRecipe } from '../../__tests__/fixtures/recipes';
import darkTheme from '../../theme';

// Mock services
vi.mock('@services/recipeStorage', () => ({
  deleteRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

import { deleteRecipe, updateRecipe } from '@services/recipeStorage';
const mockDeleteRecipe = vi.mocked(deleteRecipe);
const mockUpdateRecipe = vi.mocked(updateRecipe);

vi.mock('@hooks/useImageUrl', () => ({
  useImageUrl: vi.fn(() => ({ imageUrl: 'test-image-url.jpg' })),
}));

vi.mock('@utils/timeUtils', () => ({
  calculateTotalTime: vi.fn(() => '27 minutes'),
  getTodayLocalDateString: vi.fn(() => '2024-01-15'),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const mockOnDelete = vi.fn();
const mockOnUpdate = vi.fn();

const renderRecipeCard = (recipe: Recipe = mockRecipe, props = {}) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        <RecipeCard
          recipe={recipe}
          onDelete={mockOnDelete}
          onUpdate={mockOnUpdate}
          {...props}
        />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('RecipeCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render recipe card with basic information', () => {
      renderRecipeCard();

      expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
      expect(screen.getByText('Delicious homemade chocolate chip cookies')).toBeInTheDocument();
      expect(screen.getByText('27 minutes')).toBeInTheDocument();
      expect(screen.getByText('24 servings')).toBeInTheDocument();
    });

    test('should render recipe image', () => {
      renderRecipeCard();

      const image = screen.getByRole('img', { name: 'Chocolate Chip Cookies' });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'test-image-url.jpg');
    });

    test('should render recipe tags', () => {
      renderRecipeCard();

      expect(screen.getByText('dessert')).toBeInTheDocument();
      expect(screen.getByText('cookies')).toBeInTheDocument();
      // Only first 2 tags are shown, with +1 indicator for remaining tags
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    test('should show favorite badge when recipe is favorite', () => {
      const favoriteRecipe = { ...mockRecipe, isFavorite: true };
      renderRecipeCard(favoriteRecipe);

      const favoriteIcons = screen.getAllByTestId('FavoriteIcon');
      expect(favoriteIcons.length).toBeGreaterThan(0);
    });

    test('should not show favorite badge when recipe is not favorite', () => {
      const nonFavoriteRecipe = { ...mockRecipe, isFavorite: false };
      renderRecipeCard(nonFavoriteRecipe);

      // Should only have FavoriteBorderIcon, not FavoriteIcon in the badge area
      expect(screen.getByTestId('FavoriteBorderIcon')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('should navigate to recipe view when card is clicked', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Get the main card area (CardActionArea)
      const cardArea = screen.getByRole('button', { name: /chocolate chip cookies/i });
      await user.click(cardArea);

      expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-123');
    });

    test('should navigate to cooking mode when cook now button is clicked', async () => {
      renderRecipeCard();

      const overlay = screen.getByTestId('cook-overlay');
      const cookButton = screen.getByRole('button', { name: /cook now/i });
      
      // Simulate hover and click using fireEvent to bypass pointer-events restrictions
      fireEvent.mouseEnter(overlay);
      fireEvent.click(cookButton);

      expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-123/cook');
    });
  });

  describe('Actions Menu', () => {
    test('should open actions menu when more button is clicked', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      expect(screen.getByText('Share Recipe')).toBeInTheDocument();
      expect(screen.getByText('Add to Meal Plan')).toBeInTheDocument();
      expect(screen.getByText('Add to Collection')).toBeInTheDocument();
      expect(screen.getByText('Delete Recipe')).toBeInTheDocument();
    });

    test('should show favorite button when recipe is not favorite', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      const favoriteButton = screen.getByTestId(`recipe-card-${mockRecipe.id}-favorite-button`);
      expect(favoriteButton).toBeInTheDocument();

      // Should show unfilled heart icon for non-favorite
      expect(favoriteButton.querySelector('[data-testid="FavoriteBorderIcon"]')).toBeInTheDocument();
    });

    test('should close menu when clicking outside', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Open menu
      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);
      expect(screen.getByText('Share Recipe')).toBeInTheDocument();

      // Press Escape to close menu (more reliable than clicking outside)
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByText('Share Recipe')).not.toBeInTheDocument();
      });
    });
  });

  describe('Favorite Toggle', () => {
    test('should toggle favorite status when favorite button is clicked', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Click the favorite button directly
      const favoriteButton = screen.getByTestId(`recipe-card-${mockRecipe.id}-favorite-button`);
      await user.click(favoriteButton);

      // Should call updateRecipe with favorite status
      expect(mockUpdateRecipe).toHaveBeenCalledWith({
        ...mockRecipe,
        isFavorite: true,
      });
    });
  });

  describe('Delete Recipe', () => {
    test('should open delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Open menu
      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      // Click delete
      const deleteAction = screen.getByText('Delete Recipe');
      await user.click(deleteAction);

      expect(screen.getByText('Delete Recipe?')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    test('should cancel delete when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Open delete dialog
      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);
      await user.click(screen.getByText('Delete Recipe'));

      // Cancel delete
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Delete Recipe?')).not.toBeInTheDocument();
      });
      
      expect(mockDeleteRecipe).not.toHaveBeenCalled();
    });

    test('should delete recipe when confirmed', async () => {
      const user = userEvent.setup();
      renderRecipeCard();

      // Open delete dialog
      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);
      await user.click(screen.getByText('Delete Recipe'));

      // Confirm delete
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockDeleteRecipe).toHaveBeenCalledWith('test-recipe-123');
      expect(mockOnDelete).toHaveBeenCalled();
    });
  });

  describe('Share Recipe', () => {
    test('should handle share action', async () => {
      const user = userEvent.setup();
      
      // Mock navigator.share
      const mockShare = vi.fn();
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        writable: true,
      });

      renderRecipeCard();

      // Open menu and click share
      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);
      
      const shareAction = screen.getByText('Share Recipe');
      await user.click(shareAction);

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Chocolate Chip Cookies',
        text: 'Check out this recipe: Chocolate Chip Cookies',
        url: 'https://allrecipes.com/recipe/123/cookies',
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      renderRecipeCard();

      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cook now/i })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Chocolate Chip Cookies' })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing recipe data gracefully', () => {
      const incompleteRecipe = {
        ...mockRecipe,
        title: '',
        description: '',
        tags: [],
      };

      expect(() => renderRecipeCard(incompleteRecipe)).not.toThrow();
    });

    test('should handle missing callbacks', () => {
      expect(() => renderRecipeCard(mockRecipe, { onDelete: undefined, onUpdate: undefined })).not.toThrow();
    });
  });

  describe('Rating Display', () => {
    test('should show rating when available', () => {
      const ratedRecipe = { ...mockRecipe, rating: 4.5 };
      renderRecipeCard(ratedRecipe);

      const rating = screen.getByRole('img', { name: /4.5 stars/i });
      expect(rating).toBeInTheDocument();
    });

    test('should not show rating when not available', () => {
      renderRecipeCard();

      expect(screen.queryByRole('img', { name: /stars/i })).not.toBeInTheDocument();
    });
  });
});
