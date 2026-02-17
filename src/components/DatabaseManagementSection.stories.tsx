import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import DatabaseManagementSection from './DatabaseManagementSection';
import { DatabaseImportResult } from '@app-types';

// Browser-compatible mock implementation variables
let mockExportDatabaseImplementation = fn().mockResolvedValue(undefined);
let mockImportDatabaseImplementation = fn().mockResolvedValue({});
let mockResetDatabaseImplementation = fn().mockResolvedValue(undefined);
let mockFormatImportResultImplementation = fn().mockReturnValue('Import completed successfully');

// Mock the database management service for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    databaseManagementService: {
      exportDatabase: mockExportDatabaseImplementation,
      importDatabase: mockImportDatabaseImplementation,
      resetDatabase: mockResetDatabaseImplementation,
      formatImportResult: mockFormatImportResultImplementation,
    },
  };
}

// Mock Tauri APIs for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__TAURI__ = {
    core: {
      invoke: fn().mockImplementation(async (command: string, ...args: any[]) => {
        console.log('[Storybook Mock Invoke]', command, args);
        return Promise.resolve(undefined);
      })
    },
    fs: {
      writeTextFile: fn().mockResolvedValue(undefined),
      readTextFile: fn().mockResolvedValue('{}'),
    },
    dialog: {
      save: fn().mockResolvedValue('/path/to/export.json'),
      open: fn().mockResolvedValue(['/path/to/import.json']),
    },
  };
}

const meta: Meta<typeof DatabaseManagementSection> = {
  title: 'Sections/DatabaseManagementSection',
  component: DatabaseManagementSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Database management section for exporting, importing, and resetting the recipe database.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DatabaseManagementSection>;

// Browser-compatible mock configuration function
const setupMocks = (config: {
  exportDatabase?: any;
  importDatabase?: any;
  resetDatabase?: any;
  formatImportResult?: any;
} = {}) => {
  mockExportDatabaseImplementation = config.exportDatabase || fn().mockResolvedValue(undefined);
  mockImportDatabaseImplementation = config.importDatabase || fn().mockResolvedValue({});
  mockResetDatabaseImplementation = config.resetDatabase || fn().mockResolvedValue(undefined);
  mockFormatImportResultImplementation = config.formatImportResult || fn().mockReturnValue('Import completed successfully');

  // Update service mocks
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      databaseManagementService: {
        exportDatabase: mockExportDatabaseImplementation,
        importDatabase: mockImportDatabaseImplementation,
        resetDatabase: mockResetDatabaseImplementation,
        formatImportResult: mockFormatImportResultImplementation,
      },
    };
  }
};

// Mock data for import results
const mockImportResult: DatabaseImportResult = {
  recipes_imported: 5,
  recipes_failed: 0,
  ingredients_imported: 10,
  ingredients_failed: 0,
  pantry_items_imported: 3,
  pantry_items_failed: 0,
  collections_imported: 2,
  collections_failed: 0,
  searches_imported: 1,
  searches_failed: 0,
  raw_ingredients_imported: 0,
  raw_ingredients_failed: 0,
  errors: [],
};

const mockImportResultWithErrors: DatabaseImportResult = {
  ...mockImportResult,
  recipes_failed: 2,
  ingredients_failed: 1,
  errors: ['Failed to import recipe: Invalid format', 'Failed to import ingredient: Duplicate entry'],
};

export const DefaultState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default state showing all database management options.',
      },
    },
  },
  beforeEach: () => {
    setupMocks();
  },
};

export const ExportLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Export operation in progress with loading state.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      exportDatabase: fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportButton = canvas.getByTestId('dbManagement-button-export');
    
    await userEvent.click(exportButton);
    
    // Verify loading state
    await expect(canvas.getByTestId('dbManagement-loading-export')).toBeInTheDocument();
    await expect(exportButton).toBeDisabled();
    await expect(canvas.getByText('Exporting...')).toBeInTheDocument();
  },
};

export const ExportSuccess: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Successful export with success message displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      exportDatabase: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportButton = canvas.getByTestId('dbManagement-button-export');
    
    await userEvent.click(exportButton);
    
    // Wait for success message
    await expect(canvas.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
    await expect(canvas.getByText('Database exported successfully!')).toBeInTheDocument();
  },
};

export const ExportError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Export operation failed with error message displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      exportDatabase: fn().mockRejectedValue(
        new Error('Failed to export database')
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportButton = canvas.getByTestId('dbManagement-button-export');
    
    await userEvent.click(exportButton);
    
    // Wait for error message
    await expect(canvas.getByTestId('dbManagement-alert-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to export database')).toBeInTheDocument();
  },
};

export const ImportLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Import operation in progress with loading state.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      importDatabase: fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockImportResult), 5000))
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const importButton = canvas.getByTestId('dbManagement-button-import');
    
    await userEvent.click(importButton);
    
    // Confirm import
    const confirmButton = canvas.getByTestId('database-import-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Verify loading state
    await expect(canvas.getByTestId('dbManagement-loading-import')).toBeInTheDocument();
    await expect(importButton).toBeDisabled();
    await expect(canvas.getByText('Importing...')).toBeInTheDocument();
  },
};

export const ImportSuccess: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Successful import with formatted results displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      importDatabase: fn().mockResolvedValue(mockImportResult),
      formatImportResult: fn().mockReturnValue(
        'Successfully imported: 5 recipes, 10 ingredients, 3 pantry items, 2 collections, 1 searches'
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const importButton = canvas.getByTestId('dbManagement-button-import');
    
    await userEvent.click(importButton);
    
    // Confirm import
    const confirmButton = canvas.getByTestId('database-import-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Wait for success message
    await expect(canvas.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
    await expect(canvas.getByText(/Successfully imported:/)).toBeInTheDocument();
  },
};

export const ImportError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Import operation failed with error message displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      importDatabase: fn().mockRejectedValue(
        new Error('Failed to import database')
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const importButton = canvas.getByTestId('dbManagement-button-import');
    
    await userEvent.click(importButton);
    
    // Confirm import
    const confirmButton = canvas.getByTestId('database-import-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Wait for error message
    await expect(canvas.getByTestId('dbManagement-alert-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to import database')).toBeInTheDocument();
  },
};

export const ResetLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Reset operation in progress with loading state.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      resetDatabase: fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resetButton = canvas.getByTestId('dbManagement-button-reset');
    
    await userEvent.click(resetButton);
    
    // Confirm reset
    const confirmButton = canvas.getByTestId('database-reset-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Verify loading state
    await expect(canvas.getByTestId('dbManagement-loading-reset')).toBeInTheDocument();
    await expect(resetButton).toBeDisabled();
    await expect(canvas.getByText('Resetting...')).toBeInTheDocument();
  },
};

export const ResetSuccess: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Successful reset with success message displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      resetDatabase: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resetButton = canvas.getByTestId('dbManagement-button-reset');
    
    await userEvent.click(resetButton);
    
    // Confirm reset
    const confirmButton = canvas.getByTestId('database-reset-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);
    
    // Wait for success message
    await expect(canvas.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
    await expect(canvas.getByText('Database reset successfully! All data has been cleared.')).toBeInTheDocument();
  },
};

export const ResetError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Reset operation failed with error message displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      resetDatabase: fn().mockRejectedValue(
        new Error('Failed to reset database')
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resetButton = canvas.getByTestId('dbManagement-button-reset');

    await userEvent.click(resetButton);

    // Confirm reset
    const confirmButton = canvas.getByTestId('database-reset-confirm-dialog-confirm-button');
    await userEvent.click(confirmButton);

    // Wait for error message
    await expect(canvas.getByTestId('dbManagement-alert-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to reset database')).toBeInTheDocument();
  },
};

export const ImportConfirmationDialogVisible: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Import confirmation dialog is visible with merge option.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const importButton = canvas.getByTestId('dbManagement-button-import');

    await userEvent.click(importButton);

    // Verify dialog is visible
    await expect(canvas.getByTestId('database-import-confirm-dialog')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Import Database' })).toBeInTheDocument();
    await expect(canvas.getByText(/merge the imported data/)).toBeInTheDocument();
  },
};

export const ImportConfirmationDialogReplaceMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Import confirmation dialog with replace existing option enabled.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First expand the import options accordion
    const accordion = canvas.getByText('Import Options');
    await userEvent.click(accordion);

    // Toggle replace existing switch
    const replaceSwitch = canvas.getByTestId('dbManagement-switch-replaceExisting');
    await userEvent.click(replaceSwitch);

    // Click import button
    const importButton = canvas.getByTestId('dbManagement-button-import');
    await userEvent.click(importButton);

    // Verify dialog shows replace warning
    await expect(canvas.getByTestId('database-import-confirm-dialog')).toBeInTheDocument();
    await expect(canvas.getByText(/delete all existing data/)).toBeInTheDocument();
  },
};

export const ResetConfirmationDialogVisible: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Reset confirmation dialog is visible.',
      },
    },
  },
  beforeEach: () => {
    vi.clearAllMocks();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resetButton = canvas.getByTestId('dbManagement-button-reset');

    await userEvent.click(resetButton);

    // Verify dialog is visible
    await expect(canvas.getByTestId('database-reset-confirm-dialog')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Reset Database' })).toBeInTheDocument();
    await expect(canvas.getByText(/permanently delete all data/)).toBeInTheDocument();
  },
};

export const InteractionTest: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive interaction test covering all major functionality.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      exportDatabase: fn().mockResolvedValue(undefined),
      importDatabase: fn().mockResolvedValue(mockImportResult),
      formatImportResult: fn().mockReturnValue(
        'Successfully imported: 5 recipes, 10 ingredients'
      ),
      resetDatabase: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test export functionality
    const exportButton = canvas.getByTestId('dbManagement-button-export');
    await userEvent.click(exportButton);
    await expect(mockExportDatabaseImplementation).toHaveBeenCalled();

    // Wait for success and clear it by testing import
    await expect(canvas.getByTestId('dbManagement-alert-success')).toBeInTheDocument();

    // Test import functionality with replace option
    const accordion = canvas.getByText('Import Options');
    await userEvent.click(accordion);

    const replaceSwitch = canvas.getByTestId('dbManagement-switch-replaceExisting');
    await userEvent.click(replaceSwitch);

    const importButton = canvas.getByTestId('dbManagement-button-import');
    await userEvent.click(importButton);

    // Confirm import
    const confirmImportButton = canvas.getByTestId('database-import-confirm-dialog-confirm-button');
    await userEvent.click(confirmImportButton);

    await expect(mockImportDatabaseImplementation).toHaveBeenCalledWith(true);

    // Test reset functionality
    const resetButton = canvas.getByTestId('dbManagement-button-reset');
    await userEvent.click(resetButton);

    // Confirm reset
    const confirmResetButton = canvas.getByTestId('database-reset-confirm-dialog-confirm-button');
    await userEvent.click(confirmResetButton);

    await expect(mockResetDatabaseImplementation).toHaveBeenCalled();
  },
};
