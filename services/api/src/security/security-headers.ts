// ─── Security Headers Middleware ────────────────────────────────
// Configures security headers and CORS for API responses

interface SecurityHeadersConfig {
  // CORS configuration
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number; // in seconds
  credentials?: boolean;

  // Security headers to enable
  enableHSTS?: boolean;
  hstsMaxAge?: number; // in seconds
  enableCSP?: boolean;
  enableXFrameOptions?: boolean;
  enableXXSSProtection?: boolean;
  enableContentTypeOptions?: boolean;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  allowedOrigins: ['https://recheq.ai', 'https://www.recheq.ai'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Forwarded-For'],
  exposeHeaders: ['X-Request-ID'],
  maxAge: 86400, // 24 hours
  credentials: true,
  enableHSTS: true,
  hstsMaxAge: 31536000, // 1 year
  enableCSP: true,
  enableXFrameOptions: true,
  enableXXSSProtection: true,
  enableContentTypeOptions: true,
};

// Default Content Security Policy
const DEFAULT_CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function createSecurityHeadersMiddleware(config: SecurityHeadersConfig = DEFAULT_CONFIG) {
  const {
    allowedOrigins,
    allowedMethods,
    allowedHeaders,
    exposeHeaders,
    maxAge,
    credentials,
    enableHSTS,
    hstsMaxAge,
    enableCSP,
    enableXFrameOptions,
    enableXXSSProtection,
    enableContentTypeOptions,
  } = config;

  function buildCSP(): string {
    const parts: string[] = [];
    for (const [directive, values] of Object.entries(DEFAULT_CSP)) {
      parts.push(`${directive} ${values.join(' ')}`);
    }
    return parts.join('; ');
  }

  return async function securityHeadersMiddleware(
    req: Request,
    next: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const originalResponse = await next(req);
    const headers = new Headers(originalResponse.headers);

    // ─── CORS Headers ─────────────────────────────────────────────
    const origin = req.headers.get('Origin');

    if (origin && allowedOrigins?.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
    } else if (allowedOrigins && allowedOrigins.length === 0) {
      // No CORS allowed if allowedOrigins is explicitly empty
      headers.set('Access-Control-Allow-Origin', 'null');
    }

    headers.set('Access-Control-Allow-Methods', allowedMethods?.join(', ') || 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      allowedHeaders?.join(', ') || 'Content-Type, Authorization',
    );
    headers.set('Access-Control-Expose-Headers', exposeHeaders?.join(', ') || 'X-Request-ID');

    if (maxAge !== undefined) {
      headers.set('Access-Control-Max-Age', String(maxAge));
    }

    if (credentials !== undefined) {
      headers.set('Access-Control-Allow-Credentials', String(credentials));
    }

    // ─── Security Headers ─────────────────────────────────────────
    // HSTS (HTTP Strict Transport Security)
    if (enableHSTS) {
      headers.set(
        'Strict-Transport-Security',
        `max-age=${hstsMaxAge ?? 31536000}; includeSubDomains`,
      );
    }

    // CSP (Content Security Policy)
    if (enableCSP) {
      headers.set('Content-Security-Policy', buildCSP());
    }

    // X-Frame-Options
    if (enableXFrameOptions) {
      headers.set('X-Frame-Options', 'DENY');
    }

    // X-XSS-Protection
    if (enableXXSSProtection) {
      headers.set('X-XSS-Protection', '1; mode=block');
    }

    // X-Content-Type-Options
    if (enableContentTypeOptions) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }

    // Remove server-specific headers that might leak information
    headers.delete('X-Powered-By');
    headers.delete('Server');

    return new Response(originalResponse.body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers,
    });
  };
}
