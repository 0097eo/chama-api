import { AppError } from './customErrors';

/**
 * Type guard to check if a caught error is a standard Error object with a message.
 * @param error The error caught in a catch block.
 * @returns True if the error has a message property, false otherwise.
 */
export const isErrorWithMessage = (error: unknown): error is { message: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
};

/**
 * Type guard to check if a caught error is a Prisma-specific error.
 * Prisma errors have a 'code' property.
 * @param error The error caught in a catch block.
 * @returns True if the error has a code property, false otherwise.
 */
export const isPrismaError = (error: unknown): error is { code: string } => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as Record<string, unknown>).code === 'string'
    );
};

/**
 * Type guard to check if error is an AppError
 */
export const isAppError = (error: unknown): error is AppError => {
    return error instanceof AppError;
};