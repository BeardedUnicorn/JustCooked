import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProductSearchModal from '../ProductSearchModal';
import { Product, ProductSearchResult, PantryItem } from '@app-types';
import { ProductIngredientMapping } from '@app-types/productIngredientMapping';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

// Mock ProductIngredientMappingService
jest.mock('@services/productIngredientMappingService', () => ({
  ProductIngredientMappingService: {
    getMapping: jest.fn(),
    createMapping: jest.fn(),
  },
}));

const mockGetMapping = require('@services/productIngredientMappingService').ProductIngredientMappingService.getMapping;
const mockCreateMapping = require('@services/productIngredientMappingService').ProductIngredientMappingService.createMapping;

// Mock IngredientAssociationModal
jest.mock('../IngredientAssociationModal', () => {
  return function MockIngredientAssociationModal({ open, onAssociate, onClose, productName }: any) {
    if (!open) return null;
    return (
      <div data-testid="ingredient-association-modal">
        <div>Product: {productName}</div>
        <button 
          onClick={() => onAssociate({ ingredient_id: 'test-ingredient', ingredient_name: 'Test Ingredient' })}
          data-testid="mock-associate-button"
        >
          Associate
        </button>
        <button 
          onClick={() => onAssociate(null)}
          data-testid="mock-skip-button"
        >
          Skip
        </button>
        <button onClick={onClose} data-testid="mock-close-button">Close</button>
      </div>
    );
  };
});

const mockProducts: Product[] = [
  {
    code: '123456789012',
    url: 'http://example.com/product1',
    product_name: 'Test Product 1',
    brands: 'Test Brand',
  },
  {
    code: '123456789013',
    url: 'http://example.com/product2',
    product_name: '', // Empty product name - should be filtered out
    brands: 'Test Brand',
  },
  {
    code: '123456789014',
    url: 'http://example.com/product3',
    product_name: 'Test Product 3',
    brands: 'Test Brand',
  },
];

const mockSearchResult: ProductSearchResult = {
  products: mockProducts,
  total: 3,
};

const mockExistingMapping: ProductIngredientMapping = {
  id: 'mapping-1',
  product_code: '123456789012',
  ingredient_id: 'ingredient-1',
  ingredient_name: 'Existing Ingredient',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('ProductSearchModal - Enhanced Functionality', () => {
  const mockOnClose = jest.fn();
  const mockOnAddProduct = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue(mockSearchResult);
    mockGetMapping.mockResolvedValue(null);
    mockCreateMapping.mockResolvedValue({});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderModal = () => {
    return render(
      <ProductSearchModal
        open={true}
        onClose={mockOnClose}
        onAddProduct={mockOnAddProduct}
      />
    );
  };

  describe('Product filtering', () => {
    it('should filter out products with empty product names', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        // Should only show 2 products (filtered out the one with empty name)
        expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        expect(screen.getByText('Test Product 3')).toBeInTheDocument();
        expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument();
      });
    });
  });

  describe('Ingredient association workflow', () => {
    it('should add product directly when mapping exists', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockGetMapping.mockResolvedValue(mockExistingMapping);
      
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const productButton = screen.getByTestId('product-result-123456789012');
      await user.click(productButton);

      await waitFor(() => {
        expect(screen.getByTestId('product-add-button')).toBeInTheDocument();
      });

      const addButton = screen.getByTestId('product-add-button');
      await user.click(addButton);

      // Should check for existing mapping
      expect(mockGetMapping).toHaveBeenCalledWith('123456789012');
      
      // Should add product directly without showing ingredient modal
      expect(mockOnAddProduct).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Product 1',
        productCode: '123456789012',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show ingredient association modal when no mapping exists', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockGetMapping.mockResolvedValue(null);
      
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const productButton = screen.getByTestId('product-result-123456789012');
      await user.click(productButton);

      await waitFor(() => {
        expect(screen.getByTestId('product-add-button')).toBeInTheDocument();
      });

      const addButton = screen.getByTestId('product-add-button');
      await user.click(addButton);

      // Should check for existing mapping
      expect(mockGetMapping).toHaveBeenCalledWith('123456789012');
      
      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-association-modal')).toBeInTheDocument();
        expect(screen.getByText('Product: Test Product 1')).toBeInTheDocument();
      });
    });

    it('should create mapping and add product when user associates ingredient', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockGetMapping.mockResolvedValue(null);
      
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const productButton = screen.getByTestId('product-result-123456789012');
      await user.click(productButton);

      const addButton = screen.getByTestId('product-add-button');
      await user.click(addButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-association-modal')).toBeInTheDocument();
      });

      // User associates ingredient
      const associateButton = screen.getByTestId('mock-associate-button');
      await user.click(associateButton);

      // Should create mapping
      expect(mockCreateMapping).toHaveBeenCalledWith({
        product_code: '123456789012',
        ingredient_id: 'test-ingredient',
      });

      // Should add product to pantry
      expect(mockOnAddProduct).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Product 1',
        productCode: '123456789012',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should add product without mapping when user skips association', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockGetMapping.mockResolvedValue(null);
      
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const productButton = screen.getByTestId('product-result-123456789012');
      await user.click(productButton);

      const addButton = screen.getByTestId('product-add-button');
      await user.click(addButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-association-modal')).toBeInTheDocument();
      });

      // User skips association
      const skipButton = screen.getByTestId('mock-skip-button');
      await user.click(skipButton);

      // Should not create mapping
      expect(mockCreateMapping).not.toHaveBeenCalled();

      // Should still add product to pantry
      expect(mockOnAddProduct).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Product 1',
        productCode: '123456789012',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle mapping creation failure gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockGetMapping.mockResolvedValue(null);
      mockCreateMapping.mockRejectedValue(new Error('Mapping creation failed'));
      
      renderModal();
      
      const searchInput = screen.getByTestId('product-search-input');
      await user.type(searchInput, 'test');

      // Advance timers to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const productButton = screen.getByTestId('product-result-123456789012');
      await user.click(productButton);

      const addButton = screen.getByTestId('product-add-button');
      await user.click(addButton);

      // Should show ingredient association modal
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-association-modal')).toBeInTheDocument();
      });

      // User associates ingredient
      const associateButton = screen.getByTestId('mock-associate-button');
      await user.click(associateButton);

      // Should attempt to create mapping
      expect(mockCreateMapping).toHaveBeenCalledWith({
        product_code: '123456789012',
        ingredient_id: 'test-ingredient',
      });

      // Should still add product to pantry even if mapping fails
      await waitFor(() => {
        expect(mockOnAddProduct).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Product 1',
          productCode: '123456789012',
        }));
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});
