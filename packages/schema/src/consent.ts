import { z } from 'zod';
import { ConsentStatus } from './enums.js';

// ─── Consent Record ─────────────────────────────────────────────
export const ConsentRecord = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  status: ConsentStatus,
  /** Verbatim consent text shown to the candidate */
  consent_text: z.string().min(1),
  /** Version identifier for the consent text */
  consent_version: z.string().min(1),
  /** Timestamp when consent was granted */
  granted_at: z.string().datetime().nullable(),
  /** IP address of the consenting party */
  ip_address: z.string().nullable(),
  /** User agent string of the consenting party */
  user_agent: z.string().nullable(),
  /** Timestamp when consent was withdrawn (if applicable) */
  withdrawn_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

// ─── Consent Grant Input ────────────────────────────────────────
export const ConsentGrantInput = z.object({
  /** Verbatim consent text shown to and accepted by the candidate */
  consent_text: z.string().min(1),
  /** Version identifier for the consent text */
  consent_version: z.string().min(1),
});
export type ConsentGrantInput = z.infer<typeof ConsentGrantInput>;
