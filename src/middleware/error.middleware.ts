import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/customErrors';
import { isPrismaError } from '../utils/error.utils';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle AppError
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

  // Log unexpected errors
  console.error('Unexpected error:', err);

  // Handle generic errors
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
};