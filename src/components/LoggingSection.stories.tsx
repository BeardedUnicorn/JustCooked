import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { expect, userEvent, within } from 'storybook/test';
import LoggingSection from './LoggingSection';

// Browser-compatible mock implementation variables
let mockGetLogDirectoryPathImplementation = fn().mockResolvedValue('/test/logs');
let mockOpenLogDirectoryImplementation = fn().mockResolvedValue(undefined);
let mockGetLogFilePathImplementation = fn().mockResolvedValue('/test/logs/justcooked.log');
let mockClipboardWriteTextImplementation = fn().mockResolvedValue(undefined);

// Mock the logging management service for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_SERVICE_MOCKS__ = {
    loggingManagementService: {
      getLogDirectoryPath: mockGetLogDirectoryPathImplementation,
      openLogDirectory: mockOpenLogDirectoryImplementation,
      getLogFilePath: mockGetLogFilePathImplementation,
    },
  };

  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: {
      writeText: mockClipboardWriteTextImplementation,
    },
  });
}

const meta: Meta<typeof LoggingSection> = {
  title: 'Sections/LoggingSection',
  component: LoggingSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Logging section for managing application logs and accessing log directory.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LoggingSection>;

// Browser-compatible mock configuration function
const setupMocks = (config: {
  getLogDirectoryPath?: any;
  openLogDirectory?: any;
  getLogFilePath?: any;
  clipboardWriteText?: any;
} = {}) => {
  mockGetLogDirectoryPathImplementation = config.getLogDirectoryPath || fn().mockResolvedValue(mockLogPath);
  mockOpenLogDirectoryImplementation = config.openLogDirectory || fn().mockResolvedValue(undefined);
  mockGetLogFilePathImplementation = config.getLogFilePath || fn().mockResolvedValue('/test/logs/justcooked.log');
  mockClipboardWriteTextImplementation = config.clipboardWriteText || fn().mockResolvedValue(undefined);

  // Update service mocks
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__STORYBOOK_SERVICE_MOCKS__ = {
      loggingManagementService: {
        getLogDirectoryPath: mockGetLogDirectoryPathImplementation,
        openLogDirectory: mockOpenLogDirectoryImplementation,
        getLogFilePath: mockGetLogFilePathImplementation,
      },
    };

    // Update clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: mockClipboardWriteTextImplementation,
      },
    });
  }
};

// Mock log directory path
const mockLogPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';

export const InitialLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Component loading state while fetching log directory path.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockLogPath), 5000))
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify initial loading state
    await expect(canvas.getByTestId('loggingSection-loading-initial')).toBeInTheDocument();
    await expect(canvas.getByText('Logging')).toBeInTheDocument();
  },
};

export const PathLoaded: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Log directory path successfully loaded and displayed.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    await expect(canvas.getByTestId('log-directory-path-field')).toBeInTheDocument();
    await expect(canvas.getByTestId('open-log-directory-button')).toBeInTheDocument();
    await expect(canvas.getByTestId('copy-log-path-button')).toBeInTheDocument();
  },
};

export const ErrorLoadingPath: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Error state when failing to load log directory path.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockRejectedValue(
        new Error('Failed to get log directory path')
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for error to appear
    await expect(canvas.getByTestId('logging-section-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to get log directory path')).toBeInTheDocument();
  },
};

export const OpenDirectoryLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Loading state when opening log directory.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      openLogDirectory: fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Click open directory button
    const openButton = canvas.getByTestId('open-log-directory-button');
    await userEvent.click(openButton);
    
    // Verify loading state
    await expect(canvas.getByTestId('loggingSection-loading-openDir')).toBeInTheDocument();
    await expect(openButton).toBeDisabled();
    await expect(canvas.getByText('Opening...')).toBeInTheDocument();
  },
};

export const OpenDirectorySuccess: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Successfully opened log directory with success message.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      openLogDirectory: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Click open directory button
    const openButton = canvas.getByTestId('open-log-directory-button');
    await userEvent.click(openButton);
    
    // Wait for success message
    await expect(canvas.getByTestId('logging-section-success')).toBeInTheDocument();
    await expect(canvas.getByText('Log directory opened successfully')).toBeInTheDocument();
  },
};

export const OpenDirectoryError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Error when trying to open log directory.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      openLogDirectory: fn().mockRejectedValue(
        new Error('Failed to open directory')
      ),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Click open directory button
    const openButton = canvas.getByTestId('open-log-directory-button');
    await userEvent.click(openButton);
    
    // Wait for error message
    await expect(canvas.getByTestId('logging-section-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to open directory')).toBeInTheDocument();
  },
};

export const CopyPathSuccess: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Successfully copied log directory path to clipboard.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      clipboardWriteText: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Click copy path button
    const copyButton = canvas.getByTestId('copy-log-path-button');
    await userEvent.click(copyButton);
    
    // Verify clipboard was called
    await expect(mockClipboardWriteTextImplementation).toHaveBeenCalledWith(mockLogPath);
    
    // Wait for success message
    await expect(canvas.getByTestId('logging-section-success')).toBeInTheDocument();
    await expect(canvas.getByText('Log directory path copied to clipboard')).toBeInTheDocument();
  },
};

export const CopyPathError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Error when trying to copy log directory path to clipboard.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      clipboardWriteText: fn().mockRejectedValue(new Error('Clipboard access denied')),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Click copy path button
    const copyButton = canvas.getByTestId('copy-log-path-button');
    await userEvent.click(copyButton);
    
    // Wait for error message
    await expect(canvas.getByTestId('logging-section-error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to copy path to clipboard')).toBeInTheDocument();
  },
};

export const InteractionTest: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive interaction test covering all major functionality.',
      },
    },
  },
  beforeEach: () => {
    setupMocks({
      getLogDirectoryPath: fn().mockResolvedValue(mockLogPath),
      openLogDirectory: fn().mockResolvedValue(undefined),
      clipboardWriteText: fn().mockResolvedValue(undefined),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for path to load
    await expect(canvas.getByDisplayValue(mockLogPath)).toBeInTheDocument();
    
    // Test copy functionality
    const copyButton = canvas.getByTestId('copy-log-path-button');
    await userEvent.click(copyButton);
    await expect(mockClipboardWriteTextImplementation).toHaveBeenCalledWith(mockLogPath);

    // Test open directory functionality
    const openButton = canvas.getByTestId('open-log-directory-button');
    await userEvent.click(openButton);
    await expect(mockOpenLogDirectoryImplementation).toHaveBeenCalled();
    
    // Verify success message appears
    await expect(canvas.getByTestId('logging-section-success')).toBeInTheDocument();
  },
};
