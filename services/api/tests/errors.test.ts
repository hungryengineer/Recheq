import { describe, expect, it } from 'vitest';
import {
  AppError,
  validationError,
  notFoundError,
  forbiddenError,
  unauthorizedError,
  toErrorResponse,
} from '../src/http/errors.js';

describe('HTTP Errors', () => {
  it('creates validation error', () => {
    const err = validationError('Bad input', { field: 'name' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad input');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('creates not found error', () => {
    const err = notFoundError('User missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User missing');
  });

  it('creates forbidden error', () => {
    const err = forbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('creates unauthorized error', () => {
    const err = unauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  describe('toErrorResponse', () => {
    it('formats AppError', () => {
      const err = validationError('Invalid state');
      const res = toErrorResponse(err);
      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid state',
        },
      });
    });

    it('formats generic Error as 500', () => {
      const err = new Error('Database down');
      const res = toErrorResponse(err);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    it('formats ZodError-like objects', () => {
      const zodErr = {
        name: 'ZodError',
        errors: [{ path: ['email'], message: 'Invalid' }],
      };
      const res = toErrorResponse(zodErr);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([{ path: ['email'], message: 'Invalid' }]);
    });
  });
});
