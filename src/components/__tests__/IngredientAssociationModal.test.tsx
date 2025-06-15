import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import IngredientAssociationModal from '../IngredientAssociationModal';
import { IngredientDatabase } from '@app-types/ingredientDatabase';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

const mockIngredients: IngredientDatabase[] = [
  {
    id: '1',
    name: 'All-purpose flour',
    category: 'Baking',
    aliases: ['flour', 'white flour'],
    date_added: '2024-01-01T00:00:00Z',
    date_modified: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Granulated sugar',
    category: 'Baking',
    aliases: ['sugar', 'white sugar'],
    date_added: '2024-01-01T00:00:00Z',
    date_modified: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Whole milk',
    category: 'Dairy',
    aliases: ['milk'],
    date_added: '2024-01-01T00:00:00Z',
    date_modified: '2024-01-01T00:00:00Z',
  },
];

describe('IngredientAssociationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAssociate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue(mockIngredients);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
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
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal('flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'flour',
        limit: 20,
      });
    });
  });

  it('performs search when user types in search field', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'sugar');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', {
        query: 'sugar',
        limit: 20,
      });
    });
  });

  it('displays search results', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('Search Results (3)')).toBeInTheDocument();
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
      expect(screen.getByText('Granulated sugar')).toBeInTheDocument();
      expect(screen.getByText('Whole milk')).toBeInTheDocument();
    });
  });

  it('allows user to select an ingredient', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    await waitFor(() => {
      expect(screen.getByText('Selected Ingredient')).toBeInTheDocument();
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
      expect(screen.getByText('Category: Baking')).toBeInTheDocument();
    });
  });

  it('enables associate button when ingredient is selected', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    });

    const associateButton = screen.getByTestId('ingredient-associate-button');
    expect(associateButton).toBeDisabled();

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    await waitFor(() => {
      expect(associateButton).not.toBeDisabled();
    });
  });

  it('calls onAssociate with selected ingredient when associate button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    const associateButton = screen.getByTestId('ingredient-associate-button');
    await user.click(associateButton);

    expect(mockOnAssociate).toHaveBeenCalledWith({
      ingredient_id: '1',
      ingredient_name: 'All-purpose flour',
    });
  });

  it('calls onAssociate with null when skip button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();

    const skipButton = screen.getByTestId('ingredient-skip-button');
    await user.click(skipButton);

    expect(mockOnAssociate).toHaveBeenCalledWith(null);
  });

  it('shows loading indicator during search', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    // Make the mock return a promise that doesn't resolve immediately
    const slowPromise = new Promise(resolve => setTimeout(() => resolve(mockIngredients), 100));
    mockInvoke.mockReturnValue(slowPromise);

    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

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
    
    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('Failed to search ingredients. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows no results message when search returns empty', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockInvoke.mockResolvedValue([]);

    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.tripleClick(searchInput);
    await user.type(searchInput, 'nonexistent');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('No ingredients found for "nonexistent". Try a different search term.')).toBeInTheDocument();
    });
  });

  it('clears state when modal is closed', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    
    const searchInput = screen.getByTestId('ingredient-search-input');
    await user.type(searchInput, 'flour');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('All-purpose flour')).toBeInTheDocument();
    });

    const ingredientButton = screen.getByTestId('ingredient-result-1');
    await user.click(ingredientButton);

    // Close modal
    const skipButton = screen.getByTestId('ingredient-skip-button');
    await user.click(skipButton);

    expect(mockOnAssociate).toHaveBeenCalledWith(null);
  });
});
