import { z } from 'zod';
import { CaseStatus, ConsentStatus, DocumentKind } from '@tieout/schema';

export interface PublicCaseContext {
  orgName: string;
  employerName: string;
  candidateName: string;
  status: z.infer<typeof CaseStatus>;
  documentsRequired: z.infer<typeof DocumentKind>[];
  documentsProvided: z.infer<typeof DocumentKind>[];
}

// ─── Zod schema for the candidate API response ───────────────────
// Validates the shape returned by GET /api/public/[token]/candidate so unknown
// DB values are caught at the boundary, not silently cast.
const CandidateResponseSchema = z.object({
  orgName: z.string(),
  employerName: z.string(),
  candidateName: z.string(),
  title: z.string(),
  status: CaseStatus,
  // Use the shared ConsentStatus enum rather than a duplicated inline z.enum.
  consent_status: ConsentStatus.nullable(),
  documentsRequired: z.array(DocumentKind),
  documentsProvided: z.array(DocumentKind),
});

// The consent version is managed server-side. The client sends only the
// version identifier; the server derives the full consent text.
const CONSENT_VERSION = '1';

// ─── Shared fetch helper ─────────────────────────────────────────
// Applies a 15-second timeout and maps network/DNS/abort failures to a
// recoverable NETWORK_ERROR message. HTTP-level errors are handled by callers.
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      ...init,
    });
  } catch (err) {
    // DOMException with name AbortError covers both timeout and manual abort.
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out'
        : 'Network error — check your connection and try again';
    throw new Error(`NETWORK_ERROR: ${message}`);
  }
}

// ─── Shared error-message extractor ──────────────────────────────
// Safely parses a JSON response body and returns the nested error message or
// the supplied fallback. Used for all four API error-handling sites below to
// avoid repeated inline casts.
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: unknown }).error === 'object' &&
      (body as { error: { message?: unknown } }).error !== null &&
      typeof (body as { error: { message?: unknown } }).error.message === 'string'
    ) {
      return (body as { error: { message: string } }).error.message;
    }
  } catch {
    // Ignore parse failures — use fallback.
  }
  return fallback;
}

export async function getCaseByToken(token: string): Promise<PublicCaseContext> {
  const response = await apiFetch(`/api/public/${token}/candidate`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error('TOKEN_INVALID');
  }

  // Guard the parse: a proxy may return a 200 HTML error page. .catch() turns
  // a non-JSON body into null, which then fails safeParse below with the same
  // stable CANDIDATE_API_ERROR message instead of a raw SyntaxError.
  const raw = await response.json().catch(() => null);

  // Use safeParse so a malformed payload produces a clear error rather than an
  // unhandled ZodError propagating to the UI.
  const parsed = CandidateResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('CANDIDATE_API_ERROR: unexpected response shape from server');
  }
  const data = parsed.data;

  return {
    orgName: data.orgName,
    employerName: data.employerName,
    candidateName: data.candidateName,
    status: data.status,
    documentsRequired: data.documentsRequired,
    documentsProvided: data.documentsProvided,
  };
}

// ip and userAgent are collected server-side on the consent route; the client
// does not need to pass them.
export async function grantConsent(token: string): Promise<void> {
  // Send only the version; the server derives the canonical consent text.
  const response = await apiFetch(`/api/public/${token}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_version: CONSENT_VERSION }),
  });

  if (!response.ok) {
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error(await readErrorMessage(response, 'Failed to grant consent'));
  }
}

export async function withdrawConsent(token: string): Promise<void> {
  const response = await apiFetch(`/api/public/${token}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error(await readErrorMessage(response, 'Failed to withdraw consent'));
  }
}

export async function uploadDocument(
  token: string,
  kind: z.infer<typeof DocumentKind>,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);

  const response = await apiFetch(`/api/public/${token}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    if (response.status === 413) throw new Error('FILE_TOO_LARGE');
    throw new Error(await readErrorMessage(response, 'Failed to upload document'));
  }
}

export async function submitUan(_token: string, _uan: string): Promise<void> {
  // UAN submission is not yet wired to the backend; the EPFO pull runs later.
}

export async function submitDocuments(_token: string): Promise<void> {
  // TODO: wire to POST /api/public/[token]/submit once the backend endpoint exists.
  throw new Error('NOT_IMPLEMENTED: document submission is not yet wired to the backend');
}

export async function disputeFinding(
  token: string,
  findingId: string,
  reason: string,
): Promise<void> {
  if (reason.trim().length === 0) {
    throw new Error('Dispute reason is required');
  }

  const response = await apiFetch(`/api/public/${token}/dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_id: findingId, reason }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to submit dispute'));
  }
}
