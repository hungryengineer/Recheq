export interface RequestContext {
  requestId: string;
  service: string;
  startedAtMs: number;
  caseId?: string;
}

export interface CreateRequestContextInput {
  requestId: string;
  service?: string;
  caseId?: string;
  startedAtMs?: number;
}

export function createRequestContext(input: CreateRequestContextInput): RequestContext {
  return {
    requestId: input.requestId,
    service: input.service ?? 'api',
    startedAtMs: input.startedAtMs ?? Date.now(),
    ...(input.caseId ? { caseId: input.caseId } : {}),
  };
}

export function getDurationMs(context: RequestContext, endedAtMs = Date.now()): number {
  return Math.max(0, endedAtMs - context.startedAtMs);
}
