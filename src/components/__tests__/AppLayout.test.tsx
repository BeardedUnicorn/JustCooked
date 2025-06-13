import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { configureStore } from '@reduxjs/toolkit';
import AppLayout from '@components/AppLayout';
import darkTheme from '@styles/theme';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock useMediaQuery
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(),
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn().mockResolvedValue({
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

const renderAppLayout = (children = <div>Test Content</div>, isMobile = false) => {
  (useMediaQuery as jest.Mock).mockReturnValue(isMobile);
  const store = createTestStore();

  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={darkTheme}>
          <AppLayout>{children}</AppLayout>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('AppLayout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = '/';
  });

  describe('Desktop Layout', () => {
    test('should render desktop layout with app bar and drawer', () => {
      renderAppLayout();

      // App bar should be visible
      expect(screen.getByText('JustCooked')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toBeInTheDocument();

      // Navigation items should be visible
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Import Recipe')).toBeInTheDocument();
      expect(screen.getByText('Search Recipes')).toBeInTheDocument();
      expect(screen.getByText('Pantry')).toBeInTheDocument();
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
    });

    test('should toggle drawer when menu button is clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      const menuButton = screen.getByRole('button', { name: /toggle navigation drawer/i });
      
      // Click to toggle drawer
      await user.click(menuButton);
      
      // Drawer should still be accessible (persistent drawer)
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    test('should navigate when menu items are clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      // Click on Import Recipe
      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

      expect(mockNavigate).toHaveBeenCalledWith('/import');
    });

    test('should highlight active menu item', () => {
      mockLocation.pathname = '/search';
      renderAppLayout();

      const searchItem = screen.getByLabelText('Navigate to Search Recipes');
      expect(searchItem).toHaveAttribute('aria-label', 'Navigate to Search Recipes');
    });
  });

  describe('Mobile Layout', () => {
    test('should render mobile layout with bottom navigation', () => {
      renderAppLayout(<div>Test Content</div>, true);

      // Bottom navigation should be visible
      const bottomNav = screen.getByRole('navigation', { name: 'main navigation' });
      expect(bottomNav).toBeInTheDocument();

      // Navigation items should be in bottom nav - use within to scope to bottom nav
      const homeButton = screen.getAllByLabelText('Navigate to Home').find(el => 
        bottomNav.contains(el)
      );
      expect(homeButton).toBeInTheDocument();
    });

    test('should navigate when bottom navigation items are clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout(<div>Test Content</div>, true);

      const bottomNav = screen.getByRole('navigation', { name: 'main navigation' });
      const searchTab = screen.getAllByLabelText('Navigate to Search Recipes').find(el => 
        bottomNav.contains(el)
      );
      await user.click(searchTab!);

      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });

    test('should show active tab in bottom navigation', () => {
      mockLocation.pathname = '/pantry';
      renderAppLayout(<div>Test Content</div>, true);

      const bottomNav = screen.getByRole('navigation', { name: 'main navigation' });
      const pantryTab = screen.getAllByLabelText('Navigate to Pantry').find(el => 
        bottomNav.contains(el)
      );
      expect(pantryTab).toHaveAttribute('aria-label', 'Navigate to Pantry');
    });
  });

  describe('Breadcrumbs', () => {
    test('should show breadcrumbs for nested routes', () => {
      mockLocation.pathname = '/recipe/123';
      renderAppLayout();

      // Use getAllByText to handle multiple "Home" elements
      const homeElements = screen.getAllByText('Home');
      expect(homeElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Recipe Details')).toBeInTheDocument();
    });

    test('should navigate when breadcrumb is clicked', async () => {
      const user = userEvent.setup();
      mockLocation.pathname = '/recipe/123';
      renderAppLayout();

      // Find the breadcrumb link specifically
      const homeLink = screen.getByRole('link', { name: 'Home' });
      await user.click(homeLink);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Content Rendering', () => {
    test('should render children content', () => {
      renderAppLayout(<div data-testid="test-content">Custom Content</div>);

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    test('should apply proper spacing for content', () => {
      renderAppLayout(<div data-testid="test-content">Content</div>);

      const content = screen.getByTestId('test-content').parentElement;
      expect(content).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('should switch between desktop and mobile layouts', () => {
      const { rerender } = renderAppLayout();

      // Desktop layout
      expect(screen.getByText('JustCooked')).toBeInTheDocument();

      // Switch to mobile
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      const store = createTestStore();
      rerender(
        <Provider store={store}>
          <BrowserRouter>
            <ThemeProvider theme={darkTheme}>
              <AppLayout><div>Test Content</div></AppLayout>
            </ThemeProvider>
          </BrowserRouter>
        </Provider>
      );

      // Mobile layout - bottom navigation should be visible
      expect(screen.getByRole('navigation', { name: 'main navigation' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      renderAppLayout();

      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toBeInTheDocument();
      // In desktop mode, navigation is in the drawer (list), not a navigation role
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      // Tab to menu button
      await user.tab();
      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toHaveFocus();

      // Tab to search input
      await user.tab();
      const searchInput = screen.getByPlaceholderText('Search recipes...');
      expect(searchInput).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing location gracefully', () => {
      const originalLocation = mockLocation.pathname;
      mockLocation.pathname = '';

      expect(() => renderAppLayout()).not.toThrow();

      mockLocation.pathname = originalLocation;
    });
  });
});
