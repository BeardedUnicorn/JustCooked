import { LoggingManagementService } from '../loggingManagement';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri APIs
jest.mock('@tauri-apps/api/core');

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('LoggingManagementService', () => {
  let service: LoggingManagementService;

  beforeEach(() => {
    service = new LoggingManagementService();
    jest.clearAllMocks();
  });

  describe('getLogDirectoryPath', () => {
    it('should return log directory path successfully', async () => {
      const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs';
      mockInvoke.mockResolvedValue(mockPath);

      const result = await service.getLogDirectoryPath();

      expect(mockInvoke).toHaveBeenCalledWith('get_log_directory_path');
      expect(result).toBe(mockPath);
    });

    it('should handle errors when getting log directory path', async () => {
      const errorMessage = 'Failed to get app data directory';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      await expect(service.getLogDirectoryPath()).rejects.toThrow(errorMessage);
      expect(mockInvoke).toHaveBeenCalledWith('get_log_directory_path');
    });

    it('should handle non-Error exceptions', async () => {
      mockInvoke.mockRejectedValue('String error');

      await expect(service.getLogDirectoryPath()).rejects.toThrow('Failed to get log directory path');
      expect(mockInvoke).toHaveBeenCalledWith('get_log_directory_path');
    });
  });

  describe('openLogDirectory', () => {
    it('should open log directory successfully', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.openLogDirectory();

      expect(mockInvoke).toHaveBeenCalledWith('open_log_directory');
    });

    it('should handle errors when opening log directory', async () => {
      const errorMessage = 'Failed to open logs directory';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      await expect(service.openLogDirectory()).rejects.toThrow(errorMessage);
      expect(mockInvoke).toHaveBeenCalledWith('open_log_directory');
    });

    it('should handle non-Error exceptions when opening directory', async () => {
      mockInvoke.mockRejectedValue('String error');

      await expect(service.openLogDirectory()).rejects.toThrow('Failed to open log directory');
      expect(mockInvoke).toHaveBeenCalledWith('open_log_directory');
    });
  });

  describe('getLogFilePath', () => {
    it('should return log file path successfully', async () => {
      const mockPath = '/Users/test/Library/Application Support/com.justcooked.app/logs/justcooked.2024-01-15.log';
      mockInvoke.mockResolvedValue(mockPath);

      const result = await service.getLogFilePath();

      expect(mockInvoke).toHaveBeenCalledWith('get_log_file_path');
      expect(result).toBe(mockPath);
    });

    it('should handle errors when getting log file path', async () => {
      const errorMessage = 'Failed to get app data directory';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      await expect(service.getLogFilePath()).rejects.toThrow(errorMessage);
      expect(mockInvoke).toHaveBeenCalledWith('get_log_file_path');
    });

    it('should handle non-Error exceptions when getting log file path', async () => {
      mockInvoke.mockRejectedValue('String error');

      await expect(service.getLogFilePath()).rejects.toThrow('Failed to get log file path');
      expect(mockInvoke).toHaveBeenCalledWith('get_log_file_path');
    });
  });
});
