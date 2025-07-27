import { logger } from '@/lib/logger';

/**
 * Centralized logging utility
 * Replaces console statements for production-ready logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, data?: any) {
    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    // In development, use console
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           console.log;
      
      consoleMethod(`[${level.toUpperCase()}]`, message, data || '');
      return;
    }
    
    // In production, send to logging service
    // TODO: Implement production logging (e.g., Sentry, LogRocket, etc.)
    this.sendToLoggingService(logEntry);
  }
  
  private sendToLoggingService(logEntry: LogEntry) {
    // Implement your preferred logging service here
    // For now, we'll use a safe console fallback
    if (logEntry.level === 'error') {
      logger.error('[LOGGER]', logEntry);
    }
  }
  
  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any) {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }
  
  error(message: string, error?: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    
    this.log('error', message, errorData);
  }
}

export const logger = new Logger();
