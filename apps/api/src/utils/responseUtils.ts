import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode: number;
  timestamp: string;
}

export const successResponse = <T>(
  res: Response,
  statusCode: number = 200,
  data?: T,
  message?: string
): Response => {
  const response: ApiResponse<T> = {
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

export const errorResponse = (
  res: Response,
  statusCode: number = 500,
  error: string = 'Internal server error',
  details?: string[]
): Response => {
  const response: ApiResponse = {
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

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  totalCount: number,
  page: number = 1,
  limit: number = 10,
  statusCode: number = 200
): Response => {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const response: ApiResponse<{
    items: T[];
    pagination: {
      totalCount: number;
      totalPages: number;
      currentPage: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> = {
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