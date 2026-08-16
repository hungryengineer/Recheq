export declare const REDACTED_VALUE = '[REDACTED]';
export type LogPrimitive = string | number | boolean | null;
export type LogValue =
  | LogPrimitive
  | LogValue[]
  | {
      [key: string]: LogValue;
    };
export type LogFields = Record<string, unknown>;
export interface LogRecord {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
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
export declare function isSensitiveKey(key: string): boolean;
export declare function isSignedUrl(value: string): boolean;
export declare function redactForLogging(value: unknown): LogValue;
export declare function createLogRecord(input: CreateLogRecordInput): LogRecord;
//# sourceMappingURL=logging.d.ts.map
