import type { Meta, StoryObj } from '@storybook/react';
import Settings from './Settings';

// Browser-compatible component mocks
const configureComponentMocks = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_COMPONENT_MOCKS__ = {
      DatabaseManagementSection: () => (
        <div data-testid="mock-database-management-section">
          <h3>Database Management</h3>
          <p>Export, import, or reset your recipe database.</p>
          <button data-testid="database-export-button">Export Database</button>
          <button data-testid="database-import-button">Import Database</button>
          <button data-testid="database-reset-button">Reset Database</button>
        </div>
      ),
      LoggingSection: () => (
        <div data-testid="mock-logging-section">
          <h3>Logging</h3>
          <p>View and manage application logs.</p>
          <input
            data-testid="log-directory-path-field"
            value="/test/logs"
            readOnly
            placeholder="Log directory path"
          />
          <button data-testid="open-log-directory-button">Open Log Folder</button>
          <button data-testid="copy-log-path-button">Copy Path</button>
        </div>
      ),
    };
  }
};

// Initialize mocks
configureComponentMocks();

const meta: Meta<typeof Settings> = {
  title: 'Pages/Settings',
  component: Settings,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The Settings page provides access to application configuration options including database management and logging controls. This page serves as a layout container for various settings sections.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default view showing all settings sections
export const DefaultView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The default settings page layout showing all available configuration sections. Each section is implemented as a separate component with its own detailed functionality.',
      },
    },
  },
};

// Story focused on layout structure
export const LayoutStructure: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the overall layout structure of the settings page, including the header, description, and section organization.',
      },
    },
  },
};

// Story for responsive behavior
export const ResponsiveLayout: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Shows how the settings page adapts to smaller screen sizes while maintaining usability and readability.',
      },
    },
  },
};

// Story demonstrating accessibility features
export const AccessibilityFeatures: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'heading-order',
            enabled: true,
          },
        ],
      },
    },
    docs: {
      description: {
        story: 'Highlights the accessibility features of the settings page including proper heading hierarchy, semantic structure, and keyboard navigation support.',
      },
    },
  },
};
