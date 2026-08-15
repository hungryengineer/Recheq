import { describe, expect, it } from 'vitest';

import { ensureStorageBucket } from '../src/storage/storage-health.js';
import { createS3Client, type S3Response, type S3Transport } from '../src/storage/s3-client.js';
import { createDocumentStorage } from '../src/storage/document-storage.js';

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

  it('signs with a space after the AWS4-HMAC-SHA256 scheme (MinIO rejects the comma variant)', async () => {
    const requests: RequestInit[] = [];
    const transport: S3Transport = async (_url, init) => {
      requests.push(init);
      return response(200, 'OK');
    };
    const client = createS3Client(testConfig, transport);

    await client.headBucket('tieout-local');

    const authorization = new Headers(requests[0]?.headers).get('authorization');
    expect(authorization).toBeDefined();
    expect(authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    expect(authorization).not.toMatch(/^AWS4-HMAC-SHA256, /);
    expect(authorization).toContain(', SignedHeaders=host;x-amz-content-sha256;x-amz-date,');
    expect(authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it('signs object PUTs with a millisecond-free x-amz-date and space-separated scheme', async () => {
    const requests: RequestInit[] = [];
    const transport: S3Transport = async (_url, init) => {
      requests.push(init);
      return response(200, 'OK');
    };
    const storage = createDocumentStorage(
      {
        ...testConfig,
        bucket: 'documents',
        forcePathStyle: true,
      },
      transport,
    );

    await storage.putObject('cases/1/doc.pdf', Buffer.from('%PDF-1.7'), 'application/pdf');

    const headers = new Headers(requests[0]?.headers);
    const xAmzDate = headers.get('x-amz-date');
    const authorization = headers.get('authorization');

    expect(xAmzDate).toMatch(/^\d{8}T\d{6}Z$/);
    expect(xAmzDate).not.toContain('.');
    expect(authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    expect(authorization).not.toMatch(/^AWS4-HMAC-SHA256, /);
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
