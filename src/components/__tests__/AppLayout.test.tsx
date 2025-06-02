import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import AppLayout from '@components/AppLayout';
import darkTheme from '@styles/theme';

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

const renderAppLayout = (children = <div>Test Content</div>, isMobile = false) => {
  (useMediaQuery as jest.Mock).mockReturnValue(isMobile);
  
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        <AppLayout>{children}</AppLayout>
      </ThemeProvider>
    </BrowserRouter>
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

      const searchItem = screen.getByText('Search Recipes').closest('button');
      expect(searchItem).toHaveStyle({ color: expect.any(String) });
    });
  });

  describe('Mobile Layout', () => {
    test('should render mobile layout with bottom navigation', () => {
      renderAppLayout(<div>Test Content</div>, true);

      // App bar should be hidden on mobile
      expect(screen.queryByText('JustCooked')).not.toBeInTheDocument();

      // Bottom navigation should be visible
      const bottomNav = screen.getByRole('tablist');
      expect(bottomNav).toBeInTheDocument();

      // Navigation items should be in bottom nav
      expect(screen.getByLabelText('Home')).toBeInTheDocument();
      expect(screen.getByLabelText('Import')).toBeInTheDocument();
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Pantry')).toBeInTheDocument();
      expect(screen.getByLabelText('Ingredients')).toBeInTheDocument();
    });

    test('should navigate when bottom navigation items are clicked', async () => {
      const user = userEvent.setup();
      renderAppLayout(<div>Test Content</div>, true);

      const searchTab = screen.getByLabelText('Search');
      await user.click(searchTab);

      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });

    test('should show active tab in bottom navigation', () => {
      mockLocation.pathname = '/pantry';
      renderAppLayout(<div>Test Content</div>, true);

      const pantryTab = screen.getByLabelText('Pantry');
      expect(pantryTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Breadcrumbs', () => {
    test('should show breadcrumbs for nested routes', () => {
      mockLocation.pathname = '/recipe/123';
      renderAppLayout();

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Recipe')).toBeInTheDocument();
    });

    test('should navigate when breadcrumb is clicked', async () => {
      const user = userEvent.setup();
      mockLocation.pathname = '/recipe/123';
      renderAppLayout();

      const homeLink = screen.getByText('Home');
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
      expect(content).toHaveStyle({ padding: expect.any(String) });
    });
  });

  describe('Responsive Behavior', () => {
    test('should switch between desktop and mobile layouts', () => {
      const { rerender } = renderAppLayout();

      // Desktop layout
      expect(screen.getByText('JustCooked')).toBeInTheDocument();

      // Switch to mobile
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      rerender(
        <BrowserRouter>
          <ThemeProvider theme={darkTheme}>
            <AppLayout><div>Test Content</div></AppLayout>
          </ThemeProvider>
        </BrowserRouter>
      );

      // Mobile layout
      expect(screen.queryByText('JustCooked')).not.toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      renderAppLayout();

      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderAppLayout();

      // Tab to menu button
      await user.tab();
      expect(screen.getByRole('button', { name: /toggle navigation drawer/i })).toHaveFocus();

      // Tab to navigation items
      await user.tab();
      const firstNavItem = screen.getByText('Home').closest('button');
      expect(firstNavItem).toHaveFocus();
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
