// ─── Payslip Extraction Prompt v1 ───────────────────────────────
// Versioned prompt for payslip extraction.
//
// NOTE (2026-09-06): The JSON shape was corrected to include the
// schema-required "pan" key. The payslip Zod schema (packages/schema/src/payslip.ts)
// REQUIRES "pan" (nullable); without it the emitted JSON always failed schema
// validation and every payslip silently fell back to regex. The emitted
// schema_version remains "payslip-v1" to match the frozen extraction schema.
// The prompt<->schema contract is now enforced by
// services/api/tests/extraction-prompt-contract.test.ts.
//
// NEVER modify this file after deployment — create payslip-v2.ts instead.

export const PAYSLIP_PROMPT_VERSION = 'payslip-v1' as const;

/**
 * System prompt for payslip extraction.
 * Injected as the system/developer turn before the document content.
 */
export const PAYSLIP_SYSTEM_PROMPT = `\
You are a precise document data-extraction assistant specialising in Indian payslips.
Your only job is to read values that are explicitly printed on the document and return them as JSON.

FOUR INVARIANTS — these are absolute and override everything else:
1. Return null for anything not legible or not present on the document. Never guess.
2. Do not compute any value. Read printed figures only — never add, subtract, or derive.
3. Preserve every label verbatim as printed in the raw_label field, including abbreviations and punctuation.
4. Explain every null in extraction_notes. If a field is null, add a short reason in extraction_notes.

ADDITIONAL RULES:
5. NEVER convert units or currencies.
6. Copy every number EXACTLY as printed (digits only, no currency symbols).
7. Return ONLY valid JSON — no markdown, no explanations, no code fences.
8. Missing or illegible fields must be null; NEVER use 0, "", or a placeholder.
` as const;

/**
 * User-turn instruction appended after the document content.
 * Describes the exact JSON shape the model must return.
 */
export const PAYSLIP_USER_INSTRUCTION = `\
Extract the information above into this exact JSON shape.
Preserve the exact printed label for every salary component in the "raw_label" field.
Do NOT compute any arithmetic.

{
  "employee_name": string | null,
  "employee_id": string | null,
  "employer_name": string | null,
  "month": string | null,
  "year": number | null,
  "basic": { "raw_label": string | null, "amount": number | null },
  "hra": { "raw_label": string | null, "amount": number | null },
  "da": { "raw_label": string | null, "amount": number | null },
  "special_allowance": { "raw_label": string | null, "amount": number | null },
  "other_allowances": [
    { "raw_label": string | null, "amount": number | null }
    // one object per extra allowance line; empty array [] if none
  ],
  "gross_salary": number | null,
  "pf_deduction": number | null,
  "professional_tax": number | null,
  "income_tax": number | null,
  "other_deductions": number | null,
  "total_deductions": number | null,
  "net_salary": number | null,
  "uan": string | null,
  "pf_account_number": string | null,
  "pan": string | null,
  "extraction_notes": string | null,
  "schema_version": "payslip-v1"
}

Respond with ONLY the JSON object.
` as const;

/**
 * Builds the full prompt pair for a payslip extraction request.
 *
 * @param documentText  Plain-text content of the payslip (already extracted
 *                      from the PDF upstream — never pass raw binary).
 * @param retryHint     Optional validation error from the previous attempt,
 *                      included verbatim so the model can self-correct.
 */
export function buildPayslipPrompt(
  documentText: string,
  retryHint?: string,
): { system: string; user: string } {
  const retryBlock =
    retryHint != null
      ? `\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION — fix these issues:\n${retryHint}\n`
      : '';

  return {
    system: PAYSLIP_SYSTEM_PROMPT,
    user: `${retryBlock}DOCUMENT:\n${documentText}\n\n${PAYSLIP_USER_INSTRUCTION}`,
  };
}
