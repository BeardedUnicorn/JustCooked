import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateProductDialog, { CreateProductData } from '../CreateProductDialog';

describe('CreateProductDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnCreateProduct = vi.fn();
  const testUpcCode = '123456789012';

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onCreateProduct: mockOnCreateProduct,
    upcCode: testUpcCode,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog when open', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    expect(screen.getByTestId('create-product-dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Product')).toBeInTheDocument();
    expect(screen.getByText(/No product found for UPC code/)).toBeInTheDocument();
    expect(screen.getByText(testUpcCode)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CreateProductDialog {...defaultProps} open={false} />);
    
    expect(screen.queryByTestId('create-product-dialog')).not.toBeInTheDocument();
  });

  it('displays the UPC code in a disabled field', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const upcInput = screen.getByTestId('create-product-upc-input').querySelector('input');
    expect(upcInput).toBeInTheDocument();
    expect(upcInput).toHaveValue(testUpcCode);
    expect(upcInput).toBeDisabled();
  });

  it('has all required form fields', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    expect(screen.getByTestId('create-product-brand-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-product-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-product-expiration-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-product-category-select')).toBeInTheDocument();
  });

  it('shows validation error when brand is empty', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    fireEvent.change(nameInput!, { target: { value: 'Test Product' } });
    
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Brand is required')).toBeInTheDocument();
    });
    
    expect(mockOnCreateProduct).not.toHaveBeenCalled();
  });

  it('shows validation error when product name is empty', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    fireEvent.change(brandInput!, { target: { value: 'Test Brand' } });
    
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Product name is required')).toBeInTheDocument();
    });
    
    expect(mockOnCreateProduct).not.toHaveBeenCalled();
  });

  it('calls onCreateProduct with correct data when form is valid', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    const expirationInput = screen.getByTestId('create-product-expiration-input').querySelector('input');
    
    fireEvent.change(brandInput!, { target: { value: 'Test Brand' } });
    fireEvent.change(nameInput!, { target: { value: 'Test Product' } });
    fireEvent.change(expirationInput!, { target: { value: '2024-12-31' } });
    
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnCreateProduct).toHaveBeenCalledWith({
        code: testUpcCode,
        brand: 'Test Brand',
        product_name: 'Test Product',
        expiration_date: '2024-12-31',
        category: 'Other', // Default category
      });
    });
  });

  it('calls onCreateProduct without expiration date when not provided', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    
    fireEvent.change(brandInput!, { target: { value: 'Test Brand' } });
    fireEvent.change(nameInput!, { target: { value: 'Test Product' } });
    
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnCreateProduct).toHaveBeenCalledWith({
        code: testUpcCode,
        brand: 'Test Brand',
        product_name: 'Test Product',
        expiration_date: undefined,
        category: 'Other',
      });
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const cancelButton = screen.getByTestId('create-product-cancel-button');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('maintains form state when dialog is closed and reopened', async () => {
    const { rerender } = render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    
    fireEvent.change(brandInput!, { target: { value: 'Test Brand' } });
    fireEvent.change(nameInput!, { target: { value: 'Test Product' } });
    
    // Close dialog
    rerender(<CreateProductDialog {...defaultProps} open={false} />);
    
    // Reopen dialog
    rerender(<CreateProductDialog {...defaultProps} open={true} />);
    
    // Form state should be maintained
    expect(screen.getByTestId('create-product-brand-input').querySelector('input')).toHaveValue('Test Brand');
    expect(screen.getByTestId('create-product-name-input').querySelector('input')).toHaveValue('Test Product');
  });

  it('trims whitespace from brand and product name', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    
    fireEvent.change(brandInput!, { target: { value: '  Test Brand  ' } });
    fireEvent.change(nameInput!, { target: { value: '  Test Product  ' } });
    
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnCreateProduct).toHaveBeenCalledWith({
        code: testUpcCode,
        brand: 'Test Brand',
        product_name: 'Test Product',
        expiration_date: undefined,
        category: 'Other',
      });
    });
  });

  it('has category select field', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const categorySelect = screen.getByTestId('create-product-category-select');
    expect(categorySelect).toBeInTheDocument();
    
    // Check that it has the default value
    expect(categorySelect).toHaveTextContent('Other');
  });

  it('defaults to "Other" category', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const categorySelect = screen.getByTestId('create-product-category-select');
    expect(categorySelect).toHaveTextContent('Other');
  });

  it('focuses on brand input when dialog opens', () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    expect(brandInput).toHaveFocus();
  });

  it('clears error when form is resubmitted with valid data', async () => {
    render(<CreateProductDialog {...defaultProps} />);
    
    // Submit with empty brand to trigger error
    const submitButton = screen.getByTestId('create-product-submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Brand is required')).toBeInTheDocument();
    });
    
    // Fill in required fields
    const brandInput = screen.getByTestId('create-product-brand-input').querySelector('input');
    const nameInput = screen.getByTestId('create-product-name-input').querySelector('input');
    
    fireEvent.change(brandInput!, { target: { value: 'Test Brand' } });
    fireEvent.change(nameInput!, { target: { value: 'Test Product' } });
    
    // Submit again
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Brand is required')).not.toBeInTheDocument();
    });
    
    expect(mockOnCreateProduct).toHaveBeenCalled();
  });
});
