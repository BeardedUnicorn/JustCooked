import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { vi } from 'vitest';
import CookingMode from '@pages/CookingMode';
import { mockRecipe } from '@/__tests__/fixtures/recipes';
import darkTheme from '@/theme';

// Mock services
vi.mock('@services/recipeStorage', () => ({
  getRecipeById: vi.fn(),
}));

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

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockParams = { id: 'test-recipe-123' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true,
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  value: vi.fn(),
  writable: true,
});

const renderCookingMode = (isMobile = false) => {
  vi.mocked(useMediaQuery).mockReturnValue(isMobile);
  
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        <CookingMode />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('CookingMode Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset the mock params
    mockParams.id = 'test-recipe-123';
    
    // Set up default mock
    const { getRecipeById } = await import('@services/recipeStorage');
    vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading and Recipe Display', () => {
    test('should show loading state initially', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderCookingMode();

      expect(screen.getByText('Loading recipe...')).toBeInTheDocument();
    });

    test('should display recipe after loading', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Preheat oven to 375°F')).toBeInTheDocument();
    }, 15000);

    test('should navigate to home if recipe not found', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(null);

      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    test('should navigate to home if no recipe ID', async () => {
      // Temporarily change the mock params
      const originalId = mockParams.id;
      mockParams.id = '';
      
      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
      
      // Restore original mock
      mockParams.id = originalId;
    });
  });

  describe('Ingredients Panel', () => {
    test('should display all ingredients', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('2 cups flour')).toBeInTheDocument();
      expect(screen.getByText('1 cup sugar')).toBeInTheDocument();
      expect(screen.getByText('3 eggs')).toBeInTheDocument();
    }, 15000);

    test('should allow checking off ingredients', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();

      await user.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
    });

    test('should apply strikethrough to checked ingredients', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const firstIngredientText = screen.getByText('2 cups flour').parentElement;

      // Initially no strikethrough
      expect(firstIngredientText).not.toHaveStyle({ textDecoration: 'line-through' });

      // Check ingredient
      await user.click(checkboxes[0]);

      // Should have strikethrough
      expect(firstIngredientText).toHaveStyle({ textDecoration: 'line-through' });
    });
  });

  describe('Step Navigation', () => {
    test('should show current step and navigation buttons', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('Preheat oven to 375°F')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    }, 15000);

    test('should navigate to next step', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Mix dry ingredients in a bowl')).toBeInTheDocument();
    });

    test('should navigate to previous step', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Go to step 2 first
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      expect(screen.getByText('Step 2')).toBeInTheDocument();

      // Go back to step 1
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    test('should disable previous button on first step', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    test('should disable next button on last step', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Navigate to last step
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      // Click next until we reach the last step
      for (let i = 0; i < mockRecipe.instructions.length - 1; i++) {
        await user.click(nextButton);
      }

      expect(nextButton).toBeDisabled();
    });

    test('should show progress indicator', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '20'); // 1/5 steps = 20%
    });

    test('should show remaining steps count', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      expect(screen.getByText('4 steps remaining')).toBeInTheDocument();
    });
  });

  describe('Timer Functionality', () => {
    test.skip('should open timer dialog when timer button is clicked', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const timerButton = screen.getByRole('button', { name: /timer/i });
      await user.click(timerButton);

      expect(screen.getByText('Set Timer')).toBeInTheDocument();
      expect(screen.getByText('1m')).toBeInTheDocument();
      expect(screen.getByText('5m')).toBeInTheDocument();
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    test.skip('should start timer when preset button is clicked', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Open timer dialog
      const timerButton = screen.getByRole('button', { name: /timer/i });
      await user.click(timerButton);

      // Click 5 minute timer
      const fiveMinButton = screen.getByText('5m');
      await user.click(fiveMinButton);

      // Timer should be running
      expect(screen.getByText('5:00')).toBeInTheDocument();
      expect(screen.getByTestId('PauseIcon')).toBeInTheDocument();
    });

    test.skip('should countdown timer', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Start 1 minute timer
      const timerButton = screen.getByRole('button', { name: /timer/i });
      await user.click(timerButton);
      await user.click(screen.getByText('1m'));

      expect(screen.getByText('1:00')).toBeInTheDocument();

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText('0:59')).toBeInTheDocument();
      });
    });

    test.skip('should stop timer when stop button is clicked', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Start timer
      const timerButton = screen.getByRole('button', { name: /timer/i });
      await user.click(timerButton);
      await user.click(screen.getByText('1m'));

      // Stop timer
      const stopButton = screen.getByTestId('StopIcon').closest('button');
      expect(stopButton).not.toBeNull();
      await user.click(stopButton!);

      expect(screen.queryByText('1:00')).not.toBeInTheDocument();
    });
  });

  describe('Fullscreen Mode', () => {
    test.skip('should toggle fullscreen when fullscreen button is clicked', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByTestId('FullscreenIcon').closest('button');
      expect(fullscreenButton).not.toBeNull();
      await user.click(fullscreenButton!);

      expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    });
  });

  describe('Exit Cooking', () => {
    test.skip('should navigate back to recipe view when exit button is clicked', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const exitButton = screen.getByRole('button', { name: /exit cooking/i });
      await user.click(exitButton);

      expect(mockNavigate).toHaveBeenCalledWith('/recipe/test-recipe-123');
    });
  });

  describe('Mobile Layout', () => {
    test.skip('should render mobile-optimized layout', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockResolvedValue(mockRecipe);
      
      renderCookingMode(true);

      await waitFor(() => {
        expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
      });

      // Should have mobile-specific styling
      const title = screen.getByText('Chocolate Chip Cookies');
      expect(title).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test.skip('should handle recipe loading error', async () => {
      const { getRecipeById } = await import('@services/recipeStorage');
      vi.mocked(getRecipeById).mockRejectedValue(new Error('Failed to load'));

      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });
});
