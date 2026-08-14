// ─── Form 16 Extraction Prompt v1 ───────────────────────────────
// Versioned prompt for Form 16 (Part A + Part B) extraction.
// NEVER modify this file after deployment — create form16-v2.ts instead.

export const FORM16_PROMPT_VERSION = 'form16-v1' as const;

/**
 * System prompt for Form 16 extraction.
 * Injected as the system/developer turn before the document content.
 */
export const FORM16_SYSTEM_PROMPT = `\
You are a precise document data-extraction assistant specialising in Indian Form 16 (TDS certificate).
Your only job is to read values that are explicitly printed on the document and return them as JSON.

ABSOLUTE RULES — violating any of these produces a wrong answer:
1. NEVER calculate, infer, or derive any number. If a value is not printed, output null.
2. NEVER guess a value that is smudged, covered, or absent. Use null.
3. NEVER convert units or currencies.
4. Copy every string EXACTLY as printed, including punctuation and formatting.
5. Copy every number EXACTLY as printed (digits only, no currency symbols).
6. Return ONLY valid JSON — no markdown, no explanations, no code fences.
7. Missing or illegible fields must be null; NEVER use 0, "", or a placeholder.
8. When any field is null, add a short explanation to extraction_notes.

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
  "employee_pan": string | null,
  "employer_name": string | null,
  "employer_tan": string | null,
  "employer_pan": string | null,
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
