export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError(422, 'VALIDATION_ERROR', message, details);
}

export function notFoundError(message: string = 'Resource not found', details?: unknown): AppError {
  return new AppError(404, 'NOT_FOUND', message, details);
}

export function forbiddenError(message: string = 'Forbidden', details?: unknown): AppError {
  return new AppError(403, 'FORBIDDEN', message, details);
}

export function unauthorizedError(message: string = 'Unauthorized', details?: unknown): AppError {
  return new AppError(401, 'UNAUTHORIZED', message, details);
}

export function conflictError(message: string = 'Conflict', details?: unknown): AppError {
  return new AppError(409, 'CONFLICT', message, details);
}

export function goneError(message: string = 'Gone', details?: unknown): AppError {
  return new AppError(410, 'GONE', message, details);
}

export function toErrorResponse(error: unknown): { status: number; body: ApiError } {
  const isAppError =
    error instanceof AppError ||
    (typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      'code' in error &&
      'message' in error);

  if (isAppError) {
    const appError = error as AppError;
    return {
      status: appError.statusCode,
      body: {
        error: {
          code: appError.code,
          message: appError.message,
          ...(appError.details ? { details: appError.details } : {}),
        },
      },
    };
  }

  // Handle Zod errors dynamically to avoid strict dependency on Zod in the core errors file,
  // but provide nice output if a ZodError is passed directly to the generic error handler.
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError') {
    return {
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: (error as unknown as { errors: unknown }).errors,
        },
      },
    };
  }

  // Fallback for unexpected errors
  console.error('Unexpected Error:', error);
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}
