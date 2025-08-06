import { APIGatewayProxyResult } from 'aws-lambda';

export interface LambdaApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export const success = <T>(data: T, message?: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const created = <T>(data: T, message?: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const badRequest = (error: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const unauthorized = (error: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const forbidden = (error: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const notFound = (error: string): APIGatewayProxyResult => {
  const response: LambdaApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const internalServerError = (error: string = 'Internal server error'): APIGatewayProxyResult => {
  const response: LambdaApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
};

export const responseUtils = {
  success,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalServerError
};