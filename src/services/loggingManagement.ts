import { invoke } from '@tauri-apps/api/core';

export class LoggingManagementService {
  /**
   * Get the current log directory path
   */
  async getLogDirectoryPath(): Promise<string> {
    // Check for Storybook mocks
    if (typeof window !== 'undefined' && (window as any).__STORYBOOK_SERVICE_MOCKS__?.loggingManagementService?.getLogDirectoryPath) {
      return (window as any).__STORYBOOK_SERVICE_MOCKS__.loggingManagementService.getLogDirectoryPath();
    }

    try {
      return await invoke<string>('get_log_directory_path');
    } catch (error) {
      console.error('Failed to get log directory path:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get log directory path');
    }
  }

  /**
   * Open the log directory in the system file manager
   */
  async openLogDirectory(): Promise<void> {
    // Check for Storybook mocks
    if (typeof window !== 'undefined' && (window as any).__STORYBOOK_SERVICE_MOCKS__?.loggingManagementService?.openLogDirectory) {
      return (window as any).__STORYBOOK_SERVICE_MOCKS__.loggingManagementService.openLogDirectory();
    }

    try {
      await invoke('open_log_directory');
    } catch (error) {
      console.error('Failed to open log directory:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to open log directory');
    }
  }

  /**
   * Get the current log file path (for debugging)
   */
  async getLogFilePath(): Promise<string> {
    // Check for Storybook mocks
    if (typeof window !== 'undefined' && (window as any).__STORYBOOK_SERVICE_MOCKS__?.loggingManagementService?.getLogFilePath) {
      return (window as any).__STORYBOOK_SERVICE_MOCKS__.loggingManagementService.getLogFilePath();
    }

    try {
      return await invoke<string>('get_log_file_path');
    } catch (error) {
      console.error('Failed to get log file path:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get log file path');
    }
  }
}

// Export a singleton instance
export const loggingManagementService = new LoggingManagementService();
