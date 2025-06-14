import { invoke } from '@tauri-apps/api/core';
import { loggingService, createLogger } from '../loggingService';

// Mock Tauri API
jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('LoggingService', () => {
  let logger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger('TestComponent');
  });

  describe('Basic Logging', () => {
    it('should log debug messages', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.debug('Test debug message', { key: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('log_debug', {
        component: 'TestComponent',
        message: 'Test debug message',
        context: JSON.stringify({ key: 'value' }),
      });
    });

    it('should log info messages', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.info('Test info message', { key: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'Test info message',
        context: JSON.stringify({ key: 'value' }),
      });
    });

    it('should log warning messages', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.warn('Test warning message', { key: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('log_warn', {
        component: 'TestComponent',
        message: 'Test warning message',
        context: JSON.stringify({ key: 'value' }),
      });
    });

    it('should log error messages', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.error('Test error message', { key: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('log_error', {
        component: 'TestComponent',
        message: 'Test error message',
        context: JSON.stringify({ key: 'value' }),
      });
    });
  });

  describe('Import Error Logging', () => {
    it('should log import errors with full context', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const importError = new Error('Failed to parse recipe');
      const context = {
        url: 'https://example.com/recipe/123',
        step: 'parsing',
        timestamp: '2024-01-01T00:00:00Z',
      };

      await logger.logError(importError, 'Recipe import failed', context);

      expect(mockInvoke).toHaveBeenCalledWith('log_error', {
        component: 'TestComponent',
        message: 'Recipe import failed',
        context: expect.stringContaining('"url":"https://example.com/recipe/123"'),
      });

      // Verify the context contains the error details
      const call = mockInvoke.mock.calls[0];
      const contextStr = call[1].context;
      const contextObj = JSON.parse(contextStr);

      expect(contextObj.url).toBe('https://example.com/recipe/123');
      expect(contextObj.step).toBe('parsing');
      expect(contextObj.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(contextObj.error.name).toBe('Error');
      expect(contextObj.error.message).toBe('Failed to parse recipe');
      expect(contextObj.error.stack).toContain('Error: Failed to parse recipe');
    });

    it('should log batch import errors', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const batchError = {
        url: 'https://example.com/recipe/456',
        message: 'Network timeout',
        errorType: 'NetworkError',
        timestamp: '2024-01-01T00:00:00Z',
      };

      await logger.error('Batch import error', batchError);

      expect(mockInvoke).toHaveBeenCalledWith('log_error', {
        component: 'TestComponent',
        message: 'Batch import error',
        context: JSON.stringify(batchError),
      });
    });

    it('should log individual recipe import failures', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const recipeError = {
        url: 'https://allrecipes.com/recipe/123/cookies',
        title: 'Chocolate Chip Cookies',
        error: 'Invalid ingredient format',
        step: 'ingredient_parsing',
        duration: 1500,
      };

      await logger.error('Individual recipe import failed', recipeError);

      expect(mockInvoke).toHaveBeenCalledWith('log_error', {
        component: 'TestComponent',
        message: 'Individual recipe import failed',
        context: JSON.stringify(recipeError),
      });
    });

    it('should handle logging errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Logging system failure'));

      // Should not throw even if logging fails
      await expect(logger.error('Test error')).resolves.not.toThrow();
    });
  });

  describe('Context Handling', () => {
    it('should handle null context', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.info('Message without context');

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'Message without context',
        context: null,
      });
    });

    it('should handle complex context objects', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const complexContext = {
        recipe: {
          id: 'recipe-123',
          title: 'Test Recipe',
          ingredients: ['salt', 'pepper'],
        },
        metadata: {
          source: 'allrecipes.com',
          imported_at: new Date().toISOString(),
        },
        errors: ['Missing image', 'Invalid prep time'],
      };

      await logger.info('Complex context test', complexContext);

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'Complex context test',
        context: JSON.stringify(complexContext),
      });
    });

    it('should handle circular references in context', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // Should not throw on circular reference
      await expect(logger.info('Circular reference test', circularObj)).resolves.not.toThrow();
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log user actions', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.logUserAction('recipe_import', {
        url: 'https://example.com/recipe',
        method: 'manual',
      });

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'User action: recipe_import',
        context: JSON.stringify({
          type: 'user_interaction',
          action: 'recipe_import',
          url: 'https://example.com/recipe',
          method: 'manual',
        }),
      });
    });

    it('should log API calls', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.logApiCall('GET', 'https://api.example.com/recipes', 200, 1500);

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'API GET https://api.example.com/recipes - 200 (1500ms)',
        context: JSON.stringify({
          type: 'api_call',
          method: 'GET',
          url: 'https://api.example.com/recipes',
          status: 200,
          duration: 1500,
        }),
      });
    });

    it('should log API errors as error level', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.logApiCall('POST', 'https://api.example.com/recipes', 500, 3000);

      expect(mockInvoke).toHaveBeenCalledWith('log_error', {
        component: 'TestComponent',
        message: 'API POST https://api.example.com/recipes - 500 (3000ms)',
        context: JSON.stringify({
          type: 'api_call',
          method: 'POST',
          url: 'https://api.example.com/recipes',
          status: 500,
          duration: 3000,
        }),
      });
    });

    it('should log performance metrics', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await logger.logPerformance('recipe_parsing', 2500, {
        recipe_count: 10,
        success_rate: 0.9,
      });

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'Performance: recipe_parsing took 2500ms',
        context: JSON.stringify({
          type: 'performance',
          operation: 'recipe_parsing',
          duration: 2500,
          recipe_count: 10,
          success_rate: 0.9,
        }),
      });
    });
  });

  describe('Logger Factory', () => {
    it('should create logger with component name', () => {
      const testLogger = createLogger('BatchImport');

      expect(testLogger).toBeDefined();
      expect((testLogger as any).componentName).toBe('BatchImport');
    });

    it('should create different loggers for different components', () => {
      const logger1 = createLogger('Component1');
      const logger2 = createLogger('Component2');

      expect(logger1).not.toBe(logger2);
      expect((logger1 as any).componentName).toBe('Component1');
      expect((logger2 as any).componentName).toBe('Component2');
    });

    it('should use component-specific logger correctly', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const componentLogger = createLogger('TestComponent');
      await componentLogger.info('Test message');

      expect(mockInvoke).toHaveBeenCalledWith('log_info', {
        component: 'TestComponent',
        message: 'Test message',
        context: null,
      });
    });
  });

  describe('Disabled Logging', () => {
    it('should skip logging when disabled', async () => {
      loggingService.setEnabled(false);

      await loggingService.info('This should not be logged');

      expect(mockInvoke).not.toHaveBeenCalled();

      // Re-enable for other tests
      loggingService.setEnabled(true);
    });
  });
});
