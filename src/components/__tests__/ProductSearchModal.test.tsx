import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProductSearchModal from '../ProductSearchModal';
import { Product, ProductSearchResult, PantryItem } from '../../types';

// Mock the Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const { invoke: mockInvoke } = require('@tauri-apps/api/core');

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
  },
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
    product_name: 'Test Product 2',
    brands: 'Another Brand',
  },
];

const mockSearchResult: ProductSearchResult = {
  products: mockProducts,
  total: 2,
};

describe('ProductSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAddProduct = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue(mockSearchResult);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderModal = (open = true) => {
    return render(
      <ProductSearchModal
        open={open}
        onClose={mockOnClose}
        onAddProduct={mockOnAddProduct}
      />
    );
  };

  it('renders when open', () => {
    renderModal();
    expect(screen.getByText('Add Product to Pantry')).toBeInTheDocument();
    expect(screen.getByTestId('product-search-input')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderModal(false);
    expect(screen.queryByText('Add Product to Pantry')).not.toBeInTheDocument();
  });

  it('performs search when user types in search field', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('product-search-input');
    await user.type(searchInput, 'test product');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_products', {
        query: 'test product',
        limit: 10,
      });
    });
  });

  it('displays search results', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('product-search-input');
    await user.type(searchInput, 'test');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('Test Product 2')).toBeInTheDocument();
      expect(screen.getByText('Brand: Test Brand')).toBeInTheDocument();
      expect(screen.getByText('UPC: 123456789012')).toBeInTheDocument();
    });
  });

  it('allows user to select a product', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
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
      expect(screen.getByText('Selected Product')).toBeInTheDocument();
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('Pantry Details')).toBeInTheDocument();
    });
  });

  it('allows user to configure pantry item details', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
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
      expect(screen.getByTestId('product-amount-input')).toBeInTheDocument();
    });

    // Configure amount
    const amountInput = screen.getByTestId('product-amount-input');
    await user.clear(amountInput);
    await user.type(amountInput, '2');

    // Configure unit
    const unitSelect = screen.getByTestId('product-unit-select');
    await user.click(unitSelect);
    const unitOption = screen.getByText('kg');
    await user.click(unitOption);

    // Configure category
    const categorySelect = screen.getByTestId('product-category-select');
    await user.click(categorySelect);
    const categoryOption = screen.getByText('Dairy');
    await user.click(categoryOption);

    // Configure expiry date
    const expiryInput = screen.getByTestId('product-expiry-input');
    await user.type(expiryInput, '2024-12-31');

    expect(amountInput).toHaveValue(2);
    expect(expiryInput).toHaveValue('2024-12-31');
  });

  it('adds product to pantry when user clicks Add to Pantry', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
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

    expect(mockOnAddProduct).toHaveBeenCalledWith({
      id: 'test-uuid-123',
      name: 'Test Product 1',
      amount: 1,
      unit: 'piece(s)',
      category: 'Other',
      expiryDate: undefined,
      dateAdded: expect.any(String),
      dateModified: expect.any(String),
      productCode: '123456789012',
      productName: 'Test Product 1',
      brands: 'Test Brand',
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows user to go back to search results', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
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
      expect(screen.getByTestId('product-back-button')).toBeInTheDocument();
    });

    const backButton = screen.getByTestId('product-back-button');
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
      expect(screen.queryByText('Selected Product')).not.toBeInTheDocument();
    });
  });

  it('shows loading indicator during search', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    // Make the mock return a promise that doesn't resolve immediately
    const slowPromise = new Promise(resolve => setTimeout(() => resolve(mockSearchResult), 100));
    mockInvoke.mockReturnValue(slowPromise);

    renderModal();

    const searchInput = screen.getByTestId('product-search-input');
    await user.type(searchInput, 'test');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    // Should show loading indicator
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Advance timers to resolve the slow promise
    jest.advanceTimersByTime(100);

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('shows error message when search fails', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockInvoke.mockRejectedValue(new Error('Search failed'));

    renderModal();

    const searchInput = screen.getByTestId('product-search-input');
    await user.type(searchInput, 'test');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('Failed to search products. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows no results message when search returns empty', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockInvoke.mockResolvedValue({ products: [], total: 0 });

    renderModal();

    const searchInput = screen.getByTestId('product-search-input');
    await user.type(searchInput, 'nonexistent');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('No products found for "nonexistent". Try a different search term.')).toBeInTheDocument();
    });
  });

  it('closes modal when cancel button is clicked', () => {
    renderModal();
    
    const cancelButton = screen.getByTestId('product-cancel-button');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables add button when no product is selected', () => {
    renderModal();
    
    const addButton = screen.getByTestId('product-add-button');
    expect(addButton).toBeDisabled();
  });

  it('debounces search input', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('product-search-input');

    // Type multiple characters quickly
    await user.type(searchInput, 'test');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    // Should only call search once after debounce delay
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('db_search_products', {
        query: 'test',
        limit: 10,
      });
    });
  });
});
