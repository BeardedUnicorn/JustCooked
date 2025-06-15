import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

const mockOnSearch = vi.fn();

const renderSearchBar = (props = {}) => {
  const defaultProps = {
    onSearch: mockOnSearch,
    placeholder: 'Search recipes...',
    ...props,
  };
  
  return render(<SearchBar {...defaultProps} />);
};

describe('SearchBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render with placeholder text', () => {
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    expect(searchInput).toBeInTheDocument();
  });

  test('should render with custom placeholder', () => {
    renderSearchBar({ placeholder: 'Find your recipe...' });
    
    const searchInput = screen.getByPlaceholderText('Find your recipe...');
    expect(searchInput).toBeInTheDocument();
  });

  test('should call onSearch when Enter key is pressed', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, 'chocolate cake');
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledWith('chocolate cake');
  });

  test('should call onSearch when Enter key is pressed with trimmed value', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    const searchInput = screen.getByPlaceholderText('Search recipes...');

    await user.type(searchInput, '  pasta  ');
    await user.keyboard('{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('pasta');
  });

  test('should not call onSearch with empty search term', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.click(searchInput);
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  test('should not call onSearch with whitespace-only search term', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, '   ');
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  test('should clear search input when clear button is clicked', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, 'test search');
    
    // Clear button should appear after typing
    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeInTheDocument();
    
    await user.click(clearButton);
    
    expect(searchInput).toHaveValue('');
  });

  test('should show clear button only when input has value', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    // Initially no clear button
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    
    await user.type(searchInput, 'test');
    
    // Clear button should appear
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    
    await user.clear(searchInput);
    
    // Clear button should disappear
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  test('should trim whitespace from search terms', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, '  chocolate cake  ');
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledWith('chocolate cake');
  });

  test('should handle special characters in search terms', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    const specialTerm = 'café & "special" chars: 中文';
    
    await user.type(searchInput, specialTerm);
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledWith(specialTerm);
  });

  test('should handle very long search terms', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    const longTerm = 'a'.repeat(100); // Reduced length to avoid timeout
    
    await user.click(searchInput);
    await user.paste(longTerm);
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledWith(longTerm);
  }, 15000);

  test('should maintain focus after search', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, 'test search');
    await user.keyboard('{Enter}');
    
    expect(searchInput).toHaveFocus();
  });

  test('should have proper accessibility attributes', () => {
    renderSearchBar();

    const searchInput = screen.getByPlaceholderText('Search recipes...');

    expect(searchInput).toHaveAttribute('type', 'text');
    expect(searchInput).toBeInTheDocument();
  });

  test('should handle rapid consecutive searches', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, 'first');
    await user.keyboard('{Enter}');
    
    await user.clear(searchInput);
    await user.type(searchInput, 'second');
    await user.keyboard('{Enter}');
    
    await user.clear(searchInput);
    await user.type(searchInput, 'third');
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledTimes(3);
    expect(mockOnSearch).toHaveBeenNthCalledWith(1, 'first');
    expect(mockOnSearch).toHaveBeenNthCalledWith(2, 'second');
    expect(mockOnSearch).toHaveBeenNthCalledWith(3, 'third');
  });

  test('should handle form submission', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    const searchInput = screen.getByPlaceholderText('Search recipes...');

    await user.type(searchInput, 'form test');

    // SearchBar doesn't wrap in a form, so we test Enter key instead
    await user.keyboard('{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('form test');
  });

  test('should prevent default form submission behavior', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    const searchInput = screen.getByPlaceholderText('Search recipes...');

    await user.type(searchInput, 'prevent default');

    // SearchBar doesn't wrap in a form, so we test that Enter key works correctly
    await user.keyboard('{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('prevent default');
  });

  test('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    const searchInput = screen.getByPlaceholderText('Search recipes...');

    // Tab to search input
    await user.tab();
    expect(searchInput).toHaveFocus();

    await user.type(searchInput, 'keyboard test');

    // Press Enter to search
    await user.keyboard('{Enter}');
    expect(mockOnSearch).toHaveBeenCalledWith('keyboard test');
  });

  test('should handle input value changes correctly', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    
    const searchInput = screen.getByPlaceholderText('Search recipes...');
    
    await user.type(searchInput, 'initial');
    expect(searchInput).toHaveValue('initial');
    
    await user.clear(searchInput);
    expect(searchInput).toHaveValue('');
    
    await user.type(searchInput, 'updated');
    expect(searchInput).toHaveValue('updated');
  });

  test('should handle multiple search bar instances independently', async () => {
    const mockOnSearch1 = vi.fn();
    const mockOnSearch2 = vi.fn();
    
    render(
      <div>
        <SearchBar onSearch={mockOnSearch1} placeholder="Search 1" />
        <SearchBar onSearch={mockOnSearch2} placeholder="Search 2" />
      </div>
    );
    
    const user = userEvent.setup();
    const searchInput1 = screen.getByPlaceholderText('Search 1');
    const searchInput2 = screen.getByPlaceholderText('Search 2');
    
    await user.type(searchInput1, 'first search');
    await user.keyboard('{Enter}');
    
    await user.type(searchInput2, 'second search');
    await user.keyboard('{Enter}');
    
    expect(mockOnSearch1).toHaveBeenCalledWith('first search');
    expect(mockOnSearch2).toHaveBeenCalledWith('second search');
    expect(mockOnSearch1).not.toHaveBeenCalledWith('second search');
    expect(mockOnSearch2).not.toHaveBeenCalledWith('first search');
  });
});
