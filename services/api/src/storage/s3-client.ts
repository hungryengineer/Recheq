import { createHash, createHmac } from 'node:crypto';

export interface S3ClientConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface S3Request {
  method: 'HEAD' | 'PUT';
  bucket: string;
  now?: Date;
}

export interface S3Response {
  ok: boolean;
  status: number;
  statusText: string;
}

export type S3Transport = (url: URL, init: RequestInit) => Promise<S3Response>;

export interface S3Client {
  headBucket: (bucket: string) => Promise<S3Response>;
  createBucket: (bucket: string) => Promise<S3Response>;
}

const EMPTY_BODY_SHA256 = createHash('sha256').update('').digest('hex');

export function createS3Client(
  config: S3ClientConfig,
  transport: S3Transport = defaultTransport,
): S3Client {
  return {
    headBucket: (bucket) => sendSignedS3Request(config, { method: 'HEAD', bucket }, transport),
    createBucket: (bucket) => sendSignedS3Request(config, { method: 'PUT', bucket }, transport),
  };
}

export function createS3ClientFromEnv(env: NodeJS.ProcessEnv = process.env): S3Client {
  return createS3Client({
    endpoint: requireEnv(env, 'S3_ENDPOINT'),
    region: env.S3_REGION ?? 'us-east-1',
    accessKeyId: requireEnv(env, 'S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(env, 'S3_SECRET_ACCESS_KEY'),
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
  });
}

export async function sendSignedS3Request(
  config: S3ClientConfig,
  request: S3Request,
  transport: S3Transport = defaultTransport,
): Promise<S3Response> {
  const now = request.now ?? new Date();
  const url = getBucketUrl(config, request.bucket);
  const headers = signS3Request(config, request.method, url, now);

  return transport(url, {
    method: request.method,
    headers,
  });
}

function getBucketUrl(config: S3ClientConfig, bucket: string): URL {
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error(`Invalid S3 bucket name: ${bucket}`);
  }

  const endpoint = new URL(config.endpoint);

  if (config.forcePathStyle ?? true) {
    const normalizedPath = endpoint.pathname.replace(/\/$/, '');
    endpoint.pathname = `${normalizedPath}/${bucket}`;
    return endpoint;
  }

  endpoint.hostname = `${bucket}.${endpoint.hostname}`;
  return endpoint;
}

function signS3Request(
  config: S3ClientConfig,
  method: S3Request['method'],
  url: URL,
  now: Date,
): Headers {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const headers = new Headers({
    host: url.host,
    'x-amz-content-sha256': EMPTY_BODY_SHA256,
    'x-amz-date': amzDate,
  });
  const canonicalHeaders = getCanonicalHeaders(headers);
  const signedHeaders = getSignedHeaders(headers);
  const canonicalRequest = [
    method,
    encodeURI(url.pathname),
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    EMPTY_BODY_SHA256,
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
    [
      'AWS4-HMAC-SHA256',
      `Credential=${config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', '),
  );

  return headers;
}

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

async function defaultTransport(url: URL, init: RequestInit): Promise<S3Response> {
  const response = await fetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
