// ─── Form 16 Extraction Prompt v1 ───────────────────────────────
// Versioned prompt for Form 16 (Part A + Part B) extraction.
//
// NOTE (2026-09-06): Added explicit PAN/TAN disambiguation so the model stops
// swapping employee_pan with employer_pan (they are both 10-char PANs and were
// observed to be transposed). The emitted schema_version remains "form16-v1".
// The prompt<->schema contract is enforced by
// services/api/tests/extraction-prompt-contract.test.ts.
//
// NEVER modify this file after deployment — create form16-v2.ts instead.

export const FORM16_PROMPT_VERSION = 'form16-v1' as const;

/**
 * System prompt for Form 16 extraction.
 * Injected as the system/developer turn before the document content.
 */
export const FORM16_SYSTEM_PROMPT = `\
You are a precise document data-extraction assistant specialising in Indian Form 16 (TDS certificate).
Your only job is to read values that are explicitly printed on the document and return them as JSON.

FOUR INVARIANTS — these are absolute and override everything else:
1. Return null for anything not legible or not present on the document. Never guess.
2. Do not compute any value. Read printed figures only — never add, subtract, or derive.
3. Preserve every string-typed field verbatim as printed, including punctuation and formatting.
   This does not apply to numeric fields — see rule 6.
4. Explain every null in extraction_notes. If a field is null, add a short reason in extraction_notes.

ADDITIONAL RULES:
5. NEVER convert units or currencies.
6. Copy every number EXACTLY as printed (digits only, no currency symbols).
7. Return ONLY valid JSON — no markdown, no explanations, no code fences.
8. Missing or illegible fields must be null; NEVER use 0, "", or a placeholder.

PAN/TAN DISAMBIGUATION (critical — do not swap these):
9. "employee_pan" is the Permanent Account Number of the INDIVIDUAL whose name is
   in "employee_name" (usually printed next to the employee's name/address in
   Part A). It is a 10-char PAN (e.g. ABCDE1234F).
10. "employer_pan" is the PAN of the EMPLOYER / deductor whose name is in
    "employer_name". This is a 10-char PAN.
11. "employer_tan" is the employer's Tax Deduction Account Number (10 chars,
    format: 4 letters + 5 digits + 1 letter). It is NOT a PAN.
12. If the document shows only one PAN, decide owner by what it is printed next to:
    next to the employee's name/address → employee_pan; next to the deductor /
    employer section → employer_pan. Never invent or copy the same PAN into both
    unless both are explicitly printed.

Form 16 has two parts — Part A (TDS summary) and Part B (salary breakdown).
Extract fields from whichever part(s) are present; use null for parts that are absent.
` as const;

/**
 * User-turn instruction appended after the document content.
 * Describes the exact JSON shape the model must return.
 */
export const FORM16_USER_INSTRUCTION = `\
Extract the information above into this exact JSON shape.
Do NOT compute any arithmetic.

{
  "employee_name": string | null,
  "employee_pan": string | null,   // PAN of the person in employee_name
  "employer_name": string | null,
  "employer_tan": string | null,   // employer's TAN (NOT a PAN)
  "employer_pan": string | null,   // PAN of the deductor in employer_name
  "financial_year": string | null,
  "assessment_year": string | null,
  "total_tax_deducted": number | null,
  "total_tax_deposited": number | null,
  "gross_total_income": number | null,
  "total_salary": number | null,
  "exempt_allowances": number | null,
  "standard_deduction": number | null,
  "professional_tax": number | null,
  "net_taxable_salary": number | null,
  "total_income_tax_payable": number | null,
  "extraction_notes": string | null,
  "schema_version": "form16-v1"
}

Respond with ONLY the JSON object.
` as const;

/**
 * Builds the full prompt pair for a Form 16 extraction request.
 *
 * @param documentText  Plain-text content of the Form 16 (already extracted
 *                      from the PDF upstream — never pass raw binary).
 * @param retryHint     Optional validation error from the previous attempt,
 *                      included verbatim so the model can self-correct.
 */
export function buildForm16Prompt(
  documentText: string,
  retryHint?: string,
): { system: string; user: string } {
  const retryBlock =
    retryHint != null
      ? `\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION — fix these issues:\n${retryHint}\n`
      : '';

  return {
    system: FORM16_SYSTEM_PROMPT,
    user: `${retryBlock}DOCUMENT:\n${documentText}\n\n${FORM16_USER_INSTRUCTION}`,
  };
}
