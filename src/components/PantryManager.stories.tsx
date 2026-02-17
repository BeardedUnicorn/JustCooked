import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import PantryManager from './PantryManager';
import { ProductIngredientMappingService } from '@services/productIngredientMappingService';
import { mockPantryItems } from '@/__tests__/fixtures/recipes';
import { PantryItem, ProductIngredientMapping } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetAllMappingsImplementation = fn().mockResolvedValue([]);
let mockGetMappingImplementation = fn().mockResolvedValue(null);
let mockCreateMappingImplementation = fn().mockResolvedValue(null);
let mockDeleteMappingImplementation = fn().mockResolvedValue(undefined);

// Mock the ProductIngredientMappingService for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    ProductIngredientMappingService: {
      getAllMappings: mockGetAllMappingsImplementation,
      getMapping: mockGetMappingImplementation,
      createMapping: mockCreateMappingImplementation,
      deleteMapping: mockDeleteMappingImplementation,
    },
  };
}

// Mock ProductSearchModal for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_COMPONENT_MOCKS__ = {
    ProductSearchModal: function MockProductSearchModal({
      open,
      onClose,
      onAddProduct,
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
          <button
            data-testid="product-add-button"
            onClick={() => {
              onAddProduct({
                id: 'mock-product-123',
                name: 'Mock Product',
                amount: 1,
                unit: 'piece(s)',
                category: 'Other',
                productCode: '123456789012',
                productName: 'Mock Product Name',
                brands: 'Mock Brand',
              });
            }}
          >
            Add Product
          </button>
        </div>
      );
    },
  };
}

// Mock IngredientAssociationModal for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_COMPONENT_MOCKS__ = {
    ...window.__STORYBOOK_COMPONENT_MOCKS__,
    IngredientAssociationModal: function MockIngredientAssociationModal({
      open,
      onClose,
      onAssociate,
      productName,
    }: {
      open: boolean;
      onClose: () => void;
      onAssociate: (association: any) => void;
      productName: string;
    }) {
      if (!open) return null;
      return (
        <div data-testid="ingredient-association-modal">
          <h2>Associate Ingredient for {productName}</h2>
          <button data-testid="ingredient-skip-button" onClick={() => onAssociate(null)}>
            Skip Association
          </button>
          <button
            data-testid="ingredient-associate-button"
            onClick={() => {
              onAssociate({
                ingredient_id: 'ingredient-1',
                ingredient_name: 'All-purpose flour',
              });
            }}
          >
            Associate Ingredient
          </button>
        </div>
      );
    },
  };
}

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123',
  },
});

// Extended pantry items with product codes for testing
const mockPantryItemsWithProductCodes: PantryItem[] = [
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

// Mock ingredient mappings
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

const meta: Meta<typeof PantryManager> = {
  title: 'Components/PantryManager',
  component: PantryManager,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'The PantryManager component handles pantry item management including adding, editing, deleting items, and managing ingredient associations.',
      },
    },
  },
  argTypes: {
    onAddItem: { action: 'item added' },
    onUpdateItem: { action: 'item updated' },
    onDeleteItem: { action: 'item deleted' },
  },
  args: {
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PantryManager>;

export const EmptyPantry: Story = {
  args: {
    items: [],
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty pantry state with no items.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify empty state message
    await expect(canvas.getByTestId('pantryManager-emptyState-container')).toBeInTheDocument();
    await expect(canvas.getByText('Your pantry is empty. Add some items to get started!')).toBeInTheDocument();
    
    // Verify Add Item button is present
    await expect(canvas.getByTestId('pantry-add-item-button')).toBeInTheDocument();
  },
};

export const WithItems: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry with basic items (no product codes or ingredient mappings).',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify items are displayed
    await expect(canvas.getByText('Flour')).toBeInTheDocument();
    await expect(canvas.getByText('Sugar')).toBeInTheDocument();

    // Verify category headers
    await expect(canvas.getByTestId('pantryManager-header-category-baking')).toBeInTheDocument();
  },
};

export const WithMappedIngredients: Story = {
  args: {
    items: mockPantryItemsWithProductCodes,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry items with product codes that have corresponding ingredient mappings.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue(mockIngredientMappings);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for mappings to load
    await expect(canvas.getByText('All-Purpose Flour')).toBeInTheDocument();

    // Verify ingredient mapping is displayed
    await expect(canvas.getByTestId('pantry-item-item-1-ingredient-mapping')).toBeInTheDocument();
    await expect(canvas.getByText('Ingredient: All-purpose flour')).toBeInTheDocument();
  },
};

export const WithUnmappedIngredients: Story = {
  args: {
    items: mockPantryItemsWithProductCodes,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry items with product codes but no ingredient mappings, showing link ingredient buttons.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to load
    await expect(canvas.getByText('All-Purpose Flour')).toBeInTheDocument();

    // Verify link ingredient buttons are shown for items with product codes but no mappings
    await expect(canvas.getByTestId('pantry-item-item-1-link-ingredient-button')).toBeInTheDocument();
    await expect(canvas.getByTestId('pantry-item-item-3-link-ingredient-button')).toBeInTheDocument();
  },
};

export const AddItemDialogOpen: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry manager with the Add Item dialog open for manual entry.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Add Item button to open menu
    const addButton = canvas.getByTestId('pantry-add-item-button');
    await userEvent.click(addButton);

    // Verify menu is open
    await expect(canvas.getByTestId('pantry-add-menu')).toBeInTheDocument();

    // Click Add Manually option
    const addManuallyOption = canvas.getByTestId('pantry-add-manual-menu-item');
    await userEvent.click(addManuallyOption);

    // Verify dialog is open
    await expect(canvas.getByText('Add Pantry Item')).toBeInTheDocument();
    await expect(canvas.getByTestId('pantry-item-name-input')).toBeInTheDocument();
  },
};

export const EditItemDialogOpen: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry manager with the Edit Item dialog open with pre-filled data.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to load
    await expect(canvas.getByText('Flour')).toBeInTheDocument();

    // Click edit button for first item
    const editButton = canvas.getByTestId('pantry-item-pantry-1-edit');
    await userEvent.click(editButton);

    // Verify dialog is open with pre-filled data
    await expect(canvas.getByText('Edit Pantry Item')).toBeInTheDocument();

    // Verify form is pre-filled
    const nameInput = canvas.getByTestId('pantry-item-name-input').querySelector('input')!;
    await expect(nameInput).toHaveValue('Flour');

    const amountInput = canvas.getByTestId('pantry-item-amount-input').querySelector('input')!;
    await expect(amountInput).toHaveValue('5');
  },
};

export const ProductSearchModalOpen: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry manager with the Product Search modal open.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Add Item button to open menu
    const addButton = canvas.getByTestId('pantry-add-item-button');
    await userEvent.click(addButton);

    // Click Search Products option
    const searchProductsOption = canvas.getByTestId('pantry-add-product-menu-item');
    await userEvent.click(searchProductsOption);

    // Verify Product Search modal is open
    await expect(canvas.getByTestId('product-search-modal')).toBeInTheDocument();
    await expect(canvas.getByText('Add Product to Pantry')).toBeInTheDocument();
  },
};

export const IngredientAssociationModalOpen: Story = {
  args: {
    items: mockPantryItemsWithProductCodes,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pantry manager with the Ingredient Association modal open for linking ingredients.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);
    mockCreateMappingImplementation = fn().mockResolvedValue(null);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for items to load
    await expect(canvas.getByText('Unmapped Product')).toBeInTheDocument();

    // Click link ingredient button for unmapped item
    const linkButton = canvas.getByTestId('pantry-item-item-3-link-ingredient-button');
    await userEvent.click(linkButton);

    // Verify Ingredient Association modal is open
    await expect(canvas.getByTestId('ingredient-association-modal')).toBeInTheDocument();
    await expect(canvas.getByText('Associate Ingredient for Unmapped Product')).toBeInTheDocument();
  },
};

// Interaction Tests
export const AddManualItemInteraction: Story = {
  args: {
    items: [],
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Test the complete flow of adding a manual item.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Open Add Item menu
    const addButton = canvas.getByTestId('pantry-add-item-button');
    await userEvent.click(addButton);

    // Select Add Manually
    const addManuallyOption = canvas.getByTestId('pantry-add-manual-menu-item');
    await userEvent.click(addManuallyOption);

    // Fill form
    const nameInput = canvas.getByTestId('pantry-item-name-input').querySelector('input')!;
    await userEvent.type(nameInput, 'Test Item');

    const amountInput = canvas.getByTestId('pantry-item-amount-input').querySelector('input')!;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '2');

    // Submit form
    const submitButton = canvas.getByTestId('pantry-item-submit-button');
    await userEvent.click(submitButton);

    // Verify onAddItem was called
    await expect(args.onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Item',
        amount: 2,
        unit: 'piece(s)',
        category: 'Other',
      })
    );
  },
};

export const EditItemInteraction: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Test editing an existing pantry item.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for items to load
    await expect(canvas.getByText('Flour')).toBeInTheDocument();

    // Click edit button
    const editButton = canvas.getByTestId('pantry-item-pantry-1-edit');
    await userEvent.click(editButton);

    // Modify amount
    const amountInput = canvas.getByTestId('pantry-item-amount-input').querySelector('input')!;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '10');

    // Submit form
    const submitButton = canvas.getByTestId('pantry-item-submit-button');
    await userEvent.click(submitButton);

    // Verify onUpdateItem was called
    await expect(args.onUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pantry-1',
        name: 'Flour',
        amount: 10,
      })
    );
  },
};

export const DeleteItemInteraction: Story = {
  args: {
    items: mockPantryItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Test deleting a pantry item.',
      },
    },
  },
  beforeEach: () => {
    // Reset mock implementations
    mockGetAllMappingsImplementation = fn().mockResolvedValue([]);

    // Update window mocks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__STORYBOOK_SERVICE_MOCKS__ = {
        ProductIngredientMappingService: {
          getAllMappings: mockGetAllMappingsImplementation,
          getMapping: mockGetMappingImplementation,
          createMapping: mockCreateMappingImplementation,
          deleteMapping: mockDeleteMappingImplementation,
        },
      };
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for items to load
    await expect(canvas.getByText('Flour')).toBeInTheDocument();

    // Click delete button
    const deleteButton = canvas.getByTestId('pantry-item-pantry-1-delete');
    await userEvent.click(deleteButton);

    // Verify onDeleteItem was called
    await expect(args.onDeleteItem).toHaveBeenCalledWith('pantry-1');
  },
};
