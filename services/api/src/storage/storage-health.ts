import { createS3ClientFromEnv, type S3Client } from './s3-client.js';

export interface StorageHealthResult {
  ok: boolean;
  bucket: string;
  status?: number;
  message: string;
}

export interface EnsureBucketResult {
  ok: boolean;
  bucket: string;
  created: boolean;
  status?: number;
  message: string;
}

export async function checkStorageHealth(
  bucket = getStorageBucketName(),
  client = createS3ClientFromEnv(),
): Promise<StorageHealthResult> {
  try {
    const response = await client.headBucket(bucket);

    if (response.ok) {
      return {
        ok: true,
        bucket,
        status: response.status,
        message: 'object storage bucket is reachable',
      };
    }

    return {
      ok: false,
      bucket,
      status: response.status,
      message: `object storage bucket is not reachable: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      bucket,
      message: getErrorMessage(error),
    };
  }
}

export async function ensureStorageBucket(
  bucket = getStorageBucketName(),
  client: S3Client = createS3ClientFromEnv(),
): Promise<EnsureBucketResult> {
  const head = await client.headBucket(bucket);

  if (head.ok) {
    return {
      ok: true,
      bucket,
      created: false,
      status: head.status,
      message: 'object storage bucket already exists',
    };
  }

  if (head.status !== 404) {
    return {
      ok: false,
      bucket,
      created: false,
      status: head.status,
      message: `object storage bucket check failed: ${head.status} ${head.statusText}`,
    };
  }

  const created = await client.createBucket(bucket);

  return {
    ok: created.ok || created.status === 409,
    bucket,
    created: created.ok,
    status: created.status,
    message:
      created.ok || created.status === 409
        ? 'object storage bucket is ready'
        : `object storage bucket creation failed: ${created.status} ${created.statusText}`,
  };
}

export function getStorageBucketName(env: NodeJS.ProcessEnv = process.env): string {
  return env.S3_BUCKET ?? env.MINIO_BUCKET ?? 'tieout-local';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
