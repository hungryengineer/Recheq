import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from '@recheq/config/src/logging.js';
import { createLogger, type LogSink } from '../src/observability/logger.js';
import { createRequestContext } from '../src/observability/request-context.js';

describe('structured logging redaction', () => {
  it('includes service, event, case ID, request ID, and duration', () => {
    const records: Parameters<LogSink>[0][] = [];
    const logger = createLogger((record) => records.push(record));
    const context = createRequestContext({
      requestId: 'req_123',
      service: 'api',
      caseId: 'case_456',
      startedAtMs: 1_000,
    });

    logger.requestCompleted('case.upload.completed', context, { statusCode: 201 }, 1_247);

    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    expect(record).toMatchObject({
      service: 'api',
      event: 'case.upload.completed',
      caseId: 'case_456',
      requestId: 'req_123',
      durationMs: 247,
      fields: { statusCode: 201 },
    });
  });

  it('redacts known sensitive fields before a log record is emitted', () => {
    const records: Parameters<LogSink>[0][] = [];
    const logger = createLogger((record) => records.push(record));
    const context = createRequestContext({
      requestId: 'req_sensitive',
      service: 'api',
      caseId: 'case_sensitive',
      startedAtMs: 2_000,
    });

    logger.info('document.extraction.received', context, {
      documentContent: 'invoice body with private customer details',
      extractionPayload: {
        vendor: 'Acme',
        lineItems: [{ description: 'private line item', amount: 42 }],
      },
      accessToken: 'token-value',
      refresh_token: 'refresh-token-value',
      authorization: 'Bearer token-value',
      apiKey: 'api-key-value',
      secret: 'secret-value',
      signedUrl: 'https://storage.example.com/object.pdf?X-Amz-Signature=abc123',
      nested: {
        documentText: 'OCR text',
        downloadUrl: 'https://storage.example.com/object.pdf?signature=abc123',
        safeField: 'safe value',
      },
    });

    const record = records[0];

    expect(record).toBeDefined();

    const serialized = JSON.stringify(record);

    expect(serialized).not.toContain('invoice body with private customer details');
    expect(serialized).not.toContain('private line item');
    expect(serialized).not.toContain('token-value');
    expect(serialized).not.toContain('refresh-token-value');
    expect(serialized).not.toContain('Bearer token-value');
    expect(serialized).not.toContain('api-key-value');
    expect(serialized).not.toContain('secret-value');
    expect(serialized).not.toContain('X-Amz-Signature=abc123');
    expect(serialized).not.toContain('signature=abc123');
    expect(serialized).not.toContain('OCR text');
    expect(serialized).toContain(REDACTED_VALUE);
    expect(serialized).toContain('safe value');
  });
});
