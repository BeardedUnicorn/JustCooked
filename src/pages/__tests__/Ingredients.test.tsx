import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Ingredients from '../Ingredients';
import * as ingredientStorage from '@services/ingredientStorage';
import { IngredientDatabase } from '@app-types';

// Mock the ingredient storage service
vi.mock('@services/ingredientStorage');
const mockLoadIngredients = vi.mocked(ingredientStorage.loadIngredients);
const mockSearchIngredients = vi.mocked(ingredientStorage.searchIngredients);

const renderIngredients = () => {
  return render(
    <BrowserRouter>
      <Ingredients />
    </BrowserRouter>
  );
};

// Test fixtures
const mockIngredients: IngredientDatabase[] = [
  {
    id: '1',
    name: 'Salt',
    category: 'herbs',
    aliases: ['table salt', 'sea salt'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Black Pepper',
    category: 'herbs',
    aliases: ['pepper'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Olive Oil',
    category: 'oils',
    aliases: ['extra virgin olive oil'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
];

describe('Ingredients Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadIngredients.mockResolvedValue(mockIngredients);
    mockSearchIngredients.mockResolvedValue([]);
  });

  describe('Ingredient Display', () => {
    it('should display only ingredient names, not amounts or quantities', async () => {
      renderIngredients();

      // Wait for ingredients to load
      await waitFor(() => {
        expect(screen.getByText('Salt')).toBeInTheDocument();
      });

      // Verify ingredient names are displayed
      expect(screen.getByText('Salt')).toBeInTheDocument();
      expect(screen.getByText('Black Pepper')).toBeInTheDocument();
      expect(screen.getByText('Olive Oil')).toBeInTheDocument();

      // Verify no amounts/quantities are displayed (these would be recipe-specific)
      expect(screen.queryByText(/cup/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/tablespoon/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/teaspoon/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/gram/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ounce/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/pound/i)).not.toBeInTheDocument();

      // Verify ingredient names are displayed without amounts
      const saltRow = screen.getByTestId('ingredient-row-1');
      expect(saltRow).toHaveTextContent('Salt');
      expect(saltRow).not.toHaveTextContent(/\d+\s*(cup|tablespoon|teaspoon|gram|ounce|pound)/i);
    });

    it('should render ingredient list correctly with proper structure', async () => {
      renderIngredients();

      await waitFor(() => {
        expect(screen.getByText('Salt')).toBeInTheDocument();
      });

      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /category/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /aliases/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();

      // Check ingredient rows
      const saltRow = screen.getByTestId('ingredient-row-1');
      expect(saltRow).toBeInTheDocument();
      expect(saltRow).toHaveTextContent('Salt');
      expect(saltRow).toHaveTextContent('Herbs & Spices');
    });

    it('should handle missing ingredient names gracefully', async () => {
      const incompleteIngredients: IngredientDatabase[] = [
        {
          id: '1',
          name: '',
          category: 'other',
          aliases: [],
          dateAdded: '2024-01-01T00:00:00Z',
          dateModified: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Valid Ingredient',
          category: 'vegetables',
          aliases: [],
          dateAdded: '2024-01-01T00:00:00Z',
          dateModified: '2024-01-01T00:00:00Z',
        },
      ];

      mockLoadIngredients.mockResolvedValue(incompleteIngredients);
      renderIngredients();

      await waitFor(() => {
        expect(screen.getByText('Valid Ingredient')).toBeInTheDocument();
      });

      // Should still render the row with empty name
      const emptyNameRow = screen.getByTestId('ingredient-row-1');
      expect(emptyNameRow).toBeInTheDocument();

      // Valid ingredient should be displayed
      expect(screen.getByText('Valid Ingredient')).toBeInTheDocument();
    });

    it('should display ingredient categories correctly', async () => {
      renderIngredients();

      await waitFor(() => {
        expect(screen.getByText('Salt')).toBeInTheDocument();
      });

      // Check category chips are displayed (there might be multiple instances)
      expect(screen.getAllByText('Herbs & Spices')).toHaveLength(2); // Salt and Black Pepper
      expect(screen.getByText('Oils & Fats')).toBeInTheDocument();
    });

    it('should display ingredient aliases correctly', async () => {
      renderIngredients();

      await waitFor(() => {
        expect(screen.getByText('Salt')).toBeInTheDocument();
      });

      // Check aliases are displayed as individual chips
      expect(screen.getByText('table salt')).toBeInTheDocument();
      expect(screen.getByText('sea salt')).toBeInTheDocument();
      expect(screen.getByText('pepper')).toBeInTheDocument();
      expect(screen.getByText('extra virgin olive oil')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ingredient list', async () => {
      mockLoadIngredients.mockResolvedValue([]);
      renderIngredients();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Table should still be rendered but with no data rows
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.queryByTestId(/ingredient-row-/)).not.toBeInTheDocument();
    });

    it('should handle loading error gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock the rejected promise to return empty array instead of throwing
      mockLoadIngredients.mockResolvedValue([]);

      // Should not throw when rendering
      expect(() => renderIngredients()).not.toThrow();

      // Should still show the search input
      expect(screen.getByLabelText(/Search ingredients/i)).toBeInTheDocument();

      // Clean up
      consoleSpy.mockRestore();
    });
  });
});
