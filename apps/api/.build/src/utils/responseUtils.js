export const successResponse = (res, statusCode = 200, data, message) => {
    const response = {
        success: true,
        statusCode,
        timestamp: new Date().toISOString(),
    };
    if (data !== undefined) {
        response.data = data;
    }
    if (message) {
        response.message = message;
    }
    return res.status(statusCode).json(response);
};
export const errorResponse = (res, statusCode = 500, error = 'Internal server error', details) => {
    const response = {
        success: false,
        error,
        statusCode,
        timestamp: new Date().toISOString(),
    };
    if (details && details.length > 0) {
        response.details = details;
    }
    return res.status(statusCode).json(response);
};
export const paginatedResponse = (res, data, totalCount, page = 1, limit = 10, statusCode = 200) => {
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    const response = {
        success: true,
        data: {
            items: data,
            pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage,
                hasPrevPage,
            },
        },
        statusCode,
        timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
};
//# sourceMappingURL=responseUtils.js.map