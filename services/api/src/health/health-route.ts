import { Socket } from 'node:net';

import { checkStorageHealth } from '../storage/storage-health.js';

export interface HealthCheck {
  name: string;
  ok: boolean;
  message: string;
  durationMs: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  service: 'api';
  checks: HealthCheck[];
}

export interface HealthRouteResponse {
  statusCode: 200 | 503;
  body: HealthResponse;
}

export async function getLiveness(): Promise<HealthRouteResponse> {
  return {
    statusCode: 200,
    body: {
      status: 'ok',
      service: 'api',
      checks: [createCheck('process', true, 'api process is running', 0)],
    },
  };
}

export async function getReadiness(): Promise<HealthRouteResponse> {
  const checks = await Promise.all([checkPostgres(), checkObjectStorage()]);
  const ready = checks.every((check) => check.ok);

  return {
    statusCode: ready ? 200 : 503,
    body: {
      status: ready ? 'ok' : 'error',
      service: 'api',
      checks,
    },
  };
}

export async function checkPostgres(env: NodeJS.ProcessEnv = process.env): Promise<HealthCheck> {
  const startedAt = Date.now();
  const url = new URL(env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/recheq');

  try {
    await checkTcpConnection(url.hostname, Number(url.port || 5432), 2_000);
    return createCheck('postgres', true, 'postgres is reachable', Date.now() - startedAt);
  } catch (error) {
    return createCheck('postgres', false, getErrorMessage(error), Date.now() - startedAt);
  }
}

export async function checkObjectStorage(): Promise<HealthCheck> {
  const startedAt = Date.now();
  const result = await checkStorageHealth();

  return createCheck('object-storage', result.ok, result.message, Date.now() - startedAt);
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
      reject(new Error(`postgres connection timed out at ${host}:${port}`));
    });
    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
    socket.connect(port, host);
  });
}

function createCheck(name: string, ok: boolean, message: string, durationMs: number): HealthCheck {
  return {
    name,
    ok,
    message,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
