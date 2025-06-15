import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import LoggingSection from '../LoggingSection';
import { loggingManagementService } from '@services/loggingManagement';

// Mock the logging management service
vi.mock('@services/loggingManagement', () => ({
  loggingManagementService: {
    getLogDirectoryPath: vi.fn(),
    openLogDirectory: vi.fn(),
    getLogFilePath: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

const mockLoggingManagementService = loggingManagementService as jest.Mocked<typeof loggingManagementService>;

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('LoggingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset clipboard mock
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders logging section with correct title and description', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);

    renderWithTheme(<LoggingSection />);

    expect(screen.getByText('Logging')).toBeInTheDocument();

    // Wait for the component to load and show the description
    await waitFor(() => {
      expect(screen.getByText('View and manage application logs. Logs are automatically stored with daily rotation and cleanup.')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockLoggingManagementService.getLogDirectoryPath.mockImplementation(() => new Promise(() => {}));

    renderWithTheme(<LoggingSection />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays log directory path after loading', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    expect(screen.getByTestId('log-directory-path-field')).toBeInTheDocument();
    expect(screen.getByTestId('open-log-directory-button')).toBeInTheDocument();
    expect(screen.getByTestId('copy-log-path-button')).toBeInTheDocument();
  });

  it('handles error when loading log directory path', async () => {
    const errorMessage = 'Failed to get log directory';
    mockLoggingManagementService.getLogDirectoryPath.mockRejectedValue(new Error(errorMessage));

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByTestId('logging-section-error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('opens log directory when button is clicked', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);
    mockLoggingManagementService.openLogDirectory.mockResolvedValue();

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const openButton = screen.getByTestId('open-log-directory-button');
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(mockLoggingManagementService.openLogDirectory).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('logging-section-success')).toBeInTheDocument();
      expect(screen.getByText('Log directory opened successfully')).toBeInTheDocument();
    });
  });

  it('handles error when opening log directory', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    const errorMessage = 'Failed to open directory';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);
    mockLoggingManagementService.openLogDirectory.mockRejectedValue(new Error(errorMessage));

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const openButton = screen.getByTestId('open-log-directory-button');
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByTestId('logging-section-error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('copies log directory path to clipboard when copy button is clicked', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('copy-log-path-button');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockPath);
    });

    await waitFor(() => {
      expect(screen.getByTestId('logging-section-success')).toBeInTheDocument();
      expect(screen.getByText('Log directory path copied to clipboard')).toBeInTheDocument();
    });
  });

  it('handles error when copying to clipboard', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Clipboard error'));

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('copy-log-path-button');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByTestId('logging-section-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to copy path to clipboard')).toBeInTheDocument();
    });
  });

  it('disables open button when loading', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);
    mockLoggingManagementService.openLogDirectory.mockImplementation(() => new Promise(() => {}));

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const openButton = screen.getByTestId('open-log-directory-button');
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(openButton).toBeDisabled();
      expect(screen.getByText('Opening...')).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue(mockPath);

    renderWithTheme(<LoggingSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockPath)).toBeInTheDocument();
    });

    const openButton = screen.getByTestId('open-log-directory-button');
    const copyButton = screen.getByTestId('copy-log-path-button');

    expect(openButton).toHaveAttribute('aria-label', 'Open log directory in file manager');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy log directory path to clipboard');
  });
});
