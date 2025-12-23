import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/customErrors';
import { isPrismaError } from '../utils/error.utils';
import logger from '../config/logger';
import * as Sentry from '@sentry/node';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({ err, message: err.message }, 'Error occurred');

  // Capture non-operational errors in Sentry
  // Operational errors (AppError) are expected and don't need to go to Sentry
  if (!(err instanceof AppError)) {
    Sentry.captureException(err, {
      level: 'error',
      extra: {
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
      },
    });
  }

  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Handle Prisma errors
  if (isPrismaError(err)) {
    let message = 'Database error occurred';
    let statusCode = 500;

    switch (err.code) {
      case 'P2002':
        message = 'A record with this value already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Invalid reference to related record';
        statusCode = 400;
        break;
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Handle generic errors (these are unexpected and go to Sentry)
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
};