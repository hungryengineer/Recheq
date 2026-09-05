import { randomUUID } from 'node:crypto';
import {
  createConsentDeps,
  createDocumentDeps,
  createTokenVerifier,
  createDocumentStorageFromEnv,
} from '@recheq/api/web';
import type { ConsentServiceDeps } from '@recheq/api/web';
import type { DocumentServiceDeps } from '@recheq/api/web';
import { getDb } from './db';

export function createRequestContext() {
  return {
    service: 'web',
    requestId: randomUUID(),
    startedAtMs: Date.now(),
  };
}

export function getConsentDeps(): ConsentServiceDeps {
  return createConsentDeps(getDb());
}

export function getDocumentDeps(): DocumentServiceDeps {
  return createDocumentDeps(getDb(), createDocumentStorageFromEnv());
}

export function getTokenVerifier() {
  return createTokenVerifier(getDb());
}
