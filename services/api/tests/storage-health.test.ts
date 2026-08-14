import { describe, expect, it } from 'vitest';

import { ensureStorageBucket } from '../src/storage/storage-health.js';
import { createS3Client, type S3Response, type S3Transport } from '../src/storage/s3-client.js';

describe('storage health', () => {
  it('creates a missing bucket without applying a public ACL', async () => {
    const requests: RequestInit[] = [];
    const transport: S3Transport = async (_url, init) => {
      requests.push(init);
      return requests.length === 1 ? response(404, 'Not Found') : response(200, 'OK');
    };
    const client = createS3Client(testConfig, transport);

    const result = await ensureStorageBucket('tieout-local', client);

    expect(result).toMatchObject({
      ok: true,
      bucket: 'tieout-local',
      created: true,
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.method).toBe('HEAD');
    expect(requests[1]?.method).toBe('PUT');
    expect(new Headers(requests[1]?.headers).has('x-amz-acl')).toBe(false);
  });

  it('does not recreate an existing bucket', async () => {
    const requests: RequestInit[] = [];
    const transport: S3Transport = async (_url, init) => {
      requests.push(init);
      return response(200, 'OK');
    };
    const client = createS3Client(testConfig, transport);

    const result = await ensureStorageBucket('tieout-local', client);

    expect(result).toMatchObject({
      ok: true,
      bucket: 'tieout-local',
      created: false,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('HEAD');
  });
});

const testConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
};

function response(status: number, statusText: string): S3Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
  };
}
