import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import CreateProductDialog from './CreateProductDialog';

const meta: Meta<typeof CreateProductDialog> = {
  title: 'Modals/CreateProductDialog',
  component: CreateProductDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onCreateProduct: { action: 'productCreated' },
    open: { control: 'boolean' },
    upcCode: { control: 'text' },
  },
  args: {
    onClose: fn(),
    onCreateProduct: fn(),
    open: true,
    upcCode: '041196912586',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Story: Dialog open with sample UPC code
export const Default: Story = {};

// ValidationError: Simulate error state by triggering validation
export const ValidationErrorBrand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Fill only product name (leave brand empty)
    const productNameInput = canvas.getByTestId('create-product-name-input');
    await userEvent.type(productNameInput, 'Test Product');
    
    // Try to submit
    const submitButton = canvas.getByTestId('create-product-submit-button');
    await userEvent.click(submitButton);
    
    // Verify error appears
    await canvas.findByText('Brand is required');
  },
};

export const ValidationErrorProductName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Fill only brand (leave product name empty)
    const brandInput = canvas.getByTestId('create-product-brand-input');
    await userEvent.type(brandInput, 'Test Brand');
    
    // Try to submit
    const submitButton = canvas.getByTestId('create-product-submit-button');
    await userEvent.click(submitButton);
    
    // Verify error appears
    await canvas.findByText('Product name is required');
  },
};

// Interaction Test: Fill form fields and submit
export const InteractionTestFillAndSubmit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Fill all form fields
    const brandInput = canvas.getByTestId('create-product-brand-input');
    await userEvent.type(brandInput, 'Coca-Cola');
    
    const productNameInput = canvas.getByTestId('create-product-name-input');
    await userEvent.type(productNameInput, 'Classic Coke 12oz Can');
    
    const expirationInput = canvas.getByTestId('create-product-expiration-input');
    await userEvent.type(expirationInput, '2024-12-31');
    
    // Change category
    const categorySelect = canvas.getByTestId('create-product-category-select');
    await userEvent.click(categorySelect);
    const beverageOption = canvas.getByText('Other'); // Keep default for simplicity
    await userEvent.click(beverageOption);
    
    // Submit form
    const submitButton = canvas.getByTestId('create-product-submit-button');
    await userEvent.click(submitButton);
    
    // Verify onCreateProduct was called with correct data
    await expect(args.onCreateProduct).toHaveBeenCalledWith({
      code: '041196912586',
      brand: 'Coca-Cola',
      product_name: 'Classic Coke 12oz Can',
      expiration_date: '2024-12-31',
      category: 'Other',
    });
  },
};

// Interaction Test: Fill form without expiration date
export const InteractionTestWithoutExpiration: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Fill required fields only
    const brandInput = canvas.getByTestId('create-product-brand-input');
    await userEvent.type(brandInput, 'General Mills');
    
    const productNameInput = canvas.getByTestId('create-product-name-input');
    await userEvent.type(productNameInput, 'Cheerios Cereal');
    
    // Submit form
    const submitButton = canvas.getByTestId('create-product-submit-button');
    await userEvent.click(submitButton);
    
    // Verify onCreateProduct was called with correct data (no expiration date)
    await expect(args.onCreateProduct).toHaveBeenCalledWith({
      code: '041196912586',
      brand: 'General Mills',
      product_name: 'Cheerios Cereal',
      expiration_date: undefined,
      category: 'Other',
    });
  },
};

// Interaction Test: Test cancel button
export const InteractionTestCancel: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Fill some fields first
    const brandInput = canvas.getByTestId('create-product-brand-input');
    await userEvent.type(brandInput, 'Test Brand');
    
    // Click cancel button
    const cancelButton = canvas.getByTestId('create-product-cancel-button');
    await userEvent.click(cancelButton);
    
    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
    
    // Verify onCreateProduct was NOT called
    expect(args.onCreateProduct).not.toHaveBeenCalled();
  },
};

// Interaction Test: Test category selection
export const InteractionTestCategorySelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click on category select
    const categorySelect = canvas.getByTestId('create-product-category-select');
    await userEvent.click(categorySelect);
    
    // Verify all category options are available
    expect(canvas.getByText('Produce')).toBeInTheDocument();
    expect(canvas.getByText('Dairy')).toBeInTheDocument();
    expect(canvas.getByText('Meat')).toBeInTheDocument();
    expect(canvas.getByText('Grains')).toBeInTheDocument();
    expect(canvas.getByText('Baking')).toBeInTheDocument();
    expect(canvas.getByText('Spices')).toBeInTheDocument();
    expect(canvas.getByText('Canned Goods')).toBeInTheDocument();
    expect(canvas.getByText('Frozen')).toBeInTheDocument();
    expect(canvas.getByText('Other')).toBeInTheDocument();
    
    // Select a different category
    const dairyOption = canvas.getByText('Dairy');
    await userEvent.click(dairyOption);
    
    // Verify selection
    expect(categorySelect).toHaveTextContent('Dairy');
  },
};

// Interaction Test: Test form validation clearing
export const InteractionTestValidationClearing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Try to submit with empty form to trigger validation error
    const submitButton = canvas.getByTestId('create-product-submit-button');
    await userEvent.click(submitButton);
    
    // Verify error appears
    await canvas.findByText('Brand is required');
    
    // Fill in the required fields
    const brandInput = canvas.getByTestId('create-product-brand-input');
    await userEvent.type(brandInput, 'Test Brand');
    
    const productNameInput = canvas.getByTestId('create-product-name-input');
    await userEvent.type(productNameInput, 'Test Product');
    
    // Submit again
    await userEvent.click(submitButton);
    
    // Verify error is cleared and form submits successfully
    expect(canvas.queryByText('Brand is required')).not.toBeInTheDocument();
    await expect(args.onCreateProduct).toHaveBeenCalled();
  },
};

// Test UPC Code Display
export const UpcCodeDisplay: Story = {
  args: {
    upcCode: '123456789012',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify UPC code is displayed in the description
    expect(canvas.getByText(/No product found for UPC code/)).toBeInTheDocument();
    expect(canvas.getByText('123456789012')).toBeInTheDocument();
    
    // Verify UPC code field is disabled and has the correct value
    const upcInput = canvas.getByTestId('create-product-upc-input');
    expect(upcInput.querySelector('input')).toHaveValue('123456789012');
    expect(upcInput.querySelector('input')).toBeDisabled();
  },
};
