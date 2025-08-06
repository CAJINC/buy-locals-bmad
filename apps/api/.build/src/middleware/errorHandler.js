export const errorHandler = (err, req, res, next) => {
    const errorLog = {
        level: 'error',
        message: err.message,
        statusCode: err.statusCode || 500,
        isOperational: err.isOperational || false,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        correlationId: req.get('X-Correlation-ID') || 'unknown',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
    if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(errorLog));
    }
    else {
        console.error('API Error:', errorLog);
    }
    const statusCode = err.statusCode || 500;
    const message = err.statusCode && err.isOperational
        ? err.message
        : 'Internal server error';
    const errorResponse = {
        error: message,
        statusCode,
        timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }
    res.status(statusCode).json(errorResponse);
};
export const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
//# sourceMappingURL=errorHandler.js.map