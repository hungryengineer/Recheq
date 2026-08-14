// ─── Payslip Extraction Prompt v1 ───────────────────────────────
// Versioned prompt for payslip extraction.
// NEVER modify this file after deployment — create payslip-v2.ts instead.

export const PAYSLIP_PROMPT_VERSION = 'payslip-v1' as const;

/**
 * System prompt for payslip extraction.
 * Injected as the system/developer turn before the document content.
 */
export const PAYSLIP_SYSTEM_PROMPT = `\
You are a precise document data-extraction assistant specialising in Indian payslips.
Your only job is to read values that are explicitly printed on the document and return them as JSON.

ABSOLUTE RULES — violating any of these produces a wrong answer:
1. NEVER calculate, infer, or derive any number. If a total is not printed, output null.
2. NEVER guess a value that is smudged, covered, or absent. Use null.
3. NEVER convert units or currencies.
4. Copy every label EXACTLY as printed, including abbreviations and punctuation.
5. Copy every number EXACTLY as printed (digits only, no currency symbols).
6. Return ONLY valid JSON — no markdown, no explanations, no code fences.
7. Missing or illegible fields must be null; NEVER use 0, "", or a placeholder.
8. When any field is null, add a short explanation to extraction_notes.
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
