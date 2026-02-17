import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import ConfirmationDialog from './ConfirmationDialog';

const meta: Meta<typeof ConfirmationDialog> = {
  title: 'Modals/ConfirmationDialog',
  component: ConfirmationDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onConfirm: { action: 'confirmed' },
    severity: {
      control: 'select',
      options: ['warning', 'error', 'info', 'success'],
    },
    confirmColor: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'warning', 'info', 'success'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Story: Basic warning dialog
export const Default: Story = {
  args: {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to perform this action?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    severity: 'warning',
    confirmColor: 'primary',
    loading: false,
    disabled: false,
  },
};

// Error Story: severity="error", confirmColor="error"
export const Error: Story = {
  args: {
    ...Default.args,
    title: 'Delete Item',
    message: 'This action cannot be undone. Are you sure you want to delete this item?',
    severity: 'error',
    confirmColor: 'error',
    confirmText: 'Delete',
  },
};

// Info Story: severity="info", confirmColor="info"
export const Info: Story = {
  args: {
    ...Default.args,
    title: 'Information',
    message: 'This will update your settings. Do you want to continue?',
    severity: 'info',
    confirmColor: 'info',
    confirmText: 'Continue',
  },
};

// Success Story: severity="success", confirmColor="success"
export const Success: Story = {
  args: {
    ...Default.args,
    title: 'Success',
    message: 'Your changes have been saved successfully. Would you like to continue?',
    severity: 'success',
    confirmColor: 'success',
    confirmText: 'Continue',
  },
};

// Loading State Story: loading=true
export const LoadingState: Story = {
  args: {
    ...Default.args,
    title: 'Processing',
    message: 'Please wait while we process your request...',
    loading: true,
  },
};

// Disabled Confirm Story: disabled=true
export const DisabledConfirm: Story = {
  args: {
    ...Default.args,
    title: 'Confirm Action',
    message: 'This action is currently disabled.',
    disabled: true,
  },
};

// Interaction Test: Test clicking cancel button invokes onClose
export const InteractionTestCancel: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Find and click the cancel button
    const cancelButton = canvas.getByTestId('confirmation-dialog-cancel-button');
    await userEvent.click(cancelButton);
    
    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
  },
};

// Interaction Test: Test clicking confirm button invokes onConfirm
export const InteractionTestConfirm: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Find and click the confirm button
    const confirmButton = canvas.getByTestId('confirmation-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Verify onConfirm was called
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};
