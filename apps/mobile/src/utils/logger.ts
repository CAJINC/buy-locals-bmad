interface LogContext {
  [key: string]: any;
}

interface Logger {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

const createLogger = (): Logger => {
  const isDevelopment = __DEV__;
  
  const formatMessage = (level: string, message: string, context?: LogContext): string => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `\nContext: ${JSON.stringify(context, null, 2)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  };

  const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context?: LogContext) => {
    if (!isDevelopment && level === 'DEBUG') {
      return; // Skip debug logs in production
    }

    const formattedMessage = formatMessage(level, message, context);
    
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'DEBUG':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
        break;
    }

    // In production, you would send logs to your logging service
    // e.g., Crashlytics, Sentry, LogRocket, etc.
    if (!isDevelopment) {
      // sendToLoggingService(level, message, context);
    }
  };

  return {
    info: (message: string, context?: LogContext) => log('INFO', message, context),
    warn: (message: string, context?: LogContext) => log('WARN', message, context),
    error: (message: string, context?: LogContext) => log('ERROR', message, context),
    debug: (message: string, context?: LogContext) => log('DEBUG', message, context),
  };
};

export const logger = createLogger();