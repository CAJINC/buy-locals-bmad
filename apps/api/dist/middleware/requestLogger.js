import { v4 as uuidv4 } from 'uuid';
export const requestLogger = (req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.startTime = Date.now();
    res.setHeader('X-Correlation-ID', req.correlationId);
    const requestLog = {
        level: 'info',
        type: 'request',
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(requestLog));
    }
    else {
        console.log(`[${requestLog.timestamp}] ${requestLog.method} ${requestLog.url} - ${requestLog.correlationId}`);
    }
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        const responseLog = {
            level: 'info',
            type: 'response',
            correlationId: req.correlationId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
        };
        if (process.env.NODE_ENV === 'production') {
            console.log(JSON.stringify(responseLog));
        }
        else {
            console.log(`[${responseLog.timestamp}] ${responseLog.method} ${responseLog.url} - ${responseLog.statusCode} (${responseLog.duration})`);
        }
    });
    next();
};
//# sourceMappingURL=requestLogger.js.map