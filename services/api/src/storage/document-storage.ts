import { createHash, createHmac } from 'node:crypto';

// ─── Document Storage Interface ─────────────────────────────────
// Abstraction over S3-compatible object storage for document files.
// Routes and services depend on this interface, not the transport.

export interface ObjectHead {
  ok: boolean;
  status: number;
  statusText: string;
  /** Content-Length of the object, when the provider reports it */
  size?: number | null;
}

export interface DocumentStorage {
  /**
   * Uploads a document to the private storage bucket.
   * @param key - The storage path (e.g. {org_id}/{case_id}/{document_id}.{ext})
   * @param content - Raw file content
   * @param contentType - MIME type of the file
   */
  putObject(key: string, content: Buffer, contentType: string): Promise<void>;

  /**
   * Checks whether an object exists and reports its size.
   * @param key - The storage path
   */
  headObject(key: string): Promise<ObjectHead>;
}

// ─── S3 Configuration ───────────────────────────────────────────

const EMPTY_BODY_SHA256 = createHash('sha256').update('').digest('hex');

export interface DocumentStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

// ─── Transport ──────────────────────────────────────────────────

export type DocumentStorageTransport = (
  url: URL,
  init: RequestInit,
) => Promise<{ ok: boolean; status: number; statusText: string; size?: number | null }>;

// ─── Factory ────────────────────────────────────────────────────

/**
 * Creates a DocumentStorage backed by S3-compatible object storage.
 * Uses AWS Signature V4 for authentication.
 */
export function createDocumentStorage(
  config: DocumentStorageConfig,
  transport: DocumentStorageTransport = defaultTransport,
): DocumentStorage {
  return {
    async putObject(key: string, content: Buffer, contentType: string): Promise<void> {
      const url = getObjectUrl(config, key);
      const bodyHash = createHash('sha256').update(content).digest('hex');
      const headers = signObjectRequest(
        config,
        'PUT',
        url,
        bodyHash,
        contentType,
        content.length,
        new Date(),
      );

      const response = await transport(url, {
        method: 'PUT',
        headers,
        body: new Uint8Array(content),
      });

      if (!response.ok) {
        throw new Error(`Failed to upload document: ${response.status} ${response.statusText}`);
      }
    },
    async headObject(key: string): Promise<ObjectHead> {
      const url = getObjectUrl(config, key);
      const headers = signObjectRequest(
        config,
        'HEAD',
        url,
        EMPTY_BODY_SHA256,
        undefined,
        0,
        new Date(),
      );

      const response = await transport(url, {
        method: 'HEAD',
        headers,
      });

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        size: response.size ?? null,
      };
    },
  };
}

/**
 * Creates a DocumentStorage from environment variables.
 */
export function createDocumentStorageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DocumentStorage {
  return createDocumentStorage({
    endpoint: requireEnv(env, 'S3_ENDPOINT'),
    region: env.S3_REGION ?? 'us-east-1',
    accessKeyId: requireEnv(env, 'S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(env, 'S3_SECRET_ACCESS_KEY'),
    bucket: env.S3_BUCKET ?? env.MINIO_BUCKET ?? 'tieout-local',
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
  });
}

// ─── URL Building ───────────────────────────────────────────────

function getObjectUrl(config: DocumentStorageConfig, key: string): URL {
  const endpoint = new URL(config.endpoint);

  if (config.forcePathStyle ?? true) {
    const normalizedPath = endpoint.pathname.replace(/\/$/, '');
    endpoint.pathname = `${normalizedPath}/${config.bucket}/${key}`;
    return endpoint;
  }

  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = `/${key}`;
  return endpoint;
}

// ─── AWS Signature V4 (Object-Level) ────────────────────────────

function signObjectRequest(
  config: DocumentStorageConfig,
  method: 'HEAD' | 'PUT',
  url: URL,
  bodyHash: string,
  contentType: string | undefined,
  contentLength: number,
  now: Date,
): Headers {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const headers = new Headers({
    host: url.host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': amzDate,
  });

  if (contentType !== undefined) {
    headers.set('content-type', contentType);
  }
  if (contentLength > 0) {
    headers.set('content-length', String(contentLength));
  }

  const canonicalHeaders = getCanonicalHeaders(headers);
  const signedHeaders = getSignedHeaders(headers);

  const canonicalRequest = [
    method,
    encodeURI(url.pathname),
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signature = hmac(
    getSigningKey(config.secretAccessKey, dateStamp, config.region),
    stringToSign,
    'hex',
  );

  headers.set(
    'authorization',
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );

  return headers;
}

// ─── Signing Helpers ────────────────────────────────────────────

function getCanonicalHeaders(headers: Headers): string {
  return [...headers.entries()]
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim().replace(/\s+/g, ' ')}`)
    .sort()
    .join('\n')
    .concat('\n');
}

function getSignedHeaders(headers: Headers): string {
  return [...headers.keys()]
    .map((key) => key.toLowerCase())
    .sort()
    .join(';');
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, 's3');
  return hmac(dateRegionServiceKey, 'aws4_request');
}

function hmac(key: string | Buffer, value: string, encoding?: 'hex'): Buffer;
function hmac(key: string | Buffer, value: string, encoding: 'hex'): string;
function hmac(key: string | Buffer, value: string, encoding?: 'hex'): Buffer | string {
  const digest = createHmac('sha256', key).update(value);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function defaultTransport(
  url: URL,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; statusText: string; size?: number | null }> {
  const response = await fetch(url, init);
  const contentLength = response.headers.get('content-length');
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    size: contentLength !== null ? Number(contentLength) : null,
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
