export const validateBody = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const validationError = new Error('Validation failed');
            validationError.statusCode = 400;
            validationError.isOperational = true;
            validationError.details = error.details.map(detail => detail.message);
            return next(validationError);
        }
        next();
    };
};
export const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.query);
        if (error) {
            const validationError = new Error('Validation failed');
            validationError.statusCode = 400;
            validationError.isOperational = true;
            validationError.details = error.details.map(detail => detail.message);
            return next(validationError);
        }
        next();
    };
};
export const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params);
        if (error) {
            const validationError = new Error('Validation failed');
            validationError.statusCode = 400;
            validationError.isOperational = true;
            validationError.details = error.details.map(detail => detail.message);
            return next(validationError);
        }
        next();
    };
};
export const validationErrorHandler = (err, req, res, next) => {
    if (err.isJoi) {
        const validationError = new Error('Validation failed');
        validationError.statusCode = 400;
        validationError.isOperational = true;
        validationError.details = err.details.map((detail) => detail.message);
        return next(validationError);
    }
    next(err);
};
//# sourceMappingURL=validation.js.map