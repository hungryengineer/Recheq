import { z } from 'zod';

export const EpfoContributionSchema = z.object({
  /** YYYY-MM */
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM'),
  employee_share: z.number(),
  employer_share: z.number(),
});
export type EpfoContribution = z.infer<typeof EpfoContributionSchema>;

export const EpfoPeriodSchema = z.object({
  employerName: z.string().min(1),
  establishmentId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1).nullable(),
  // Optional: timeline-only providers (Employment History by UAN) do not return
  // contribution amounts. Those require a separate OTP-gated Passbook API.
  contributions: z.array(EpfoContributionSchema).optional(),
});
export type EpfoPeriod = z.infer<typeof EpfoPeriodSchema>;

export const EpfoHistorySchema = z.object({
  uan: z.string().min(1),
  periods: z.array(EpfoPeriodSchema),
});
export type EpfoHistory = z.infer<typeof EpfoHistorySchema>;

export interface EpfoProvider {
  /**
   * Provenance identifier for the underlying data source, recorded in the audit
   * chain. Must be a member of PROVENANCE_REGISTER in @recheq/workflow.
   */
  readonly sourceId: string;
  fetchEmploymentHistory(uan: string, consentId: string): Promise<EpfoHistory | null>;
}
