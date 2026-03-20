import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import DatabaseManagementSection from '../DatabaseManagementSection';
import { databaseManagementService } from '@services/databaseManagement';

// Mock the database management service
vi.mock('@services/databaseManagement', () => ({
  databaseManagementService: {
    exportDatabase: vi.fn(),
    importDatabase: vi.fn(),
    resetDatabase: vi.fn(),
    repairIngredientCatalog: vi.fn(),
    repairRecipeIngredientsFromRaw: vi.fn(),
    formatIngredientCatalogRepairResult: vi.fn(),
    formatRecipeIngredientRepairResult: vi.fn(),
    formatImportResult: vi.fn(),
  },
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}));

const mockDatabaseManagementService = vi.mocked(databaseManagementService);

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DatabaseManagementSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders database management section with all buttons', () => {
    renderWithTheme(<DatabaseManagementSection />);

    expect(screen.getByText('Database Management')).toBeInTheDocument();
    expect(screen.getByTestId('dbManagement-button-export')).toBeInTheDocument();
    expect(screen.getByTestId('dbManagement-button-import')).toBeInTheDocument();
    expect(screen.getByTestId('dbManagement-button-reset')).toBeInTheDocument();
    expect(screen.getByTestId('dbManagement-button-repair-ingredients')).toBeInTheDocument();
    expect(screen.getByTestId('dbManagement-button-repair-recipe-ingredients')).toBeInTheDocument();
  });

  it('handles export database successfully', async () => {
    mockDatabaseManagementService.exportDatabase.mockResolvedValue();

    renderWithTheme(<DatabaseManagementSection />);

    const exportButton = screen.getByTestId('dbManagement-button-export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.exportDatabase).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
      expect(screen.getByText('Database exported successfully!')).toBeInTheDocument();
    });
  });

  it('handles export database error', async () => {
    const errorMessage = 'Export failed';
    mockDatabaseManagementService.exportDatabase.mockRejectedValue(new Error(errorMessage));

    renderWithTheme(<DatabaseManagementSection />);

    const exportButton = screen.getByTestId('dbManagement-button-export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows import confirmation dialog when import button is clicked', async () => {
    renderWithTheme(<DatabaseManagementSection />);

    const importButton = screen.getByTestId('dbManagement-button-import');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-import-confirm-dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Import Database' })).toBeInTheDocument();
    });
  });

  it('handles import database with merge option', async () => {
    const mockResult = {
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

    mockDatabaseManagementService.importDatabase.mockResolvedValue(mockResult);
    mockDatabaseManagementService.formatImportResult.mockReturnValue('Successfully imported: 5 recipes, 10 ingredients, 3 pantry items, 2 collections, 1 searches');

    renderWithTheme(<DatabaseManagementSection />);

    const importButton = screen.getByTestId('dbManagement-button-import');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-import-confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('database-import-confirm-dialog-confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.importDatabase).toHaveBeenCalledWith(false);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
    });
  });

  it('handles import database with replace option', async () => {
    const mockResult = {
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

    mockDatabaseManagementService.importDatabase.mockResolvedValue(mockResult);
    mockDatabaseManagementService.formatImportResult.mockReturnValue('Successfully imported: 5 recipes, 10 ingredients, 3 pantry items, 2 collections, 1 searches');

    renderWithTheme(<DatabaseManagementSection />);

    // Toggle replace existing option
    const replaceSwitch = screen.getByTestId('dbManagement-switch-replaceExisting');
    fireEvent.click(replaceSwitch);

    const importButton = screen.getByTestId('dbManagement-button-import');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-import-confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('database-import-confirm-dialog-confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.importDatabase).toHaveBeenCalledWith(true);
    });
  });

  it('shows reset confirmation dialog when reset button is clicked', async () => {
    renderWithTheme(<DatabaseManagementSection />);

    const resetButton = screen.getByTestId('dbManagement-button-reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-reset-confirm-dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Reset Database' })).toBeInTheDocument();
    });
  });

  it('handles reset database successfully', async () => {
    mockDatabaseManagementService.resetDatabase.mockResolvedValue();

    renderWithTheme(<DatabaseManagementSection />);

    const resetButton = screen.getByTestId('dbManagement-button-reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-reset-confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('database-reset-confirm-dialog-confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.resetDatabase).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
      expect(screen.getByText('Database reset successfully! All data has been cleared.')).toBeInTheDocument();
    });
  });

  it('handles reset database error', async () => {
    const errorMessage = 'Reset failed';
    mockDatabaseManagementService.resetDatabase.mockRejectedValue(new Error(errorMessage));

    renderWithTheme(<DatabaseManagementSection />);

    const resetButton = screen.getByTestId('dbManagement-button-reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByTestId('database-reset-confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('database-reset-confirm-dialog-confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles ingredient catalog repair successfully', async () => {
    mockDatabaseManagementService.repairIngredientCatalog.mockResolvedValue({
      scanned: 12,
      updated: 7,
      merged: 3,
      removed: 4,
    });
    mockDatabaseManagementService.formatIngredientCatalogRepairResult.mockReturnValue(
      'Ingredient catalog repaired: scanned 12, updated 7, merged 3, removed 4.'
    );

    renderWithTheme(<DatabaseManagementSection />);

    const repairButton = screen.getByTestId('dbManagement-button-repair-ingredients');
    fireEvent.click(repairButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.repairIngredientCatalog).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
      expect(screen.getByText('Ingredient catalog repaired: scanned 12, updated 7, merged 3, removed 4.')).toBeInTheDocument();
    });
  });

  it('handles recipe ingredient repair successfully', async () => {
    mockDatabaseManagementService.repairRecipeIngredientsFromRaw.mockResolvedValue({
      recipes_scanned: 12,
      recipes_updated: 3,
      ingredients_repaired: 5,
      recipes_skipped: 1,
      missing_raw_batches: 2,
    });
    mockDatabaseManagementService.formatRecipeIngredientRepairResult.mockReturnValue(
      'Recipe ingredients repaired from raw captures: scanned 12 recipes, updated 3, repaired 5 ingredients, skipped 1, missing raw batches for 2.'
    );

    renderWithTheme(<DatabaseManagementSection />);

    const repairButton = screen.getByTestId('dbManagement-button-repair-recipe-ingredients');
    fireEvent.click(repairButton);

    await waitFor(() => {
      expect(mockDatabaseManagementService.repairRecipeIngredientsFromRaw).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dbManagement-alert-success')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Recipe ingredients repaired from raw captures: scanned 12 recipes, updated 3, repaired 5 ingredients, skipped 1, missing raw batches for 2.'
        )
      ).toBeInTheDocument();
    });
  });

  it('disables buttons during loading states', async () => {
    mockDatabaseManagementService.exportDatabase.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    renderWithTheme(<DatabaseManagementSection />);

    const exportButton = screen.getByTestId('dbManagement-button-export');
    const importButton = screen.getByTestId('dbManagement-button-import');
    const resetButton = screen.getByTestId('dbManagement-button-reset');

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(exportButton).toBeDisabled();
      expect(importButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });
  });
});
