import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from '../App';
import * as recipeStorage from '@services/recipeStorage';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock the recipe storage for Home page
vi.mock('@services/recipeStorage');
const mockGetAllRecipes = vi.mocked(recipeStorage.getAllRecipes);

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    tasks: [],
    currentTaskId: null,
    isProcessing: false,
    totalPending: 0,
    totalCompleted: 0,
    totalFailed: 0,
  }),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      importQueue: importQueueReducer,
    },
  });
};

describe('App', () => {
  beforeEach(() => {
    mockGetAllRecipes.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    // Assuming Home renders something, or check for a common element
    // For example, if there is a header or something
    // From AppLayout, there is 'JustCooked'
    expect(screen.getByText('JustCooked')).toBeInTheDocument();
  });
});
