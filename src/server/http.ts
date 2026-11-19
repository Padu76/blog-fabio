// E:\blog-fabio\src\server\http.ts
// Risposte JSON uniformi, errori con codice stabile e request_id, controllo Origin per le mutazioni.
import 'server-only';
import { NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';

export type ErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'BOOK_NOT_FOUND'
  | 'COVER_UNAVAILABLE' | 'PROVIDER_TIMEOUT' | 'PROVIDER_RATE_LIMITED' | 'PROVIDER_UNAVAILABLE'
  | 'AI_OUTPUT_INVALID' | 'AI_NOT_CONFIGURED' | 'AI_DISABLED' | 'REVISION_CONFLICT' | 'BUDGET_EXCEEDED'
  | 'RATE_LIMITED' | 'SUGGESTION_STALE' | 'CONFIG_MISSING' | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION_ERROR: 422, BOOK_NOT_FOUND: 404,
  COVER_UNAVAILABLE: 422, PROVIDER_TIMEOUT: 504, PROVIDER_RATE_LIMITED: 429, PROVIDER_UNAVAILABLE: 502,
  AI_OUTPUT_INVALID: 502, AI_NOT_CONFIGURED: 503, AI_DISABLED: 503, REVISION_CONFLICT: 409,
  BUDGET_EXCEEDED: 429, RATE_LIMITED: 429, SUGGESTION_STALE: 409, CONFIG_MISSING: 503, INTERNAL: 500,
};

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public retryable = false, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'private, no-store', ...init?.headers } });
}

export function fail(err: unknown) {
  const requestId = crypto.randomUUID();
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, retryable: err.retryable, request_id: requestId, ...err.extra } },
      { status: STATUS[err.code], headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error(`[${requestId}]`, err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Errore inatteso. Riprova tra poco.', retryable: true, request_id: requestId } },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Errori Postgres sollevati dalle RPC: message = codice, details = testo leggibile. */
export function fromDbError(e: { message?: string; details?: string | null; code?: string } | null): AppError {
  const known: ErrorCode[] = ['FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'REVISION_CONFLICT', 'COVER_UNAVAILABLE'];
  const code = (e?.message ?? '') as ErrorCode;
  if (known.includes(code)) return new AppError(code, e?.details || 'Operazione non riuscita.');
  console.error('DB error', e?.code, e?.message);
  return new AppError('INTERNAL', 'Errore del database. Riprova tra poco.', true);
}

/** Protezione CSRF per mutazioni con cookie: l'Origin deve essere il sito stesso. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) throw new AppError('FORBIDDEN', 'Richiesta non valida (origine mancante).');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* vuoto */ }
  const allowed = new Set([host, new URL(publicEnv.siteUrl).host].filter(Boolean));
  if (!allowed.has(originHost)) throw new AppError('FORBIDDEN', 'Richiesta non valida (origine).');
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Dati non leggibili.');
  }
}
