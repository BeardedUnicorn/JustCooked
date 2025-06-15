import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import PantryManager from '../PantryManager';
import { PantryItem, ProductIngredientMapping } from '../../types';
import { mockPantryItems } from '../../__tests__/fixtures/recipes';
import darkTheme from '../../theme';
import { ProductIngredientMappingService } from '@services/productIngredientMappingService';

// Mock the formatAmountForDisplay function
jest.mock('../../services/recipeImport', () => ({
  formatAmountForDisplay: jest.fn((amount: number) => amount.toString()),
}));

// Mock the ProductIngredientMappingService
jest.mock('@services/productIngredientMappingService');
const mockProductIngredientMappingService = ProductIngredientMappingService as jest.Mocked<typeof ProductIngredientMappingService>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
});

const mockOnAddItem = jest.fn();
const mockOnUpdateItem = jest.fn();
const mockOnDeleteItem = jest.fn();

const renderPantryManager = (items: PantryItem[] = mockPantryItems) => {
  return render(
    <ThemeProvider theme={darkTheme}>
      <PantryManager
        items={items}
        onAddItem={mockOnAddItem}
        onUpdateItem={mockOnUpdateItem}
        onDeleteItem={mockOnDeleteItem}
      />
    </ThemeProvider>
  );
};

// Mock ingredient mappings for testing
const mockIngredientMappings: ProductIngredientMapping[] = [
  {
    id: 'mapping-1',
    product_code: '123456789012',
    ingredient_id: 'ingredient-1',
    ingredient_name: 'All-purpose flour',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('PantryManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock for ingredient mappings
    mockProductIngredientMappingService.getAllMappings.mockResolvedValue(mockIngredientMappings);
  });

  describe('Rendering', () => {
    test('should render pantry manager with title and add button', () => {
      renderPantryManager();

      expect(screen.getByText('Pantry Items')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });

    test('should render empty state when no items', () => {
      renderPantryManager([]);

      expect(screen.getByText('Pantry Items')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });

    test('should group items by category', () => {
      renderPantryManager();

      // Should show category headers
      expect(screen.getByText('baking')).toBeInTheDocument();
      
      // Should show items under categories
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('Sugar')).toBeInTheDocument();
    });

    test('should display item details correctly', () => {
      renderPantryManager();

      // Check if items are displayed with proper formatting
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('5 lbs')).toBeInTheDocument();
      expect(screen.getByText('Sugar')).toBeInTheDocument();
      expect(screen.getByText('2 lbs')).toBeInTheDocument();
    });
  });

  describe('Add Item Dialog', () => {
    test('should open add dialog when add manually menu item is clicked', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);

      // Click "Add Manually" menu item
      const addManuallyItem = screen.getByTestId('pantry-add-manual-menu-item');
      await user.click(addManuallyItem);

      expect(screen.getByText('Add Pantry Item')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getAllByText('Unit').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Category').length).toBeGreaterThan(0);
    });

    test('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));
      expect(screen.getByText('Add Pantry Item')).toBeInTheDocument();

      // Close dialog
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.queryByText('Add Pantry Item')).not.toBeInTheDocument();
      });
    });

    test('should add new item when form is submitted', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));

      // Fill form
      await user.type(screen.getByLabelText(/name/i), 'Milk');
      await user.clear(screen.getByLabelText(/amount/i));
      await user.type(screen.getByLabelText(/amount/i), '1');
      
      // Select unit - find the unit select by its container
      const unitSelects = screen.getAllByRole('combobox');
      const unitSelect = unitSelects[0]; // First combobox is unit
      await user.click(unitSelect);
      await user.click(screen.getByText('l')); // Use 'l' (liter) which is available

      // Select category
      const categorySelects = screen.getAllByRole('combobox');
      const categorySelect = categorySelects[1]; // Second combobox is category
      await user.click(categorySelect);
      await user.click(screen.getByText('Dairy'));

      // Submit form
      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(mockOnAddItem).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        name: 'Milk',
        amount: 1,
        unit: 'l',
        category: 'Dairy',
        expiryDate: undefined,
      });
    });

    test('should handle expiry date input', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));

      // Fill form with expiry date
      await user.type(screen.getByLabelText(/name/i), 'Bread');
      await user.clear(screen.getByLabelText(/amount/i));
      await user.type(screen.getByLabelText(/amount/i), '1');
      await user.type(screen.getByLabelText(/expiry date/i), '2024-12-31');

      // Submit form
      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(mockOnAddItem).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        name: 'Bread',
        amount: 1,
        unit: 'piece(s)',
        category: 'Other',
        expiryDate: '2024-12-31',
      });
    });
  });

  describe('Edit Item Dialog', () => {
    test('should open edit dialog when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Find and click edit button for first item
      const editButtons = screen.getAllByRole('button', { name: /edit item/i });
      await user.click(editButtons[0]);

      expect(screen.getByText('Edit Pantry Item')).toBeInTheDocument();
      
      // Form should be pre-filled with item data
      expect(screen.getByDisplayValue('Flour')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    test('should update item when edit form is submitted', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open edit dialog
      const editButtons = screen.getAllByRole('button', { name: /edit item/i });
      await user.click(editButtons[0]);

      // Modify the amount
      const amountInput = screen.getByDisplayValue('5');
      await user.clear(amountInput);
      await user.type(amountInput, '10');

      // Submit form
      await user.click(screen.getByRole('button', { name: /update/i }));

      expect(mockOnUpdateItem).toHaveBeenCalledWith({
        id: 'pantry-1',
        name: 'Flour',
        amount: 10,
        unit: 'lbs',
        category: 'baking',
        expiryDate: '2024-12-31',
      });
    });
  });

  describe('Delete Item', () => {
    test('should delete item when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Find and click delete button for first item
      const deleteButtons = screen.getAllByRole('button', { name: /delete item/i });
      await user.click(deleteButtons[0]);

      expect(mockOnDeleteItem).toHaveBeenCalledWith('pantry-1');
    });
  });

  describe('Form Validation', () => {
    test('should require name field', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));

      // Try to submit without name
      await user.click(screen.getByRole('button', { name: /add/i }));

      // Should not call onAddItem
      expect(mockOnAddItem).not.toHaveBeenCalled();
    });

    test('should handle numeric amount input', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));

      // Fill form with valid data
      await user.type(screen.getByLabelText(/name/i), 'Test Item');
      await user.clear(screen.getByLabelText(/amount/i));
      await user.type(screen.getByLabelText(/amount/i), '2.5');

      // Submit form
      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(mockOnAddItem).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        name: 'Test Item',
        amount: 2.5,
        unit: 'piece(s)',
        category: 'Other',
        expiryDate: undefined,
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      renderPantryManager();

      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
      
      const editButtons = screen.getAllByRole('button', { name: /edit item/i });
      expect(editButtons.length).toBeGreaterThan(0);
      
      const deleteButtons = screen.getAllByRole('button', { name: /delete item/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    test('should support keyboard navigation in dialog', async () => {
      const user = userEvent.setup();
      renderPantryManager();

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add item/i }));

      // The name field should be focused by default (autoFocus)
      expect(screen.getByLabelText(/name/i)).toHaveFocus();

      // Tab to next field
      await user.tab();
      expect(screen.getByLabelText(/amount/i)).toHaveFocus();
    });
  });

  describe('Ingredient Mapping', () => {
    const itemsWithProductCodes: PantryItem[] = [
      {
        id: 'item-1',
        name: 'All-Purpose Flour',
        amount: 2,
        unit: 'kg',
        category: 'Baking',
        productCode: '123456789012',
        productName: 'King Arthur All-Purpose Flour',
        brands: 'King Arthur',
      },
      {
        id: 'item-2',
        name: 'Organic Milk',
        amount: 1,
        unit: 'l',
        category: 'Dairy',
        // No productCode - should show "No ingredient mapped"
      },
    ];

    test('should load ingredient mappings on component mount', async () => {
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalledTimes(1);
      });
    });

    test('should display ingredient mapping for items with product codes', async () => {
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Check that the ingredient mapping is displayed for the first item
      const ingredientMapping1 = screen.getByTestId('pantry-item-item-1-ingredient-mapping');
      expect(ingredientMapping1).toHaveTextContent('Ingredient: All-purpose flour');
    });

    test('should display "No ingredient mapped" for items without mappings', async () => {
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Check that "No ingredient mapped" is displayed for items without mappings
      const ingredientMapping2 = screen.getByTestId('pantry-item-item-2-ingredient-mapping');
      expect(ingredientMapping2).toHaveTextContent('Ingredient: No ingredient mapped');
    });

    test('should handle ingredient mapping service errors gracefully', async () => {
      // Mock the service to throw an error
      mockProductIngredientMappingService.getAllMappings.mockRejectedValue(new Error('Service error'));

      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // All items should show "No ingredient mapped" when service fails
      const ingredientMapping1 = screen.getByTestId('pantry-item-item-1-ingredient-mapping');
      expect(ingredientMapping1).toHaveTextContent('Ingredient: No ingredient mapped');

      const ingredientMapping2 = screen.getByTestId('pantry-item-item-2-ingredient-mapping');
      expect(ingredientMapping2).toHaveTextContent('Ingredient: No ingredient mapped');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty items array', () => {
      expect(() => renderPantryManager([])).not.toThrow();
    });

    test('should handle items without categories', () => {
      const itemsWithoutCategory = [
        { id: '1', name: 'Test', amount: 1, unit: 'piece', category: '' }
      ];

      expect(() => renderPantryManager(itemsWithoutCategory)).not.toThrow();
    });
  });
});
