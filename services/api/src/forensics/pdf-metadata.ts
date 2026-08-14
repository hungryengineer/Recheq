/**
 * PDF metadata extraction module.
 * Extracts producer, creator, creation_date, and modification_date from PDF documents.
 * Safe to log: all outputs are strings or timestamps, never raw PDF content.
 */

/**
 * Represents extracted PDF metadata.
 * All fields are nullable to gracefully handle PDFs with missing metadata.
 */
export interface PdfMetadata {
  producer: string | null;
  creator: string | null;
  creation_date: Date | null;
  modification_date: Date | null;
}

/**
 * Safely parse a date string from PDF metadata.
 * PDF dates can be in various formats; this handles the common cases.
 * Returns null if parsing fails (graceful degradation).
 */
export function parseMetadataDate(dateStr: string | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = dateStr.trim();

  try {
    // Try parsing as ISO 8601
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Fall through to graceful null
  }

  return null;
}

/**
 * Safely extract string metadata field.
 * Returns null if field is missing or not a string (graceful degradation).
 */
export function extractMetadataString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Reject empty strings
    return trimmed.length > 0 ? trimmed : null;
  }

  // If it's an object with a string representation, try stringifying
  if (typeof value === 'object') {
    try {
      const str = String(value);
      const trimmed = str.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extract metadata from a parsed PDF document.
 * Accepts the result from pdf-parse library.
 * Gracefully handles missing fields: returns null for any missing metadata.
 *
 * @param pdfInfo - PDF info object from pdf-parse (typically doc.info from await pdf(buffer))
 * @returns Extracted metadata with safe null handling
 */
export function extractPdfMetadata(pdfInfo: Record<string, unknown>): PdfMetadata {
  if (!pdfInfo || typeof pdfInfo !== 'object') {
    return {
      producer: null,
      creator: null,
      creation_date: null,
      modification_date: null,
    };
  }

  return {
    producer: extractMetadataString(pdfInfo.Producer),
    creator: extractMetadataString(pdfInfo.Creator),
    creation_date: parseMetadataDate(pdfInfo.CreationDate as string | undefined),
    modification_date: parseMetadataDate(pdfInfo.ModDate as string | undefined),
  };
}
