import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import AppLayout from './AppLayout';
import importQueueReducer from '@store/slices/importQueueSlice';

// Browser-compatible mock implementation variables
let mockUseMediaQueryImplementation = fn().mockReturnValue(false);
let mockNavigateImplementation = fn();
let mockInvokeImplementation = fn().mockResolvedValue(undefined);

// Mock useMediaQuery for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore - Override MUI hook for Storybook
  const originalUseMediaQuery = useMediaQuery;
  // @ts-ignore
  window.__STORYBOOK_MUI_MOCKS__ = {
    useMediaQuery: mockUseMediaQueryImplementation,
  };
}

// Mock Tauri API for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__TAURI__ = {
    core: { invoke: mockInvokeImplementation },
    fs: {},
    dialog: {},
  };
}

// Mock react-router-dom navigation
const mockNavigate = mockNavigateImplementation;

// Redux store creator
const createMockStore = (initialState: any = {}) => {
  return configureStore({
    reducer: {
      importQueue: importQueueReducer,
    },
    preloadedState: {
      importQueue: {
        tasks: [],
        currentTaskId: undefined,
        isProcessing: false,
        totalPending: 0,
        totalCompleted: 0,
        totalFailed: 0,
        loading: false,
        error: null,
        isMonitoring: false,
        ...initialState,
      },
    },
  });
};

const meta: Meta<typeof AppLayout> = {
  title: 'Layout/AppLayout',
  component: AppLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main application layout component with responsive navigation drawer and mobile bottom navigation.',
      },
    },
  },
  decorators: [
    (Story, context) => {
      const store = context.parameters.redux?.store || createMockStore();
      const initialEntries = context.parameters.router?.initialEntries || ['/'];
      const isMobile = context.parameters.viewport?.isMobile || false;

      // Configure mock useMediaQuery based on story parameters
      mockUseMediaQueryImplementation = fn().mockReturnValue(isMobile);
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.__STORYBOOK_MUI_MOCKS__ = {
          useMediaQuery: mockUseMediaQueryImplementation,
        };
      }

      // Configure Tauri mock for import queue status
      mockInvokeImplementation = fn().mockImplementation(async (command) => {
        console.log('[Storybook Mock Invoke]', command);
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

      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.__TAURI__ = {
          core: { invoke: mockInvokeImplementation },
          fs: {},
          dialog: {},
        };
      }

      // Clear navigation mock before each story
      mockNavigateImplementation = fn();

      return (
        <Provider store={store}>
          <MemoryRouter initialEntries={initialEntries}>
            <Story />
          </MemoryRouter>
        </Provider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopView: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Desktop Layout Content</h1>
        <p>This is the main content area in desktop view with the navigation drawer.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/'] },
  },
};

export const MobileView: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Mobile Layout Content</h1>
        <p>This is the main content area in mobile view with bottom navigation.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: true },
    router: { initialEntries: ['/'] },
  },
};

export const DesktopDrawerOpen: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Desktop with Drawer Open</h1>
        <p>The navigation drawer is open by default on desktop.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/'] },
  },
};

export const DesktopDrawerClosed: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Desktop with Drawer Closed</h1>
        <p>The navigation drawer can be toggled closed on desktop.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/'] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find and click the drawer toggle button to close the drawer
    const toggleButton = canvas.getByTestId('navigation-drawer-toggle');
    await userEvent.click(toggleButton);
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Recipe Detail Page</h1>
        <p>This page shows breadcrumbs: Home {'>'} Cookbook {'>'} Recipe</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/cookbook/recipe/123'] },
  },
};

export const CookbookPage: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Cookbook</h1>
        <p>Browse and manage your recipe collection.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/cookbook'] },
  },
};

export const PlannerPage: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Meal Planner</h1>
        <p>Plan your meals and generate shopping lists.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/planner'] },
  },
};

export const PantryPage: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Pantry Manager</h1>
        <p>Track your pantry items and ingredients.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/pantry'] },
  },
};

export const SettingsPage: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Settings</h1>
        <p>Configure your application preferences.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/settings'] },
  },
};

// Interaction tests
export const InteractionTests: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Interactive Layout Test</h1>
        <p>Test navigation and drawer interactions.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: false },
    router: { initialEntries: ['/'] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test desktop drawer toggle
    const toggleButton = canvas.getByTestId('navigation-drawer-toggle');
    await userEvent.click(toggleButton);
    
    // Test navigation via drawer items
    const cookbookButton = canvas.getByTestId('navigation-menu-cookbook');
    await userEvent.click(cookbookButton);
    await expect(mockNavigateImplementation).toHaveBeenCalledWith('/cookbook');

    // Test another navigation
    const pantryButton = canvas.getByTestId('navigation-menu-pantry');
    await userEvent.click(pantryButton);
    await expect(mockNavigateImplementation).toHaveBeenCalledWith('/pantry');
  },
};

export const MobileInteractionTests: Story = {
  args: {
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Mobile Interactive Test</h1>
        <p>Test mobile bottom navigation.</p>
      </div>
    ),
  },
  parameters: {
    viewport: { isMobile: true },
    router: { initialEntries: ['/'] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test mobile bottom navigation
    const bottomNav = canvas.getByTestId('mobile-bottom-navigation');
    expect(bottomNav).toBeInTheDocument();
    
    // Test navigation via bottom nav
    const cookbookBottomButton = canvas.getByTestId('mobile-bottom-nav-cookbook');
    await userEvent.click(cookbookBottomButton);
    await expect(mockNavigateImplementation).toHaveBeenCalledWith('/cookbook');
  },
};
