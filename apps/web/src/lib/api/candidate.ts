import { z } from 'zod';
import { CaseStatus, DocumentKind } from '@tieout/schema';

export interface PublicCaseContext {
  orgName: string;
  employerName: string;
  candidateName: string;
  status: z.infer<typeof CaseStatus>;
  documentsRequired: z.infer<typeof DocumentKind>[];
  documentsProvided: z.infer<typeof DocumentKind>[];
}

// ─── Zod schema for the candidate API response ───────────────────
// Validates the shape returned by GET /api/public/[token]/candidate
// so unknown DB values are caught at the boundary, not silently cast.
const CandidateResponseSchema = z.object({
  orgName: z.string(),
  employerName: z.string(),
  candidateName: z.string(),
  title: z.string(),
  status: CaseStatus,
  consent_status: z.enum(['pending', 'granted', 'withdrawn']).nullable(),
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

export async function getCaseByToken(token: string): Promise<PublicCaseContext> {
  const response = await apiFetch(`/api/public/${token}/candidate`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error('TOKEN_INVALID');
  }

  const raw = await response.json();
  const data = CandidateResponseSchema.parse(raw);

  return {
    orgName: data.orgName,
    employerName: data.employerName,
    candidateName: data.candidateName,
    status: data.status,
    documentsRequired: data.documentsRequired,
    documentsProvided: data.documentsProvided,
  };
}

export async function grantConsent(token: string, _ip: string, _userAgent: string): Promise<void> {
  // Send only the version; the server derives the canonical consent text.
  const response = await apiFetch(`/api/public/${token}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_version: CONSENT_VERSION }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error(
      (data as { error?: { message?: string } } | null)?.error?.message ||
        'Failed to grant consent',
    );
  }
}

export async function withdrawConsent(token: string): Promise<void> {
  const response = await apiFetch(`/api/public/${token}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    throw new Error(
      (data as { error?: { message?: string } } | null)?.error?.message ||
        'Failed to withdraw consent',
    );
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
    const data = await response.json().catch(() => null);
    if (response.status === 410) throw new Error('TOKEN_EXPIRED');
    if (response.status === 413) throw new Error('FILE_TOO_LARGE');
    throw new Error(
      (data as { error?: { message?: string } } | null)?.error?.message ||
        'Failed to upload document',
    );
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
    const data = await response.json().catch(() => null);
    throw new Error(
      (data as { error?: { message?: string } } | null)?.error?.message ||
        'Failed to submit dispute',
    );
  }
}
