import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import Settings from '../Settings';

// Mock the database management service
jest.mock('@services/databaseManagement', () => ({
  databaseManagementService: {
    exportDatabase: jest.fn(),
    importDatabase: jest.fn(),
    resetDatabase: jest.fn(),
    formatImportResult: jest.fn(),
  },
}));

// Mock the logging management service
jest.mock('@services/loggingManagement', () => ({
  loggingManagementService: {
    getLogDirectoryPath: jest.fn(),
    openLogDirectory: jest.fn(),
    getLogFilePath: jest.fn(),
  },
}));

// Mock Tauri APIs
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: jest.fn(),
  open: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: jest.fn(),
  readTextFile: jest.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

const theme = createTheme();

// Import the logging management service for mocking
import { loggingManagementService } from '@services/loggingManagement';
const mockLoggingManagementService = loggingManagementService as jest.Mocked<typeof loggingManagementService>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Settings Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock logging service to return a default path
    mockLoggingManagementService.getLogDirectoryPath.mockResolvedValue('/test/logs');
  });

  it('renders settings page with correct title and breadcrumbs', () => {
    renderWithProviders(<Settings />);

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Manage your application settings and data.')).toBeInTheDocument();
  });

  it('renders database management section', () => {
    renderWithProviders(<Settings />);

    expect(screen.getByText('Database Management')).toBeInTheDocument();
    expect(screen.getByTestId('database-export-button')).toBeInTheDocument();
    expect(screen.getByTestId('database-import-button')).toBeInTheDocument();
    expect(screen.getByTestId('database-reset-button')).toBeInTheDocument();
  });

  it('renders logging section', async () => {
    renderWithProviders(<Settings />);

    expect(screen.getByText('Logging')).toBeInTheDocument();

    // Wait for the logging section to load
    await screen.findByTestId('open-log-directory-button');
    expect(screen.getByTestId('open-log-directory-button')).toBeInTheDocument();
  });

  it('has proper navigation structure', () => {
    renderWithProviders(<Settings />);

    // Check breadcrumbs
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');

    // Check page structure
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
  });

  it('renders all database management buttons with correct test ids', () => {
    renderWithProviders(<Settings />);

    expect(screen.getByTestId('database-export-button')).toBeInTheDocument();
    expect(screen.getByTestId('database-import-button')).toBeInTheDocument();
    expect(screen.getByTestId('database-reset-button')).toBeInTheDocument();
  });

  it('has accessible structure with proper headings', () => {
    renderWithProviders(<Settings />);

    // Main heading
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    
    // Section heading
    expect(screen.getByText('Database Management')).toBeInTheDocument();
  });
});
