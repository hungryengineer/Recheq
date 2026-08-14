import { Socket } from 'node:net';
import { createHash, createHmac } from 'node:crypto';

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
}

const databaseUrl = new URL(
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tieout',
);
const s3Endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const s3Bucket = process.env.S3_BUCKET ?? process.env.MINIO_BUCKET ?? 'tieout-local';
const s3Region = process.env.S3_REGION ?? 'us-east-1';
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID ?? 'minioadmin';
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin';

main().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const results = await Promise.all([checkPostgres(), ensureBucket()]);
  const failed = results.filter((result) => !result.ok);

  for (const result of results) {
    const prefix = result.ok ? 'ok' : 'fail';
    console.log(`${prefix} ${result.name}: ${result.message}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function checkPostgres(): Promise<CheckResult> {
  try {
    await checkTcpConnection(databaseUrl.hostname, Number(databaseUrl.port || 5432), 2_000);
    return {
      name: 'postgres',
      ok: true,
      message: `${databaseUrl.hostname}:${databaseUrl.port || 5432} is reachable`,
    };
  } catch (error) {
    return {
      name: 'postgres',
      ok: false,
      message: getErrorMessage(error),
    };
  }
}

async function ensureBucket(): Promise<CheckResult> {
  try {
    const head = await signedFetch('HEAD', s3Bucket);

    if (head.ok) {
      return {
        name: 'object-storage',
        ok: true,
        message: `bucket ${s3Bucket} already exists and is private by default`,
      };
    }

    if (head.status !== 404) {
      return {
        name: 'object-storage',
        ok: false,
        message: `bucket check failed: ${head.status} ${head.statusText}`,
      };
    }

    const put = await signedFetch('PUT', s3Bucket);

    return {
      name: 'object-storage',
      ok: put.ok || put.status === 409,
      message:
        put.ok || put.status === 409
          ? `bucket ${s3Bucket} is ready and no public ACL was applied`
          : `bucket creation failed: ${put.status} ${put.statusText}`,
    };
  } catch (error) {
    return {
      name: 'object-storage',
      ok: false,
      message: getErrorMessage(error),
    };
  }
}

async function signedFetch(method: 'HEAD' | 'PUT', bucket: string): Promise<Response> {
  const url = new URL(s3Endpoint);
  const normalizedPath = url.pathname.replace(/\/$/, '');
  url.pathname = `${normalizedPath}/${bucket}`;

  return fetch(url, {
    method,
    headers: signS3Request(method, url, new Date()),
  });
}

function signS3Request(method: 'HEAD' | 'PUT', url: URL, now: Date): Headers {
  const emptyBodyHash = createHash('sha256').update('').digest('hex');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${s3Region}/s3/aws4_request`;
  const headers = new Headers({
    host: url.host,
    'x-amz-content-sha256': emptyBodyHash,
    'x-amz-date': amzDate,
  });
  const canonicalHeaders = [...headers.entries()]
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim().replace(/\s+/g, ' ')}`)
    .sort()
    .join('\n')
    .concat('\n');
  const signedHeaders = [...headers.keys()]
    .map((key) => key.toLowerCase())
    .sort()
    .join(';');
  const canonicalRequest = [
    method,
    encodeURI(url.pathname),
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    emptyBodyHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = hmac(getSigningKey(dateStamp), stringToSign, 'hex');

  headers.set(
    'authorization',
    [
      'AWS4-HMAC-SHA256',
      `Credential=${s3AccessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', '),
  );

  return headers;
}

function getSigningKey(dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${s3SecretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, s3Region);
  const dateRegionServiceKey = hmac(dateRegionKey, 's3');
  return hmac(dateRegionServiceKey, 'aws4_request');
}

function hmac(key: string | Buffer, value: string, encoding?: 'hex'): Buffer;
function hmac(key: string | Buffer, value: string, encoding: 'hex'): string;
function hmac(key: string | Buffer, value: string, encoding?: 'hex'): Buffer | string {
  const digest = createHmac('sha256', key).update(value);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function checkTcpConnection(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`connection timed out at ${host}:${port}`));
    });
    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
    socket.connect(port, host);
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
