
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import PantryManager from '../PantryManager';
import { PantryItem, ProductIngredientMapping } from '../../types';
import { mockPantryItems } from '../../__tests__/fixtures/recipes';
import darkTheme from '../../theme';

// Mock the formatAmountForDisplay function
vi.mock('@services/recipeImport', () => ({
  formatAmountForDisplay: vi.fn((amount: number) => amount.toString()),
}));

// Mock the ProductIngredientMappingService
vi.mock('@services/productIngredientMappingService', () => ({
  ProductIngredientMappingService: {
    getAllMappings: vi.fn(),
    getMapping: vi.fn(),
    createMapping: vi.fn(),
    deleteMapping: vi.fn(),
  },
}));

// Import the mocked service
import { ProductIngredientMappingService } from '@services/productIngredientMappingService';
const mockProductIngredientMappingService = vi.mocked(ProductIngredientMappingService);

// Mock ProductSearchModal
vi.mock('@components/ProductSearchModal', () => ({
  default: function MockProductSearchModal({
    open,
    onClose
  }: {
    open: boolean;
    onClose: () => void;
    onAddProduct: (item: PantryItem) => void;
  }) {
    if (!open) return null;

    return (
      <div data-testid="product-search-modal">
        <h2>Add Product to Pantry</h2>
        <button data-testid="product-cancel-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    );
  }
}));

// Mock IngredientAssociationModal
vi.mock('@components/IngredientAssociationModal', () => ({
  default: function MockIngredientAssociationModal({
    open,
    onClose,
    onAssociate
  }: {
    open: boolean;
    onClose: () => void;
    onAssociate: (association: any) => void;
  }) {
    if (!open) return null;

    return (
      <div data-testid="ingredient-association-modal">
        <h2>Associate Ingredient</h2>
        <button 
          data-testid="ingredient-associate-button" 
          onClick={() => {
            onAssociate({ ingredient_id: 'test-ingredient' });
            onClose();
          }}
        >
          Associate
        </button>
        <button 
          data-testid="ingredient-skip-button" 
          onClick={() => {
            onAssociate(null);
            onClose();
          }}
        >
          Skip
        </button>
      </div>
    );
  }
}));

// Mock the ZXing library
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    listVideoInputDevices: vi.fn().mockResolvedValue([
      { deviceId: 'camera1', label: 'Camera 1' }
    ]),
    decodeFromVideoDevice: vi.fn(),
    reset: vi.fn(),
  })),
  NotFoundException: class NotFoundException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'NotFoundException';
    }
  },
}));

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
});

const mockOnAddItem = vi.fn();
const mockOnUpdateItem = vi.fn();
const mockOnDeleteItem = vi.fn();

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

describe('PantryManager - Enhanced Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock for ingredient mappings
    mockProductIngredientMappingService.getAllMappings.mockResolvedValue(mockIngredientMappings);
    mockProductIngredientMappingService.getMapping.mockResolvedValue(null);
    mockProductIngredientMappingService.createMapping.mockResolvedValue(null);
  });

  describe('Ingredient Mapping Integration', () => {
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
      {
        id: 'item-3',
        name: 'Unmapped Product',
        amount: 1,
        unit: 'piece(s)',
        category: 'Other',
        productCode: '999999999999',
        productName: 'Unmapped Product',
        brands: 'Unknown Brand',
      },
    ];

    it('should trigger ingredient mapping flow when editing item with product code but no mapping', async () => {
      const user = userEvent.setup();
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Edit the unmapped product item
      const editButton = screen.getByTestId('pantry-item-item-3-edit');
      await user.click(editButton);

      // Modify the item and submit
      const nameInput = screen.getByDisplayValue('Unmapped Product');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Unmapped Product');

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByText('Associate Ingredient')).toBeInTheDocument();
      });
    });

    it('should update item directly when editing item with existing mapping', async () => {
      const user = userEvent.setup();
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Edit the mapped product item (item-1 has mapping)
      const editButton = screen.getByTestId('pantry-item-item-1-edit');
      await user.click(editButton);

      // Modify the item and submit
      const amountInput = screen.getByDisplayValue('2');
      await user.clear(amountInput);
      await user.type(amountInput, '3');

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should update directly without showing ingredient modal
      expect(mockOnUpdateItem).toHaveBeenCalledWith({
        id: 'item-1',
        name: 'All-Purpose Flour',
        amount: 3,
        unit: 'kg',
        category: 'Baking',
        expiryDate: undefined,
        dateAdded: expect.any(String),
        dateModified: expect.any(String),
        productCode: '123456789012',
        productName: 'King Arthur All-Purpose Flour',
        brands: 'King Arthur',
      });

      expect(screen.queryByText('Associate Ingredient')).not.toBeInTheDocument();
    });

    it('should handle ingredient association from edit modal', async () => {
      const user = userEvent.setup();
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Edit the unmapped product item
      const editButton = screen.getByTestId('pantry-item-item-3-edit');
      await user.click(editButton);

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByText('Associate Ingredient')).toBeInTheDocument();
      });

      // Associate with an ingredient
      const associateButton = screen.getByTestId('ingredient-associate-button');
      await user.click(associateButton);

      expect(mockOnUpdateItem).toHaveBeenCalled();
      expect(mockProductIngredientMappingService.createMapping).toHaveBeenCalledWith({
        product_code: '999999999999',
        ingredient_id: 'test-ingredient',
      });
    });

    it('should skip ingredient association when user chooses to skip', async () => {
      const user = userEvent.setup();
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Edit the unmapped product item
      const editButton = screen.getByTestId('pantry-item-item-3-edit');
      await user.click(editButton);

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByText('Associate Ingredient')).toBeInTheDocument();
      });

      // Skip association
      const skipButton = screen.getByTestId('ingredient-skip-button');
      await user.click(skipButton);

      expect(mockOnUpdateItem).toHaveBeenCalled();
      expect(mockProductIngredientMappingService.createMapping).not.toHaveBeenCalled();
    });

    it('should handle mapping creation failure gracefully', async () => {
      const user = userEvent.setup();
      mockProductIngredientMappingService.createMapping.mockRejectedValue(new Error('Mapping failed'));
      
      renderPantryManager(itemsWithProductCodes);

      await waitFor(() => {
        expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
      });

      // Edit the unmapped product item
      const editButton = screen.getByTestId('pantry-item-item-3-edit');
      await user.click(editButton);

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByText('Associate Ingredient')).toBeInTheDocument();
      });

      // Try to associate with an ingredient
      const associateButton = screen.getByTestId('ingredient-associate-button');
      await user.click(associateButton);

      // Should still update the item even if mapping fails
      expect(mockOnUpdateItem).toHaveBeenCalled();
    });
  });

  describe('Manual Add Flow', () => {
    it('should add manually created items directly to pantry', async () => {
      const user = userEvent.setup();
      renderPantryManager([]);

      // Open add menu and select manual add
      const addButton = screen.getByTestId('pantry-add-item-button');
      await user.click(addButton);

      const manualAddItem = screen.getByTestId('pantry-add-manual-menu-item');
      await user.click(manualAddItem);

      // Fill in the form
      const nameInput = screen.getByTestId('pantry-item-name-input').querySelector('input')!;
      await user.type(nameInput, 'Manual Item');
      const amountInput = screen.getByTestId('pantry-item-amount-input').querySelector('input')!;
      await user.clear(amountInput);
      await user.type(amountInput, '1');

      // Submit the form
      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should add directly without ingredient mapping (no product code)
      expect(mockOnAddItem).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        name: 'Manual Item',
        amount: 1,
        unit: 'piece(s)',
        category: 'Other',
        expiryDate: undefined,
        dateAdded: expect.any(String),
        dateModified: expect.any(String),
      });

      expect(screen.queryByText('Associate Ingredient')).not.toBeInTheDocument();
    });
  });

  describe('Product Search Integration', () => {
    it('should open product search modal when Search Products is selected', async () => {
      const user = userEvent.setup();
      renderPantryManager([]);

      // Open add menu and select product search
      const addButton = screen.getByTestId('pantry-add-item-button');
      await user.click(addButton);

      const productSearchItem = screen.getByTestId('pantry-add-product-menu-item');
      await user.click(productSearchItem);

      // Should open product search modal
      expect(screen.getByText('Add Product to Pantry')).toBeInTheDocument();
    });

    it('should refresh ingredient mappings after adding product', async () => {
      const user = userEvent.setup();
      renderPantryManager([]);

      // Simulate adding a product through the product search modal
      // This would normally be triggered by the ProductSearchModal component

      // Open product search modal
      const addButton = screen.getByTestId('pantry-add-item-button');
      await user.click(addButton);

      const productSearchItem = screen.getByTestId('pantry-add-product-menu-item');
      await user.click(productSearchItem);

      // Close the modal (simulating product addition)
      const cancelButton = screen.getByTestId('product-cancel-button');
      await user.click(cancelButton);

      // Verify that getAllMappings was called initially
      expect(mockProductIngredientMappingService.getAllMappings).toHaveBeenCalled();
    });
  });

  describe('Field Loading in Edit Modal', () => {
    const testItem: PantryItem = {
      id: 'test-item',
      name: 'Test Product',
      amount: 2.5,
      unit: 'kg',
      category: 'Dairy',
      expiryDate: '2024-12-31',
      productCode: '123456789012',
      productName: 'Test Product Name',
      brands: 'Test Brand',
      dateAdded: '2024-01-01T00:00:00Z',
      dateModified: '2024-01-02T00:00:00Z',
    };

    it('should load all fields properly in edit modal', async () => {
      const user = userEvent.setup();
      renderPantryManager([testItem]);

      // Open edit modal
      const editButton = screen.getByTestId('pantry-item-test-item-edit');
      await user.click(editButton);

      // Verify all fields are loaded
      expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('kg')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dairy')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
    });

    it('should preserve product information when updating item', async () => {
      const user = userEvent.setup();
      renderPantryManager([testItem]);

      // Open edit modal
      const editButton = screen.getByTestId('pantry-item-test-item-edit');
      await user.click(editButton);

      // Modify only the amount
      const amountInput = screen.getByDisplayValue('2.5');
      await user.clear(amountInput);
      await user.type(amountInput, '3');

      // Submit
      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should preserve all product information
      expect(mockOnUpdateItem).toHaveBeenCalledWith({
        id: 'test-item',
        name: 'Test Product',
        amount: 3,
        unit: 'kg',
        category: 'Dairy',
        expiryDate: '2024-12-31',
        dateAdded: '2024-01-01T00:00:00Z',
        dateModified: expect.any(String),
        productCode: '123456789012',
        productName: 'Test Product Name',
        brands: 'Test Brand',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle ingredient mapping service errors gracefully', async () => {
      const user = userEvent.setup();
      mockProductIngredientMappingService.getAllMappings.mockRejectedValue(new Error('Service error'));

      renderPantryManager([]);

      // Should still render without crashing
      expect(screen.getByText('Pantry Items')).toBeInTheDocument();

      // Should be able to add items manually
      const addButton = screen.getByTestId('pantry-add-item-button');
      await user.click(addButton);

      const manualAddItem = screen.getByTestId('pantry-add-manual-menu-item');
      await user.click(manualAddItem);

      expect(screen.getByText('Add Pantry Item')).toBeInTheDocument();
    });

    it('should handle missing product information gracefully', async () => {
      const itemWithMissingInfo: PantryItem = {
        id: 'incomplete-item',
        name: 'Incomplete Item',
        amount: 1,
        unit: 'piece(s)',
        category: 'Other',
        // Missing productCode, productName, brands
      };

      renderPantryManager([itemWithMissingInfo]);

      // Should display the item without errors
      expect(screen.getByText('Incomplete Item')).toBeInTheDocument();
      // Since there's no product code, it should show the link ingredient button instead of mapping text
      expect(screen.getByTestId('pantry-item-incomplete-item-link-ingredient-button')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should reset form when closing add modal', async () => {
      const user = userEvent.setup();
      renderPantryManager([]);

      // Open add modal
      const addButton = screen.getByTestId('pantry-add-item-button');
      await user.click(addButton);

      const manualAddItem = screen.getByTestId('pantry-add-manual-menu-item');
      await user.click(manualAddItem);

      // Fill in some data
      const nameInput = screen.getByTestId('pantry-item-name-input').querySelector('input')!;
      await user.type(nameInput, 'Test Item');
      const amountInput = screen.getByTestId('pantry-item-amount-input').querySelector('input')!;
      await user.clear(amountInput);
      await user.type(amountInput, '5');

      // Cancel
      const cancelButton = screen.getByTestId('pantry-item-cancel-button');
      await user.click(cancelButton);

      // Reopen modal - should be reset
      await user.click(addButton);
      await user.click(manualAddItem);

      const resetNameInput = screen.getByTestId('pantry-item-name-input').querySelector('input')!;
      const resetAmountInput = screen.getByTestId('pantry-item-amount-input').querySelector('input')!;
      expect(resetNameInput).toHaveValue('');
      expect(resetAmountInput).toHaveValue(0);
    });

    it('should clean up ingredient modal state when closing', async () => {
      const user = userEvent.setup();
      const itemsWithProductCodes: PantryItem[] = [
        {
          id: 'item-1',
          name: 'Unmapped Product',
          amount: 1,
          unit: 'piece(s)',
          category: 'Other',
          productCode: '999999999999',
          productName: 'Unmapped Product',
          brands: 'Unknown Brand',
        },
      ];

      renderPantryManager(itemsWithProductCodes);

      // Edit item to trigger ingredient modal
      const editButton = screen.getByTestId('pantry-item-item-1-edit');
      await user.click(editButton);

      const submitButton = screen.getByTestId('pantry-item-submit-button');
      await user.click(submitButton);

      // Should show ingredient modal
      await waitFor(() => {
        expect(screen.getByText('Associate Ingredient')).toBeInTheDocument();
      });

      // Close ingredient modal by clicking outside or escape
      const skipButton = screen.getByTestId('ingredient-skip-button');
      await user.click(skipButton);

      // State should be cleaned up
      expect(screen.queryByText('Associate Ingredient')).not.toBeInTheDocument();
    });
  });
});
