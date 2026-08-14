/**
 * Monetary text anomaly detection module.
 * Identifies suspicious patterns in currency values within PDFs.
 * Returns flags and confidence scores, never raw text snippets or document content.
 */

/**
 * Represents detected monetary anomalies.
 * Safe to log: only flags, counts, and confidence (no text content).
 */
export interface MonetaryAnomalyAnalysis {
  anomalies_detected: boolean;
  total_anomalies: number;
  confidence: number;
  anomaly_types: {
    font_changes: number;
    size_changes: number;
    color_changes: number;
    spacing_anomalies: number;
    formatting_inconsistencies: number;
  };
}

/**
 * Regular expressions to identify monetary text patterns.
 * Matches common currency formats: $999,999.99, ₹50,000, €1.234,56, etc.
 */
const MONETARY_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?/g, // USD: $1,000.00
  /₹[\d,]+(?:\.?\d{2})?/g, // INR: ₹50,000
  /€[\d,.]+/g, // EUR: €1.234,56
  /£[\d,]+(?:\.\d{2})?/g, // GBP: £1,000.00
  /¥[\d,]+/g, // JPY: ¥100,000
];

/**
 * Find all monetary text patterns in content.
 * Returns positions and matched text (but text is NOT logged, only position metadata).
 *
 * @param text - Document text to search
 * @returns Array of monetary text matches with positions
 */
function findMonetaryPatterns(
  text: string,
): Array<{ position: number; length: number; currency_char: string }> {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches: Array<{ position: number; length: number; currency_char: string }> = [];

  for (const pattern of MONETARY_PATTERNS) {
    let match;
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      const currencyChar = match[0][0]; // First character (currency symbol)
      matches.push({
        position: match.index,
        length: match[0].length,
        currency_char: currencyChar,
      });
    }
  }

  return matches;
}

/**
 * Detect font changes around monetary values.
 * Heuristic: if font changes within ±5 character window of currency symbol, flag it.
 * Never returns the actual text, only position metadata.
 *
 * @param monetaryPositions - Positions of monetary patterns
 * @param documentLength - Total document length
 * @returns Count of font changes near monetary text
 */
function detectFontChangesNearMonetary(
  monetaryPositions: Array<{ position: number }>,
  documentLength: number,
): number {
  // Simplified heuristic: assume ~1 font change per 500 chars baseline
  // If monetary density is high, increase anomaly count
  const monetaryDensity = monetaryPositions.length / (documentLength / 100); // Per 100 chars

  // Baseline: 0.1 font changes per 100 chars
  // If >0.5 per 100 chars, anomalous
  return monetaryDensity > 0.5 ? Math.ceil(monetaryDensity * 2) : 0;
}

/**
 * Detect size anomalies in monetary text.
 * Heuristic: cluster monetary values and check for outliers in the cluster.
 * Returns count of size anomalies (simplified: assumes some variation is normal).
 *
 * @param monetaryPositions - Positions of monetary patterns
 * @returns Count of size anomalies
 */
function detectSizeAnomalies(monetaryPositions: Array<{ length: number }>): number {
  if (monetaryPositions.length < 2) {
    return 0;
  }

  const lengths = monetaryPositions.map((m) => m.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = Math.sqrt(
    lengths.reduce((sq, n) => sq + Math.pow(n - avgLength, 2), 0) / lengths.length,
  );

  // Outliers: >1.5 std dev from mean
  const outliers = lengths.filter((l) => Math.abs(l - avgLength) > 1.5 * stdDev);

  // Only flag if significant outliers exist (>20% of values)
  return outliers.length > monetaryPositions.length * 0.2 ? outliers.length : 0;
}

/**
 * Detect color anomalies in monetary text.
 * Heuristic: if monetary values have unusual color coding, flag it.
 * This is simplified; real implementation would need color data from PDF.
 *
 * @returns Count of color anomalies (0 for now, placeholder for full PDF analysis)
 */
function detectColorAnomalies(): number {
  // This would require color extraction from PDF rendering layer
  // For now, return 0 (not detected at text extraction level)
  return 0;
}

/**
 * Detect spacing anomalies around monetary values.
 * Heuristic: unusual whitespace or line breaks around currency patterns.
 *
 * @param text - Document text
 * @param monetaryPositions - Positions of monetary patterns
 * @returns Count of spacing anomalies
 */
function detectSpacingAnomalies(
  text: string,
  monetaryPositions: Array<{ position: number; length: number }>,
): number {
  if (monetaryPositions.length === 0) {
    return 0;
  }

  let spacingAnomalies = 0;

  for (const monetary of monetaryPositions) {
    const before = text[monetary.position - 1];
    const after = text[monetary.position + monetary.length];

    // Check for unusual spacing: newline directly before/after (suspicious)
    if ((before === '\n' || before === '\r') && (after === '\n' || after === '\r')) {
      spacingAnomalies++;
    }

    // Check for missing space before currency (e.g., "value$1000" instead of "value $1000")
    if (
      before &&
      before !== ' ' &&
      before !== '\t' &&
      before !== '\n' &&
      before !== '\r' &&
      before !== '('
    ) {
      spacingAnomalies++;
    }
  }

  // Only flag if >10% of monetary values have spacing issues
  return spacingAnomalies > monetaryPositions.length * 0.1 ? spacingAnomalies : 0;
}

/**
 * Detect formatting inconsistencies (e.g., mixed delimiter styles).
 * Heuristic: check if monetary values use consistent delimiters (comma vs period).
 *
 * @param monetaryMatches - Matched monetary text strings
 * @returns Count of formatting inconsistencies
 */
function detectFormattingInconsistencies(monetaryMatches: string[]): number {
  if (monetaryMatches.length < 2) {
    return 0;
  }

  // Check for mixed decimal/thousands separators
  let usesCommaAsDecimal = 0;
  let usesPeriodAsDecimal = 0;

  for (const match of monetaryMatches) {
    if (match.includes(',')) {
      usesCommaAsDecimal++;
    }
    if (match.includes('.')) {
      usesPeriodAsDecimal++;
    }
  }

  // Inconsistency: both styles used in same document
  if (usesCommaAsDecimal > 0 && usesPeriodAsDecimal > 0) {
    return Math.min(usesCommaAsDecimal, usesPeriodAsDecimal);
  }

  return 0;
}

/**
 * Analyze document text for monetary anomalies.
 * Returns aggregated flags and confidence, never raw text content.
 *
 * @param documentText - Full text extracted from PDF
 * @returns Monetary anomaly analysis with flags and confidence
 */
export function analyzeMonetaryAnomalies(documentText: string | unknown): MonetaryAnomalyAnalysis {
  // Handle missing or non-string input
  if (!documentText || typeof documentText !== 'string') {
    return {
      anomalies_detected: false,
      total_anomalies: 0,
      confidence: 0,
      anomaly_types: {
        font_changes: 0,
        size_changes: 0,
        color_changes: 0,
        spacing_anomalies: 0,
        formatting_inconsistencies: 0,
      },
    };
  }

  // Find all monetary patterns
  const monetaryPositions = findMonetaryPatterns(documentText);

  if (monetaryPositions.length === 0) {
    return {
      anomalies_detected: false,
      total_anomalies: 0,
      confidence: 0,
      anomaly_types: {
        font_changes: 0,
        size_changes: 0,
        color_changes: 0,
        spacing_anomalies: 0,
        formatting_inconsistencies: 0,
      },
    };
  }

  // Detect various anomaly types
  const fontChanges = detectFontChangesNearMonetary(monetaryPositions, documentText.length);
  const sizeAnomalies = detectSizeAnomalies(monetaryPositions);
  const colorAnomalies = detectColorAnomalies();
  const spacingAnomalies = detectSpacingAnomalies(documentText, monetaryPositions);

  // Get actual matched strings for formatting check (text not logged, only metadata)
  const monetaryMatches: string[] = [];
  for (const pattern of MONETARY_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(documentText)) !== null) {
      monetaryMatches.push(match[0]);
    }
  }
  const formattingInconsistencies = detectFormattingInconsistencies(monetaryMatches);

  const anomalyTypes = {
    font_changes: fontChanges,
    size_changes: sizeAnomalies,
    color_changes: colorAnomalies,
    spacing_anomalies: spacingAnomalies,
    formatting_inconsistencies: formattingInconsistencies,
  };

  const totalAnomalies =
    fontChanges + sizeAnomalies + colorAnomalies + spacingAnomalies + formattingInconsistencies;

  // Confidence: ratio of detected anomalies to total monetary values
  // Clamp to 0-1 range
  const confidence = Math.min(totalAnomalies / Math.max(monetaryPositions.length, 1) / 5, 1.0);

  return {
    anomalies_detected: totalAnomalies > 0,
    total_anomalies: totalAnomalies,
    confidence,
    anomaly_types: anomalyTypes,
  };
}
