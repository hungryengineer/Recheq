import {
  createLogRecord,
  type CreateLogRecordInput,
  type LogFields,
  type LogRecord,
} from '../../../../packages/config/src/logging.js';
import { getDurationMs, type RequestContext } from './request-context.js';

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug: (event: string, context: RequestContext, fields?: LogFields) => LogRecord;
  info: (event: string, context: RequestContext, fields?: LogFields) => LogRecord;
  warn: (event: string, context: RequestContext, fields?: LogFields) => LogRecord;
  error: (event: string, context: RequestContext, fields?: LogFields) => LogRecord;
  fatal: (event: string, context: RequestContext, fields?: LogFields) => LogRecord;
  requestCompleted: (
    event: string,
    context: RequestContext,
    fields?: LogFields,
    endedAtMs?: number,
  ) => LogRecord;
}

export function createLogger(sink: LogSink = writeJsonLog): Logger {
  const emit = (
    level: CreateLogRecordInput['level'],
    event: string,
    context: RequestContext,
    fields?: LogFields,
    durationMs = getDurationMs(context),
  ): LogRecord => {
    const input: CreateLogRecordInput = {
      level,
      service: context.service,
      event,
      durationMs,
    };

    if (context.caseId) {
      input.caseId = context.caseId;
    }

    if (context.requestId) {
      input.requestId = context.requestId;
    }

    if (fields) {
      input.fields = fields;
    }

    const record = createLogRecord(input);

    sink(record);
    return record;
  };

  return {
    debug: (event, context, fields) => emit('debug', event, context, fields),
    info: (event, context, fields) => emit('info', event, context, fields),
    warn: (event, context, fields) => emit('warn', event, context, fields),
    error: (event, context, fields) => emit('error', event, context, fields),
    fatal: (event, context, fields) => emit('fatal', event, context, fields),
    requestCompleted: (event, context, fields, endedAtMs) =>
      emit('info', event, context, fields, getDurationMs(context, endedAtMs)),
  };
}

export function writeJsonLog(record: LogRecord): void {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}
