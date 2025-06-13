import { invoke } from '@tauri-apps/api/core';

export class LoggingManagementService {
  /**
   * Get the current log directory path
   */
  async getLogDirectoryPath(): Promise<string> {
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
