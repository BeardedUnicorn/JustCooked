import { invoke } from '@tauri-apps/api/core';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  [key: string]: any;
}

class LoggingService {
  private componentName: string = 'Unknown';
  private isEnabled: boolean = true;

  /**
   * Set the component name for all subsequent log calls
   */
  setComponent(componentName: string): void {
    this.componentName = componentName;
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Log a debug message
   */
  async debug(message: string, context?: LogContext): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await invoke('log_debug', {
        component: this.componentName,
        message,
        context: context ? JSON.stringify(context) : null,
      });
    } catch (error) {
      console.warn('Failed to write debug log:', error);
    }
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      console.debug(`[${this.componentName}] ${message}`, context || '');
    }
  }

  /**
   * Log an info message
   */
  async info(message: string, context?: LogContext): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await invoke('log_info', {
        component: this.componentName,
        message,
        context: context ? JSON.stringify(context) : null,
      });
    } catch (error) {
      console.warn('Failed to write info log:', error);
    }
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      console.info(`[${this.componentName}] ${message}`, context || '');
    }
  }

  /**
   * Log a warning message
   */
  async warn(message: string, context?: LogContext): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await invoke('log_warn', {
        component: this.componentName,
        message,
        context: context ? JSON.stringify(context) : null,
      });
    } catch (error) {
      console.warn('Failed to write warn log:', error);
    }
    
    // Also log to console
    console.warn(`[${this.componentName}] ${message}`, context || '');
  }

  /**
   * Log an error message
   */
  async error(message: string, context?: LogContext): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await invoke('log_error', {
        component: this.componentName,
        message,
        context: context ? JSON.stringify(context) : null,
      });
    } catch (error) {
      console.warn('Failed to write error log:', error);
    }
    
    // Also log to console
    console.error(`[${this.componentName}] ${message}`, context || '');
  }

  /**
   * Log an error with full error object details
   */
  async logError(error: Error | unknown, message?: string, context?: LogContext): Promise<void> {
    const errorMessage = message || 'An error occurred';
    const errorDetails: LogContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    };

    await this.error(errorMessage, errorDetails);
  }

  /**
   * Log user interaction
   */
  async logUserAction(action: string, details?: LogContext): Promise<void> {
    await this.info(`User action: ${action}`, {
      type: 'user_interaction',
      action,
      ...details,
    });
  }

  /**
   * Log API call
   */
  async logApiCall(method: string, url: string, status?: number, duration?: number): Promise<void> {
    const level = status && status >= 400 ? 'error' : 'info';
    const message = `API ${method} ${url}${status ? ` - ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    
    const context: LogContext = {
      type: 'api_call',
      method,
      url,
      status,
      duration,
    };

    if (level === 'error') {
      await this.error(message, context);
    } else {
      await this.info(message, context);
    }
  }

  /**
   * Log performance metrics
   */
  async logPerformance(operation: string, duration: number, details?: LogContext): Promise<void> {
    await this.info(`Performance: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...details,
    });
  }

  /**
   * Get the current log file path
   */
  async getLogFilePath(): Promise<string> {
    try {
      return await invoke('get_log_file_path');
    } catch (error) {
      console.error('Failed to get log file path:', error);
      throw error;
    }
  }

  /**
   * Create a scoped logger for a specific component
   */
  createLogger(componentName: string): ComponentLogger {
    return new ComponentLogger(componentName, this);
  }
}

/**
 * Component-specific logger that automatically sets the component name
 */
class ComponentLogger {
  constructor(
    private componentName: string,
    private loggingService: LoggingService
  ) {}

  async debug(message: string, context?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.debug(message, context);
    this.loggingService.setComponent(originalComponent);
  }

  async info(message: string, context?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.info(message, context);
    this.loggingService.setComponent(originalComponent);
  }

  async warn(message: string, context?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.warn(message, context);
    this.loggingService.setComponent(originalComponent);
  }

  async error(message: string, context?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.error(message, context);
    this.loggingService.setComponent(originalComponent);
  }

  async logError(error: Error | unknown, message?: string, context?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.logError(error, message, context);
    this.loggingService.setComponent(originalComponent);
  }

  async logUserAction(action: string, details?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.logUserAction(action, details);
    this.loggingService.setComponent(originalComponent);
  }

  async logApiCall(method: string, url: string, status?: number, duration?: number): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.logApiCall(method, url, status, duration);
    this.loggingService.setComponent(originalComponent);
  }

  async logPerformance(operation: string, duration: number, details?: LogContext): Promise<void> {
    const originalComponent = this.loggingService['componentName'];
    this.loggingService.setComponent(this.componentName);
    await this.loggingService.logPerformance(operation, duration, details);
    this.loggingService.setComponent(originalComponent);
  }
}

// Export singleton instance
export const loggingService = new LoggingService();

// Export convenience functions
export const createLogger = (componentName: string) => loggingService.createLogger(componentName);

export default loggingService;
