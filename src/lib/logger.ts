/**
 * Standardized logging utility for Blueprint Buddy
 * Provides consistent logging across all agents and services
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  static isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log agent activity
   */
  static agent(agentName: string, action: string, details?: any) {
    if (this.isDevelopment) {
      console.log(`[${agentName}] ${action}`, details || '');
    }
  }

  /**
   * Log debug information
   */
  static debug(component: string, message: string, data?: any) {
    if (this.isDevelopment) {
      console.debug(`[${component}] ${message}`, data || '');
    }
  }

  /**
   * Log general information
   */
  static info(component: string, message: string, data?: any) {
    console.info(`[${component}] ${message}`, data || '');
  }

  /**
   * Log warnings
   */
  static warn(component: string, message: string, data?: any) {
    console.warn(`[${component}] ${message}`, data || '');
  }

  /**
   * Log errors
   */
  static error(component: string, message: string, error?: any) {
    console.error(`[${component}] ${message}`, error || '');
    
    // In production, you might want to send this to an error tracking service
    if (!this.isDevelopment && error) {
      // TODO: Send to error tracking service
    }
  }

  /**
   * Log performance metrics
   */
  static perf(component: string, action: string, duration: number) {
    if (this.isDevelopment) {
      console.log(`[PERF][${component}] ${action} took ${duration}ms`);
    }
  }

  /**
   * Create a scoped logger for a specific component
   */
  static createScoped(component: string) {
    return {
      debug: (message: string, data?: any) => Logger.debug(component, message, data),
      info: (message: string, data?: any) => Logger.info(component, message, data),
      warn: (message: string, data?: any) => Logger.warn(component, message, data),
      error: (message: string, error?: any) => Logger.error(component, message, error),
      perf: (action: string, duration: number) => Logger.perf(component, action, duration)
    };
  }
} 