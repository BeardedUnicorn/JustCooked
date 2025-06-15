import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import IngredientAssociationModal from '../IngredientAssociationModal';
import { IngredientDatabase } from '../../types/ingredientDatabase';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

const mockIngredients: IngredientDatabase[] = [
  {
    id: '1',
    name: 'All-purpose flour',
    category: 'Baking',
    aliases: ['flour', 'white flour'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Granulated sugar',
    category: 'Baking',
    aliases: ['sugar', 'white sugar'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Whole milk',
    category: 'Dairy',
    aliases: ['milk'],
    dateAdded: '2024-01-01T00:00:00Z',
    dateModified: '2024-01-01T00:00:00Z',
  },
];

describe('IngredientAssociationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAssociate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(mockIngredients);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const renderModal = (productName = 'Test Product') => {
    return render(
      <IngredientAssociationModal
        open={true}
        onClose={mockOnClose}
        onAssociate={mockOnAssociate}
        productName={productName}
      />
    );
  };

  it('renders modal with correct title and product name', () => {
    renderModal('Coca Cola');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Associate "Coca Cola" with an ingredient/)).toBeInTheDocument();
  });

  it('auto-searches based on product name when modal opens', async () => {
    vi.useRealTimers();
    renderModal('flour');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'flour',
        limit: 20,
      });
    }, { timeout: 10000 });
    
    vi.useFakeTimers();
  });

  it('performs search when user types in search field', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();

    // Wait for initial auto-search to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'Test Product',
        limit: 20,
      });
    }, { timeout: 10000 });

    // Clear the mock to test the new search
    mockInvoke.mockClear();

    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'sugar');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'sugar',
        limit: 20,
      });
    }, { timeout: 10000 });
    
    vi.useFakeTimers();
  });

  it('displays search results', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('Search Results (3)')).toBeInTheDocument();
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
      expect(screen.getByText('Granulated sugar')).toBeInTheDocument();
      expect(screen.getByText('Whole milk')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    vi.useFakeTimers();
  });

  it('allows user to select an ingredient', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    }, { timeout: 10000 });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    await waitFor(() => {
      expect(screen.getByText('Selected Ingredient')).toBeInTheDocument();
      expect(screen.getByText('Category: Baking')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    vi.useFakeTimers();
  });

  it('enables associate button when ingredient is selected', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    }, { timeout: 5000 });

    const associateButton = screen.getByTestId('ingredient-associate-button');
    expect(associateButton).toBeDisabled();

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    await waitFor(() => {
      expect(associateButton).not.toBeDisabled();
    }, { timeout: 5000 });
    
    vi.useFakeTimers();
  }, 10000);

  it('calls onAssociate with selected ingredient when associate button is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    }, { timeout: 3000 });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    const associateButton = screen.getByTestId('ingredient-associate-button');
    await user.click(associateButton);

    expect(mockOnAssociate).toHaveBeenCalledWith({
      ingredient_id: '1',
      ingredient_name: 'All-purpose flour',
    });
    
    vi.useFakeTimers();
  }, 8000);

  it('calls onAssociate with null when skip button is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();

    const skipButton = screen.getByTestId('ingredient-skip-button');
    await user.click(skipButton);

    expect(mockOnAssociate).toHaveBeenCalledWith(null);
    
    vi.useFakeTimers();
  }, 3000);

  it('shows loading indicator during search', async () => {
    vi.useRealTimers();
    
    // Make the mock return a promise that doesn't resolve immediately
    let resolvePromise: (value: any) => void;
    const slowPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockInvoke.mockReturnValue(slowPromise);

    const user = userEvent.setup();
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'test');

    // Should show loading indicator
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Resolve the promise
    resolvePromise!(mockIngredients);

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    vi.useFakeTimers();
  }, 8000);

  it('shows error message when search fails', async () => {
    vi.useRealTimers();
    mockInvoke.mockRejectedValue(new Error('Search failed'));

    const user = userEvent.setup();
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('Failed to search ingredients. Please try again.')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    vi.useFakeTimers();
  }, 8000);

  it('shows no results message when search returns empty', async () => {
    vi.useRealTimers();
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No ingredients found for "nonexistent". Try a different search term.')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    vi.useFakeTimers();
  }, 8000);

  it('clears state when modal is closed', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input').querySelector('input')!;
    await user.type(searchInput, 'flour');

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    }, { timeout: 3000 });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    // Close modal
    const skipButton = screen.getByTestId('ingredient-skip-button');
    await user.click(skipButton);

    expect(mockOnAssociate).toHaveBeenCalledWith(null);
    
    vi.useFakeTimers();
  }, 8000);
});
