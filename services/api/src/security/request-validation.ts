// ─── Request Validation Middleware ──────────────────────────────
// Validates requests for public token routes
// - Checks token purpose before route handling
// - Validates request headers and content types
// - Prevents secret leakage in responses

import {
  verifyToken,
  InvalidTokenError,
  TokenExpiredError,
  InvalidTokenPurposeError,
} from '../tokens/verify-token.js';
import type { TokenPurpose } from '@recheq/schema';
import { AppError, forbiddenError, unauthorizedError } from '../http/errors.js';
import type { TokenRecord } from '../tokens/verify-token.js';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

/**
 * Validates a request body against a Zod schema.
 * Throws a 400 AppError with validation details if it fails.
 */
export function validateBody<T>(body: unknown, schema: ZodSchema<T>): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new AppError(400, 'VALIDATION_ERROR', `Validation failed: ${details}`);
    }
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');
  }
}

// Secret patterns to filter from responses
const SECRET_PATTERNS = [
  /(?:password|secret|token|key|api[_-]?key|auth(?:entication)?|credential)/i,
  /(?:sk[_-]?live|sk[_-]?test|pk[_-]?live|pk[_-]?test)/i,
  /(?:aws[_-]?(?:access[_-]?key[_-]?id|secret[_-]?access[_-]?key|session[_-]?token))/i,
  /(?:private[_-]?key|ssl[_-]?certificate)/i,
  /(?:db[_-]?(?:password|conn|uri|url))/i,
];

// Sensitive field names to exclude from JSON responses
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'apiKeyId',
  'accessKey',
  'secretKey',
  'sessionToken',
  'privateKey',
  'certificate',
  'dbPassword',
  'dbConn',
  'dbUrl',
  'secretAccessKey',
  'signature',
  'hmac',
  'credential',
  'credentials',
];

/**
 * Extracts the token from the URL path
 * Expected format: /api/public/:token/...
 */
export function extractTokenFromUrl(url: URL): string | null {
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Find 'public' in path and get the next segment as token
  const publicIndex = pathParts.indexOf('public');
  if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
    return pathParts[publicIndex + 1] ?? null;
  }

  // Also check for token in /api/public/:token/...
  if (pathParts[0] === 'api' && pathParts[1] === 'public' && pathParts[2]) {
    return pathParts[2] ?? null;
  }

  return null;
}

/**
 * Validates that a token exists and is for the expected purpose
 */
export async function validateTokenPurpose(
  url: URL,
  requiredPurpose: TokenPurpose,
  getTokenByHash: (hash: string) => Promise<TokenRecord | null>,
): Promise<{ caseId: string; tokenPurpose: TokenPurpose }> {
  const token = extractTokenFromUrl(url);
  if (!token) {
    throw unauthorizedError('Token not provided in URL path');
  }

  // Hash the token for lookup
  const crypto = await import('node:crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const record = await getTokenByHash(tokenHash);
    if (!record) {
      throw unauthorizedError('Invalid or expired token');
    }

    // Verify the token value against the stored hash
    verifyToken(token, requiredPurpose, record);

    return {
      caseId: record.case_id,
      tokenPurpose: record.purpose,
    };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AppError(410, 'TOKEN_EXPIRED', 'Token has expired');
    }
    if (error instanceof InvalidTokenPurposeError) {
      throw forbiddenError('Token purpose does not match required purpose');
    }
    if (error instanceof InvalidTokenError || error instanceof AppError) {
      throw unauthorizedError('Invalid token');
    }
    throw unauthorizedError('Token validation failed');
  }
}

/**
 * Checks if a JSON object contains sensitive fields and removes/redacts them
 */
export function sanitizeSensitiveFields(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSensitiveFields(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitive = SENSITIVE_FIELDS.some((field) => new RegExp(field, 'i').test(key));

      if (isSensitive) {
        // Redact sensitive fields
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeSensitiveFields(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Checks if a string contains secret patterns (for logging/redaction)
 */
export function containsSecrets(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Validates Content-Type for requests that require it
 */
export function validateContentType(headers: Headers, requiredContentType?: string): boolean {
  const contentType = headers.get('content-type');
  if (!requiredContentType) {
    return true;
  }
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().includes(requiredContentType.toLowerCase());
}

/**
 * Creates middleware that validates token purpose and sanitizes responses
 */
export function createRequestValidationMiddleware(
  getTokenByHash: (hash: string) => Promise<TokenRecord | null>,
) {
  return async function requestValidationMiddleware(
    req: Request,
    next: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const url = new URL(req.url);

    // Extract and validate token
    const token = extractTokenFromUrl(url);
    if (token) {
      const crypto = await import('node:crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      try {
        const record = await getTokenByHash(tokenHash);
        if (!record) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'TOKEN_NOT_FOUND',
                message: 'Token not found or expired',
              },
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        // Store validated token info for downstream use
        (req as Request & { tokenInfo?: { caseId: string; purpose: TokenPurpose } }).tokenInfo = {
          caseId: record.case_id,
          purpose: record.purpose,
        };
      } catch {
        return new Response(
          JSON.stringify({
            error: {
              code: 'TOKEN_VALIDATION_ERROR',
              message: 'Token validation failed',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Process the request
    let response = await next(req);

    // Sanitize the response body if it's JSON
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const bodyText = await response.text();
      try {
        const body = JSON.parse(bodyText);
        const sanitized = sanitizeSensitiveFields(body);

        // Check if the body was actually modified
        const originalString = JSON.stringify(body);
        const sanitizedString = JSON.stringify(sanitized);

        if (originalString !== sanitizedString) {
          response = new Response(sanitizedString, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
        // Body is not valid JSON, skip sanitization
      }
    }

    return response;
  };
}
