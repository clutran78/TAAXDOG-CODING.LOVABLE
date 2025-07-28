/**
 * Centralized logging utility
 * Replaces console statements for production-ready logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  context?: Record<string, unknown>;
}

class Logger {
  private readonly _isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, data?: unknown): void {
    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    // In development, use console
    if (this._isDevelopment) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           console.log;
      
      consoleMethod(`[${level.toUpperCase()}]`, message, data || '');
      return;
    }
    
    // In production, send to logging service
    this.sendToLoggingService(logEntry);
  }
  
  private sendToLoggingService(logEntry: LogEntry): void {
    // Implement your preferred logging service here
    // For now, we'll use a safe console fallback
    if (typeof console !== 'undefined') {
      const logData = logEntry.data ? JSON.stringify(logEntry.data) : '';
      console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.timestamp} ${logEntry.message} ${logData}`);
    }
  }
  
  public debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }
  
  public info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }
  
  public warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }
  
  public error(message: string, error?: unknown): void {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    
    this.log('error', message, errorData);
  }
}

export const logger = new Logger();