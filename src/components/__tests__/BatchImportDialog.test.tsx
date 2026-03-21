import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import BatchImportDialog from '@components/BatchImportDialog';
import importQueueReducer from '@store/slices/importQueueSlice';

import { batchImportService } from '@services/batchImport';
import { reImportService } from '@services/reImportService';
import { getExistingRecipeUrls } from '@services/recipeStorage';

vi.mock('@services/batchImport');
vi.mock('@services/reImportService');
vi.mock('@services/recipeStorage');

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockBatchImportService = vi.mocked(batchImportService);
const mockReImportService = vi.mocked(reImportService);
const mockGetExistingRecipeUrls = vi.mocked(getExistingRecipeUrls);
const mockInvoke = vi.mocked(invoke);

const createTestStore = () =>
  configureStore({
    reducer: {
      importQueue: importQueueReducer,
    },
  });

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onTaskAdded: vi.fn(),
};

const renderWithRedux = (props = defaultProps) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BatchImportDialog {...props} />
    </Provider>
  );
};

const siteValidation = (url: string, site: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (site === 'allrecipes') {
      return host.includes('allrecipes.com') && path.includes('/recipes/') && !path.includes('/recipe/');
    }
    if (site === 'americasTestKitchen') {
      return host.includes('americastestkitchen.com') && path.includes('/recipes/');
    }
    if (site === 'seriousEats') {
      return (
        host.includes('seriouseats.com') &&
        (path === '/' || path === '/sitemap.xml' || /^\/all-recipes-\d+\/?$/.test(path))
      );
    }
    if (site === 'bonAppetit') {
      return host.includes('bonappetit.com') && (path === '/recipes' || path === '/recipes/');
    }
  } catch {
    return false;
  }

  return false;
};

describe('BatchImportDialog', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    mockBatchImportService.getQuickStartPacks.mockReturnValue([
      {
        id: 'pack-a',
        name: 'Pack A',
        description: 'Pack A description',
        estimatedRecipes: 120,
        urls: ['https://www.allrecipes.com/recipes/79/desserts', 'https://www.allrecipes.com/recipes/76/appetizers-and-snacks'],
      },
      {
        id: 'pack-b',
        name: 'Pack B',
        description: 'Pack B description',
        estimatedRecipes: 80,
        urls: ['https://www.allrecipes.com/recipes/78/breakfast-and-brunch'],
      },
    ]);

    mockBatchImportService.getSuggestedCategoryUrls.mockReturnValue([
      {
        name: 'Desserts',
        url: 'https://www.allrecipes.com/recipes/79/desserts',
        description: 'Dessert recipes',
      },
      {
        name: 'Serious Eats All Recipes',
        url: 'https://www.seriouseats.com/',
        description: 'Serious Eats index',
      },
    ]);

    mockBatchImportService.validateUrlForSite.mockImplementation(siteValidation as any);
    mockBatchImportService.detectSiteFromUrl.mockImplementation((url: string) => {
      if (siteValidation(url, 'allrecipes')) return 'allrecipes';
      if (siteValidation(url, 'americasTestKitchen')) return 'americasTestKitchen';
      if (siteValidation(url, 'seriousEats')) return 'seriousEats';
      if (siteValidation(url, 'bonAppetit')) return 'bonAppetit';
      return null;
    });

    mockBatchImportService.getImportPreflight.mockResolvedValue({
      startUrl: 'https://www.allrecipes.com/recipes/79/desserts',
      estimatedCategories: 12,
      estimatedRecipes: 180,
      estimatedDuplicates: 20,
      estimatedNewRecipes: 160,
      estimatedEtaMinMinutes: 8,
      estimatedEtaMaxMinutes: 15,
      warnings: [],
    });

    mockReImportService.getReImportableRecipesCount.mockResolvedValue(42);
    mockReImportService.getTaskDescription.mockReturnValue('Re-import all existing recipes');
    mockReImportService.addToQueue.mockResolvedValue('reimport-task-1');

    mockGetExistingRecipeUrls.mockResolvedValue([]);

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'add_to_import_queue') {
        return Promise.resolve('task-123');
      }
      if (command === 'get_import_queue_status') {
        return Promise.resolve({
          tasks: [],
          currentTaskId: null,
          isProcessing: false,
          totalPending: 0,
          totalCompleted: 0,
          totalFailed: 0,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  test('renders mode cards and switches between modes', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    expect(screen.getByText('Choose Import Type')).toBeInTheDocument();
    expect(screen.getByTestId('batchImportDialog-card-mode-url')).toBeInTheDocument();

    await user.click(screen.getByTestId('batchImportDialog-card-mode-reImport'));
    expect(screen.getByText(/Re-import updates existing recipes/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('batchImportDialog-card-mode-quickStart'));
    expect(screen.getByText(/Curated packs are grouped category URLs/i)).toBeInTheDocument();
  });

  test('blocks invalid URL and keeps queue action disabled', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    const queueButton = screen.getByTestId('batchImportDialog-button-addToQueue');

    await user.type(urlInput, 'https://example.com/recipes');

    expect(screen.getByText('Use a valid AllRecipes listing URL.')).toBeInTheDocument();
    expect(queueButton).toBeDisabled();
  });

  test('runs debounced preflight and shows preview panel', async () => {
    const user = userEvent.setup();
    renderWithRedux();

    const urlInput = screen.getByLabelText('Category URL');
    await user.type(urlInput, 'https://www.allrecipes.com/recipes/79/desserts');

    await waitFor(() => {
      expect(mockBatchImportService.getImportPreflight).toHaveBeenCalled();
    });

    expect(screen.getByTestId('batchImportDialog-preflight-panel')).toBeInTheDocument();
    expect(screen.getByText('Import Preview')).toBeInTheDocument();
  });

  test('requires confirmation for large URL imports and queues after confirmation', async () => {
    const user = userEvent.setup();
    mockBatchImportService.getImportPreflight.mockResolvedValueOnce({
      startUrl: 'https://www.allrecipes.com/recipes/79/desserts',
      estimatedCategories: 60,
      estimatedRecipes: 500,
      estimatedDuplicates: 40,
      estimatedNewRecipes: 460,
      estimatedEtaMinMinutes: 20,
      estimatedEtaMaxMinutes: 45,
      warnings: ['This import is large and may run for a while.'],
    });

    renderWithRedux();

    await user.type(screen.getByLabelText('Category URL'), 'https://www.allrecipes.com/recipes/79/desserts');

    await waitFor(() => {
      expect(screen.getByTestId('batchImportDialog-preflight-panel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-addToQueue'));

    expect(screen.getByText('Confirm large URL import')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Queue Anyway' }));

    await waitFor(() => {
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  test('shows retryable warning when re-import count load fails', async () => {
    const user = userEvent.setup();
    mockReImportService.getReImportableRecipesCount
      .mockRejectedValueOnce(new Error('Count fetch failed'))
      .mockResolvedValueOnce(42);

    renderWithRedux();

    await user.click(screen.getByTestId('batchImportDialog-card-mode-reImport'));

    await waitFor(() => {
      expect(screen.getByTestId('batchImportDialog-reimport-error')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('42 recipes available for re-import')).toBeInTheDocument();
    });
  });

  test('requires confirmation for large re-import queue requests', async () => {
    const user = userEvent.setup();
    mockReImportService.getReImportableRecipesCount.mockResolvedValueOnce(420);

    renderWithRedux();

    await user.click(screen.getByTestId('batchImportDialog-card-mode-reImport'));
    await waitFor(() => {
      expect(screen.getByText('420 recipes available for re-import')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-addToQueue'));
    expect(screen.getByText('Confirm large re-import')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Queue Anyway' }));
    await waitFor(() => {
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });
  });

  test('requires confirmation for quick-start selections above URL threshold', async () => {
    const user = userEvent.setup();

    mockBatchImportService.getQuickStartPacks.mockReturnValue([
      {
        id: 'pack-one',
        name: 'Pack One',
        description: 'One',
        estimatedRecipes: 400,
        urls: Array.from({ length: 13 }, (_, i) => `https://www.allrecipes.com/recipes/${100 + i}/one`),
      },
      {
        id: 'pack-two',
        name: 'Pack Two',
        description: 'Two',
        estimatedRecipes: 350,
        urls: Array.from({ length: 13 }, (_, i) => `https://www.allrecipes.com/recipes/${300 + i}/two`),
      },
    ]);

    renderWithRedux();

    await user.click(screen.getByTestId('batchImportDialog-card-mode-quickStart'));
    await user.click(screen.getByTestId('batchImportDialog-pack-pack-one'));
    await user.click(screen.getByTestId('batchImportDialog-pack-pack-two'));
    await user.click(screen.getByTestId('batchImportDialog-button-addToQueue'));

    expect(screen.getByText('Confirm quick-start workload')).toBeInTheDocument();
  });

  test('queued state supports Open Queue, Queue Another, and Done actions', async () => {
    const user = userEvent.setup();
    const openQueueSpy = vi.fn();

    renderWithRedux({ ...defaultProps, onOpenQueue: openQueueSpy });

    await user.type(screen.getByLabelText('Category URL'), 'https://www.allrecipes.com/recipes/79/desserts');

    await waitFor(() => {
      expect(screen.getByTestId('batchImportDialog-preflight-panel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-addToQueue'));

    await waitFor(() => {
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-openQueue'));
    expect(openQueueSpy).toHaveBeenCalled();

    await user.click(screen.getByTestId('batchImportDialog-button-queueAnother'));
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Category URL'), 'https://www.allrecipes.com/recipes/79/desserts');
    await waitFor(() => {
      expect(screen.getByTestId('batchImportDialog-preflight-panel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-addToQueue'));
    await waitFor(() => {
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('batchImportDialog-button-done'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('exposes an aria-live region for status announcements', () => {
    renderWithRedux();
    expect(document.querySelector('[aria-live=\"polite\"]')).toBeInTheDocument();
  });
});
