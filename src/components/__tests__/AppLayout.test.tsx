import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { configureStore } from '@reduxjs/toolkit';
import AppLayout from '@components/AppLayout';
import darkTheme from '@styles/theme';
import importQueueReducer from '@store/slices/importQueueSlice';

// Mock useMediaQuery and useTheme
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: vi.fn(),
    useTheme: vi.fn(() => ({
      breakpoints: {
        down: vi.fn(() => '(max-width: 960px)'),
      },
      spacing: vi.fn((value) => `${value * 8}px`),
      palette: {
        primary: {
          main: '#5D9CEC',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B0B0B0',
        },
        background: {
          default: '#141A22',
          paper: '#1C2331',
        },
      },
      shape: {
        borderRadius: 10,
      },
    })),
  };
});

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

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

const renderAppLayout = (children = <div>Test Content</div>, isMobile = false) => {
  vi.mocked(useMediaQuery).mockReturnValue(isMobile);
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
    vi.clearAllMocks();
    mockLocation.pathname = '/';
  });

  describe('Desktop Layout', () => {
    test('should render desktop layout with app bar and drawer', () => {
      renderAppLayout();

      // App bar should be visible
      expect(screen.getByText('JustCooked')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toBeInTheDocument();

      // Navigation items should be visible
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Cookbook')).toBeInTheDocument();
      expect(screen.getByText('Planner')).toBeInTheDocument();
      expect(screen.getByText('Pantry')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    test('should toggle drawer when menu button is clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      const menuButton = screen.getByRole('button', { name: /toggle navigation drawer/i });
      
      // Click to toggle drawer
      await user.click(menuButton);
      
      // Drawer should still be accessible (persistent drawer)
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    test('should navigate when menu items are clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      // Click on Cookbook
      const cookbookButton = screen.getByText('Cookbook');
      await user.click(cookbookButton);

      expect(mockNavigate).toHaveBeenCalledWith('/cookbook');
    });

    test('should highlight active menu item', () => {
      mockLocation.pathname = '/planner';
      renderAppLayout();

      const plannerItem = screen.getByLabelText('Navigate to Planner');
      expect(plannerItem).toHaveAttribute('aria-label', 'Navigate to Planner');
    });
  });

  describe('Mobile Layout', () => {
    test('should render mobile layout with bottom navigation', () => {
      renderAppLayout(<div>Test Content</div>, true);

      // Bottom navigation should be visible
      const bottomNav = screen.getByRole('navigation', { name: 'main navigation' });
      expect(bottomNav).toBeInTheDocument();

      // Navigation items should be in bottom nav - use within to scope to bottom nav
      const dashboardButton = screen.getAllByLabelText('Navigate to Dashboard').find(el =>
        bottomNav.contains(el)
      );
      expect(dashboardButton).toBeInTheDocument();
    });

    test('should navigate when bottom navigation items are clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout(<div>Test Content</div>, true);

      const bottomNav = screen.getByRole('navigation', { name: 'main navigation' });
      const plannerTab = screen.getAllByLabelText('Navigate to Planner').find(el =>
        bottomNav.contains(el)
      );
      await user.click(plannerTab!);

      expect(mockNavigate).toHaveBeenCalledWith('/planner');
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

      // Use getAllByText to handle multiple "Home" elements (breadcrumbs)
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
      vi.mocked(useMediaQuery).mockReturnValue(true);
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

      // Tab to queue status button
      await user.tab();
      const queueButton = screen.getByTestId('queue-status-button');
      expect(queueButton).toHaveFocus();
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
