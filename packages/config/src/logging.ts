export const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /id[-_]?token/i,
  /token/i,
  /secret/i,
  /password/i,
  /signed[-_]?url/i,
  /document[-_]?content/i,
  /document[-_]?text/i,
  /raw[-_]?document/i,
  /extraction[-_]?payload/i,
  /extracted[-_]?payload/i,
  /extracted[-_]?text/i,
];

const SIGNED_URL_PATTERNS = [
  /X-Amz-Signature=/i,
  /X-Amz-Credential=/i,
  /X-Goog-Signature=/i,
  /GoogleAccessId=/i,
  /sig=/i,
  /signature=/i,
];

export type LogPrimitive = string | number | boolean | null;
export type LogValue = LogPrimitive | LogValue[] | { [key: string]: LogValue };
export type LogFields = Record<string, unknown>;

export interface LogRecord {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  event: string;
  durationMs: number;
  caseId?: string;
  requestId?: string;
  fields?: LogValue;
}

export interface CreateLogRecordInput {
  level: LogRecord['level'];
  service: string;
  event: string;
  durationMs: number;
  caseId?: string;
  requestId?: string;
  fields?: LogFields;
  now?: Date;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function isSignedUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  return SIGNED_URL_PATTERNS.some((pattern) => pattern.test(value));
}

export function redactForLogging(value: unknown): LogValue {
  return redactValue(value, new WeakSet<object>());
}

export function createLogRecord(input: CreateLogRecordInput): LogRecord {
  const record: LogRecord = {
    timestamp: (input.now ?? new Date()).toISOString(),
    level: input.level,
    service: input.service,
    event: input.event,
    durationMs: Math.max(0, Math.round(input.durationMs)),
  };

  if (input.caseId) {
    record.caseId = input.caseId;
  }

  if (input.requestId) {
    record.requestId = input.requestId;
  }

  if (input.fields) {
    record.fields = redactObject(input.fields, new WeakSet<object>());
  }

  return record;
}

function redactValue(value: unknown, seen: WeakSet<object>): LogValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    if (typeof value === 'string' && isSignedUrl(value)) {
      return REDACTED_VALUE;
    }

    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return redactObject(value as Record<string, unknown>, seen);
  }

  return String(value);
}

function redactObject(
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): { [key: string]: LogValue } {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : redactValue(item, seen),
    ]),
  );
}
