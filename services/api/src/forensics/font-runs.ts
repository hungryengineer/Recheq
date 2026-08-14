/**
 * Font anomaly detection module.
 * Analyzes font usage patterns in PDFs to detect suspicious formatting changes.
 * Returns aggregated data (families and percentages), never raw character analysis.
 */

/**
 * Represents aggregated font run analysis.
 * Safe to log: only families, counts, and percentages (no character-level details).
 */
export interface FontRunAnalysis {
  total_runs: number;
  unique_families: string[];
  runs_by_family: Record<string, number>;
  anomaly_detected: boolean;
  confidence: number;
}

/**
 * Default font families that are typical in business documents.
 * Used to identify suspicious font combinations.
 */
const COMMON_BUSINESS_FONTS = new Set([
  'Arial',
  'Times New Roman',
  'Helvetica',
  'Courier',
  'Georgia',
  'Calibri',
  'Verdana',
  'Tahoma',
]);

/**
 * Font families often used in document forgery (decorative, script, unusual).
 * Detection of these mixed with business fonts is suspicious.
 */
const SUSPICIOUS_FONT_PATTERNS = new Set([
  'Script',
  'Cursive',
  'Symbol',
  'Wingdings',
  'Webdings',
  'ZapfDingbats',
]);

/**
 * Check if font combination is suspicious.
 * Anomalies include:
 * - More than 3 distinct font families
 * - Mix of business + suspicious fonts
 * - Extreme font run distribution (e.g., 95% one font, 5% another)
 */
function isSuspiciousFontCombination(
  families: string[],
  runsByFamily: Record<string, number>,
  totalRuns: number,
): boolean {
  // More than 3 distinct fonts is suspicious
  if (families.length > 3) {
    return true;
  }

  // Check for mix of business + suspicious fonts
  const hasBusinessFont = families.some((f) => COMMON_BUSINESS_FONTS.has(f));
  const hasSuspiciousFont = families.some((f) =>
    Array.from(SUSPICIOUS_FONT_PATTERNS).some((pattern) => f.includes(pattern)),
  );

  if (hasBusinessFont && hasSuspiciousFont) {
    return true;
  }

  // Check for extreme distribution: minor font used for <5% of runs
  if (families.length > 1) {
    const percentages = families.map((f) => runsByFamily[f] / totalRuns);
    const hasExtremeMinority = percentages.some((p) => p > 0 && p < 0.05);
    if (hasExtremeMinority) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate anomaly confidence based on heuristics.
 * Returns 0.0 (no anomaly) to 1.0 (definite anomaly).
 */
function calculateAnomalyConfidence(
  families: string[],
  runsByFamily: Record<string, number>,
  totalRuns: number,
): number {
  let confidence = 0;

  // +0.3 for each extra font beyond 2
  if (families.length > 2) {
    confidence += Math.min(0.3 * (families.length - 2), 0.4);
  }

  // +0.2 if mix of business + suspicious
  const hasBusinessFont = families.some((f) => COMMON_BUSINESS_FONTS.has(f));
  const hasSuspiciousFont = families.some((f) =>
    Array.from(SUSPICIOUS_FONT_PATTERNS).some((pattern) => f.includes(pattern)),
  );
  if (hasBusinessFont && hasSuspiciousFont) {
    confidence += 0.2;
  }

  // +0.15 if extreme distribution detected
  if (families.length > 1) {
    const percentages = families.map((f) => runsByFamily[f] / totalRuns);
    const minPercentage = Math.min(...percentages.filter((p) => p > 0));
    if (minPercentage > 0 && minPercentage < 0.05) {
      confidence += 0.15;
    }
  }

  return Math.min(confidence, 1.0);
}

/**
 * Analyze font runs from a parsed PDF.
 * Expects fontRuns to be an array of objects with font family info.
 * Gracefully handles missing or malformed font data.
 *
 * @param fontRuns - Array of font run objects (typically from pdf-parse or similar)
 * @returns Aggregated font analysis with anomaly detection
 */
export function analyzeFontRuns(fontRuns: unknown[]): FontRunAnalysis {
  // Handle missing or non-array input
  if (!Array.isArray(fontRuns) || fontRuns.length === 0) {
    return {
      total_runs: 0,
      unique_families: [],
      runs_by_family: {},
      anomaly_detected: false,
      confidence: 0,
    };
  }

  // Aggregate font families
  const runsByFamily: Record<string, number> = {};
  let totalRuns = 0;

  for (const run of fontRuns) {
    if (!run || typeof run !== 'object') {
      continue;
    }

    // Try to extract font family from the run object
    let fontFamily: string | null = null;

    // Common property names for font family in PDF libraries
    if ('fontName' in run && typeof run.fontName === 'string') {
      fontFamily = run.fontName;
    } else if ('font' in run && typeof run.font === 'string') {
      fontFamily = run.font;
    } else if ('family' in run && typeof run.family === 'string') {
      fontFamily = run.family;
    } else if ('name' in run && typeof run.name === 'string') {
      fontFamily = run.name;
    }

    if (fontFamily && fontFamily.trim().length > 0) {
      fontFamily = fontFamily.trim();
      // Normalize font name (remove common prefixes like "ABCDEF+")
      fontFamily = fontFamily.replace(/^[A-Z0-9]+\+/, '');

      runsByFamily[fontFamily] = (runsByFamily[fontFamily] || 0) + 1;
      totalRuns++;
    }
  }

  // If no fonts extracted, return empty analysis
  if (totalRuns === 0) {
    return {
      total_runs: 0,
      unique_families: [],
      runs_by_family: {},
      anomaly_detected: false,
      confidence: 0,
    };
  }

  const uniqueFamilies = Object.keys(runsByFamily);
  const anomaly_detected = isSuspiciousFontCombination(uniqueFamilies, runsByFamily, totalRuns);
  const confidence = calculateAnomalyConfidence(uniqueFamilies, runsByFamily, totalRuns);

  return {
    total_runs: totalRuns,
    unique_families: uniqueFamilies,
    runs_by_family: runsByFamily,
    anomaly_detected,
    confidence,
  };
}
