import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import CookingMode from '@pages/CookingMode';
import { mockRecipe } from '@/__tests__/fixtures/recipes';
import darkTheme from '@styles/theme';

// Mock services
jest.mock('@services/recipeStorage', () => ({
  getRecipeById: jest.fn(),
}));

jest.mock('@utils/ingredientUtils', () => ({
  formatIngredientForDisplay: jest.fn((ingredient) => `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`),
}));

// Mock useMediaQuery
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockParams = { id: 'test-recipe-123' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true,
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  value: jest.fn(),
  writable: true,
});

const renderCookingMode = (isMobile = false) => {
  (useMediaQuery as jest.Mock).mockReturnValue(isMobile);
  
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        <CookingMode />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('CookingMode Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    const { getRecipeById } = require('@services/recipeStorage');
    getRecipeById.mockResolvedValue(mockRecipe);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Loading and Recipe Display', () => {
    test('should show loading state initially', () => {
      renderCookingMode();

      expect(screen.getByText('Loading recipe...')).toBeInTheDocument();
    });

    test('should display recipe after loading', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
      });

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Preheat oven to 375°F')).toBeInTheDocument();
    });

    test('should navigate to home if recipe not found', async () => {
      const { getRecipeById } = require('@services/recipeStorage');
      getRecipeById.mockResolvedValue(null);

      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    test('should navigate to home if no recipe ID', async () => {
      mockParams.id = '';
      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Ingredients Panel', () => {
    test('should display all ingredients', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
      });

      expect(screen.getByText('2 cups flour')).toBeInTheDocument();
      expect(screen.getByText('1 cup sugar')).toBeInTheDocument();
      expect(screen.getByText('3  eggs')).toBeInTheDocument();
    });

    test('should allow checking off ingredients', async () => {
      const user = userEvent.setup();
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
      const user = userEvent.setup();
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
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Preheat oven to 375°F')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
    });

    test('should navigate to next step', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Mix dry ingredients in a bowl')).toBeInTheDocument();
    });

    test('should navigate to previous step', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Go to step 2 first
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);
      expect(screen.getByText('Step 2')).toBeInTheDocument();

      // Go back to step 1
      const prevButton = screen.getByRole('button', { name: /previous step/i });
      await user.click(prevButton);
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    test('should disable previous button on first step', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /previous step/i });
      expect(prevButton).toBeDisabled();
    });

    test('should disable next button on last step', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Navigate to last step
      const nextButton = screen.getByRole('button', { name: /next step/i });
      
      // Click next until we reach the last step
      for (let i = 0; i < mockRecipe.instructions.length - 1; i++) {
        await user.click(nextButton);
      }

      expect(nextButton).toBeDisabled();
    });

    test('should show progress indicator', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '20'); // 1/5 steps = 20%
    });

    test('should show remaining steps count', async () => {
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      expect(screen.getByText('4 steps remaining')).toBeInTheDocument();
    });
  });

  describe('Timer Functionality', () => {
    test('should open timer dialog when timer button is clicked', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const timerButton = screen.getByRole('button', { name: /set timer/i });
      await user.click(timerButton);

      expect(screen.getByText('Set Timer')).toBeInTheDocument();
      expect(screen.getByText('1m')).toBeInTheDocument();
      expect(screen.getByText('5m')).toBeInTheDocument();
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    test('should start timer when preset button is clicked', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Open timer dialog
      const timerButton = screen.getByRole('button', { name: /set timer/i });
      await user.click(timerButton);

      // Click 5 minute timer
      const fiveMinButton = screen.getByText('5m');
      await user.click(fiveMinButton);

      // Timer should be running
      expect(screen.getByText('5:00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pause timer/i })).toBeInTheDocument();
    });

    test('should countdown timer', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Start 1 minute timer
      const timerButton = screen.getByRole('button', { name: /set timer/i });
      await user.click(timerButton);
      await user.click(screen.getByText('1m'));

      expect(screen.getByText('1:00')).toBeInTheDocument();

      // Advance timer by 1 second
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText('0:59')).toBeInTheDocument();
      });
    });

    test('should stop timer when stop button is clicked', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      // Start timer
      const timerButton = screen.getByRole('button', { name: /set timer/i });
      await user.click(timerButton);
      await user.click(screen.getByText('1m'));

      // Stop timer
      const stopButton = screen.getByRole('button', { name: /stop timer/i });
      await user.click(stopButton);

      expect(screen.queryByText('1:00')).not.toBeInTheDocument();
    });
  });

  describe('Fullscreen Mode', () => {
    test('should toggle fullscreen when fullscreen button is clicked', async () => {
      const user = userEvent.setup();
      renderCookingMode();

      await waitFor(() => {
        expect(screen.getByText('Step 1')).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
      await user.click(fullscreenButton);

      expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    });
  });

  describe('Exit Cooking', () => {
    test('should navigate back to recipe view when exit button is clicked', async () => {
      const user = userEvent.setup();
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
    test('should render mobile-optimized layout', async () => {
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
    test('should handle recipe loading error', async () => {
      const { getRecipeById } = require('@services/recipeStorage');
      getRecipeById.mockRejectedValue(new Error('Failed to load'));

      renderCookingMode();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });
});
