import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import SearchBar from './SearchBar';
import { RecentSearch } from '@app-types';

// Browser-compatible mock implementation variables
let mockGetRecentSearchesImplementation = fn().mockResolvedValue([]);
let mockSaveSearchImplementation = fn().mockResolvedValue(undefined);

// Mock the search history service for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    searchHistoryStorage: {
      getRecentSearches: mockGetRecentSearchesImplementation,
      saveSearch: mockSaveSearchImplementation,
    },
  };
}

const meta: Meta<typeof SearchBar> = {
  title: 'Input/SearchBar',
  component: SearchBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onSearch: { action: 'searched' },
    onAdvancedSearch: { action: 'advancedSearchClicked' },
    placeholder: { control: 'text' },
  },
  args: {
    onSearch: fn(),
    onAdvancedSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock recent searches data
const mockRecentSearches: RecentSearch[] = [
  {
    id: '1',
    query: 'chocolate chip cookies',
    filters: {},
    timestamp: '2024-01-15T10:30:00.000Z',
  },
  {
    id: '2',
    query: 'pasta recipes',
    filters: {},
    timestamp: '2024-01-14T15:20:00.000Z',
  },
  {
    id: '3',
    query: 'chicken dinner',
    filters: {},
    timestamp: '2024-01-13T18:45:00.000Z',
  },
];

// Browser-compatible mock configuration function
const configureSearchMocks = (recentSearches: RecentSearch[] = []) => {
  mockGetRecentSearchesImplementation = fn().mockResolvedValue(recentSearches);
  mockSaveSearchImplementation = fn().mockResolvedValue(undefined);

  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      searchHistoryStorage: {
        getRecentSearches: mockGetRecentSearchesImplementation,
        saveSearch: mockSaveSearchImplementation,
      },
    };
  }
};

// Default Story: Basic search bar
export const Default: Story = {
  args: {
    placeholder: 'Search recipes...',
  },
  beforeEach: () => {
    configureSearchMocks([]);
  },
};

// With Placeholder Story: Custom placeholder
export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Find your favorite recipes...',
  },
  beforeEach: () => {
    configureSearchMocks([]);
  },
};

// With Advanced Search Button Story: Showcasing the advanced search button
export const WithAdvancedSearch: Story = {
  args: {
    placeholder: 'Search recipes...',
    onAdvancedSearch: fn(),
  },
  beforeEach: () => {
    configureSearchMocks([]);
  },
};

// With Recent Searches Story: Mock getRecentSearches to return mock RecentSearch[]
export const WithRecentSearches: Story = {
  args: {
    placeholder: 'Search recipes...',
  },
  beforeEach: () => {
    configureSearchMocks(mockRecentSearches);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Focus input to show popover
    const searchInput = canvas.getByTestId('search-bar-input').querySelector('input')!;
    await userEvent.click(searchInput);
    
    // Wait for popover to appear
    await expect(canvas.getByText('Recent Searches')).toBeInTheDocument();
    
    // Click a history item
    const historyItem = canvas.getByTestId('search-history-item-0');
    await userEvent.click(historyItem);
    
    // Verify onSearch is called with history item's query
    await expect(args.onSearch).toHaveBeenCalledWith('chocolate chip cookies');
  },
};

// Interaction Test: Type text, press Enter, verify onSearch is called
export const InteractionTestEnterKey: Story = {
  args: {
    placeholder: 'Search recipes...',
  },
  beforeEach: () => {
    configureSearchMocks([]);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Type text in search input
    const searchInput = canvas.getByTestId('search-bar-input').querySelector('input')!;
    await userEvent.type(searchInput, 'pizza recipes');

    // Press Enter
    await userEvent.keyboard('{Enter}');

    // Verify onSearch is called
    await expect(args.onSearch).toHaveBeenCalledWith('pizza recipes');
  },
};

// Interaction Test: Type text, click clear button, verify input clears and onSearch('') is called
export const InteractionTestClearButton: Story = {
  args: {
    placeholder: 'Search recipes...',
  },
  beforeEach: () => {
    configureSearchMocks([]);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Type text in search input
    const searchInput = canvas.getByTestId('search-bar-input').querySelector('input')!;
    await userEvent.type(searchInput, 'test search');

    // Click clear button
    const clearButton = canvas.getByTestId('search-clear-button');
    await userEvent.click(clearButton);

    // Verify input is cleared
    await expect(searchInput).toHaveValue('');

    // Verify onSearch is called with empty string
    await expect(args.onSearch).toHaveBeenCalledWith('');
  },
};
