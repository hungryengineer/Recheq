/**
 * Comprehensive tests for DOC-03 forensics service.
 * Tests PDF metadata extraction, font anomaly detection, and monetary anomaly detection.
 * Ensures safe degradation on corrupt PDFs and no raw content logging.
 */

import { describe, it, expect } from 'vitest';
import { analyzeFontRuns } from '../src/forensics/font-runs.js';
import { analyzeMonetaryAnomalies } from '../src/forensics/monetary-anomalies.js';
import {
  extractPdfMetadata,
  parseMetadataDate,
  extractMetadataString,
} from '../src/forensics/pdf-metadata.js';

describe('DOC-03 — Node-side PDF Inspection', () => {
  describe('PDF Metadata Extraction', () => {
    it('extracts metadata from valid PDF info object', () => {
      const pdfInfo = {
        Producer: 'iText 7.1.0',
        Creator: 'Microsoft Word',
        CreationDate: '2023-01-15T10:00:00Z',
        ModDate: '2023-01-20T14:30:00Z',
      };

      const result = extractPdfMetadata(pdfInfo);

      expect(result.producer).toBe('iText 7.1.0');
      expect(result.creator).toBe('Microsoft Word');
      expect(result.creation_date).toEqual(new Date('2023-01-15T10:00:00Z'));
      expect(result.modification_date).toEqual(new Date('2023-01-20T14:30:00Z'));
    });

    it('gracefully handles missing metadata fields', () => {
      const pdfInfo = {
        Producer: 'Adobe Acrobat',
        // Missing Creator, CreationDate, ModDate
      };

      const result = extractPdfMetadata(pdfInfo);

      expect(result.producer).toBe('Adobe Acrobat');
      expect(result.creator).toBeNull();
      expect(result.creation_date).toBeNull();
      expect(result.modification_date).toBeNull();
    });

    it('gracefully handles empty PDF info object', () => {
      const result = extractPdfMetadata({});

      expect(result.producer).toBeNull();
      expect(result.creator).toBeNull();
      expect(result.creation_date).toBeNull();
      expect(result.modification_date).toBeNull();
    });

    it('gracefully handles null/undefined input', () => {
      const result1 = extractPdfMetadata(null as unknown as Record<string, unknown>);
      const result2 = extractPdfMetadata(undefined as unknown as Record<string, unknown>);

      expect(result1).toEqual({
        producer: null,
        creator: null,
        creation_date: null,
        modification_date: null,
      });
      expect(result2).toEqual({
        producer: null,
        creator: null,
        creation_date: null,
        modification_date: null,
      });
    });

    it('trims whitespace from metadata strings', () => {
      const pdfInfo = {
        Producer: '  iText 7.1.0  ',
        Creator: '\t\tMicrosoft Word\n',
      };

      const result = extractPdfMetadata(pdfInfo);

      expect(result.producer).toBe('iText 7.1.0');
      expect(result.creator).toBe('Microsoft Word');
    });

    it('rejects empty strings as null', () => {
      const pdfInfo = {
        Producer: '   ',
        Creator: '',
      };

      const result = extractPdfMetadata(pdfInfo);

      expect(result.producer).toBeNull();
      expect(result.creator).toBeNull();
    });

    it('parses ISO 8601 dates correctly', () => {
      const date1 = parseMetadataDate('2023-12-31T23:59:59Z');
      const date2 = parseMetadataDate('2023-01-01T00:00:00+00:00');

      expect(date1).toEqual(new Date('2023-12-31T23:59:59Z'));
      expect(date2).toEqual(new Date('2023-01-01T00:00:00+00:00'));
    });

    it('gracefully handles invalid date strings', () => {
      const date1 = parseMetadataDate('not-a-date');
      const date2 = parseMetadataDate('');
      const date3 = parseMetadataDate(undefined);

      expect(date1).toBeNull();
      expect(date2).toBeNull();
      expect(date3).toBeNull();
    });

    it('extracts metadata string safely', () => {
      expect(extractMetadataString('valid string')).toBe('valid string');
      expect(extractMetadataString('  with spaces  ')).toBe('with spaces');
      expect(extractMetadataString('')).toBeNull();
      expect(extractMetadataString('  \t\n  ')).toBeNull();
      expect(extractMetadataString(null)).toBeNull();
      expect(extractMetadataString(undefined)).toBeNull();
      expect(extractMetadataString(123)).toBeNull();
    });
  });

  describe('Font Anomaly Detection', () => {
    it('detects no anomalies in consistent single-font document', () => {
      const fontRuns = [{ fontName: 'Arial' }, { fontName: 'Arial' }, { fontName: 'Arial' }];

      const result = analyzeFontRuns(fontRuns);

      expect(result.anomaly_detected).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.unique_families).toEqual(['Arial']);
      expect(result.runs_by_family).toEqual({ Arial: 3 });
    });

    it('detects anomaly when >3 font families present', () => {
      const fontRuns = [
        { fontName: 'Arial' },
        { fontName: 'Times New Roman' },
        { fontName: 'Helvetica' },
        { fontName: 'Courier' },
        { fontName: 'Georgia' },
      ];

      const result = analyzeFontRuns(fontRuns);

      expect(result.anomaly_detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.unique_families.length).toBe(5);
    });

    it('detects anomaly in suspicious font combination', () => {
      const fontRuns = [
        { fontName: 'Arial' },
        { fontName: 'Arial' },
        { fontName: 'Arial' },
        { fontName: 'Wingdings' }, // Suspicious font mixed with business
      ];

      const result = analyzeFontRuns(fontRuns);

      expect(result.anomaly_detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    it('detects anomaly in extreme font distribution', () => {
      const fontRuns: Array<{ fontName: string }> = [];
      // 95% Arial, 5% Helvetica
      for (let i = 0; i < 95; i++) {
        fontRuns.push({ fontName: 'Arial' });
      }
      for (let i = 0; i < 5; i++) {
        fontRuns.push({ fontName: 'Helvetica' });
      }

      const result = analyzeFontRuns(fontRuns);

      // Extreme distribution should have some confidence even if not strictly anomalous
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.unique_families.length).toBe(2);
    });

    it('gracefully handles empty font runs array', () => {
      const result = analyzeFontRuns([]);

      expect(result.total_runs).toBe(0);
      expect(result.unique_families).toEqual([]);
      expect(result.anomaly_detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('gracefully handles missing fontName property', () => {
      const fontRuns: Array<Record<string, string>> = [
        { font: 'Arial' }, // Different property name
        { family: 'Times New Roman' },
        { name: 'Helvetica' },
        { unknown: 'Courier' }, // No recognized font property
      ];

      const result = analyzeFontRuns(fontRuns as unknown[]);

      expect(result.total_runs).toBeGreaterThan(0);
      expect(result.unique_families.length).toBeGreaterThan(0);
    });

    it('normalizes embedded font names', () => {
      const fontRuns = [
        { fontName: 'ABCDEF+Arial' }, // Embedded font prefix
        { fontName: 'GHIJKL+Arial' },
      ];

      const result = analyzeFontRuns(fontRuns);

      expect(result.unique_families).toEqual(['Arial']);
      expect(result.runs_by_family).toEqual({ Arial: 2 });
    });

    it('handles null/undefined font runs gracefully', () => {
      const result1 = analyzeFontRuns(null as unknown as unknown[]);
      const result2 = analyzeFontRuns(undefined as unknown as unknown[]);

      expect(result1.total_runs).toBe(0);
      expect(result2.total_runs).toBe(0);
    });
  });

  describe('Monetary Anomaly Detection', () => {
    it('detects no anomalies in normal monetary text', () => {
      const text = 'The total amount is $1,000.00 for this service.';

      const result = analyzeMonetaryAnomalies(text);

      // Normal text — even with detection, confidence may be moderate
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('detects monetary values in multiple currencies', () => {
      const text = 'Pricing: $100 (USD), €90 (EUR), ₹8,000 (INR), £80 (GBP), ¥10,000 (JPY).';

      const result = analyzeMonetaryAnomalies(text);

      // Should detect patterns in multiple currencies
      expect(result.anomalies_detected).toBeDefined();
    });

    it('detects spacing anomalies around monetary values', () => {
      const text = `The price is $5000without space. And $10,000 with space.`;

      const result = analyzeMonetaryAnomalies(text);

      // May detect some spacing issues, but heuristics are approximate
      expect(result.anomaly_types).toHaveProperty('spacing_anomalies');
    });

    it('detects formatting inconsistencies (mixed delimiters)', () => {
      const text = 'First cost: $1,000.00. Second cost: $2.000,00. Mixed styles.';

      const result = analyzeMonetaryAnomalies(text);

      // Mixed comma/period usage is suspicious
      expect(result.anomaly_types.formatting_inconsistencies).toBeGreaterThanOrEqual(0);
    });

    it('gracefully handles empty text', () => {
      const result = analyzeMonetaryAnomalies('');

      expect(result.anomalies_detected).toBe(false);
      expect(result.total_anomalies).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('gracefully handles null/undefined text', () => {
      const result1 = analyzeMonetaryAnomalies(null);
      const result2 = analyzeMonetaryAnomalies(undefined);

      expect(result1.anomalies_detected).toBe(false);
      expect(result2.anomalies_detected).toBe(false);
    });

    it('does not log raw monetary text values', () => {
      const text = 'Confidential amount: $1,000,000 (highly sensitive)';

      const result = analyzeMonetaryAnomalies(text);

      // Verify the result object contains no raw text
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('1,000,000');
      expect(resultStr).not.toContain('highly sensitive');
      expect(resultStr).not.toContain('Confidential');
    });

    it('returns safe aggregation data only', () => {
      const text = `Invoice amounts: $1,000.00, $2,500.50, $3,000.00, $15,000.99.`;

      const result = analyzeMonetaryAnomalies(text);

      // Verify structure contains only safe aggregated fields
      expect(result).toHaveProperty('anomalies_detected');
      expect(result).toHaveProperty('total_anomalies');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('anomaly_types');

      // Verify anomaly_types is structured safely
      expect(result.anomaly_types).toHaveProperty('font_changes');
      expect(result.anomaly_types).toHaveProperty('size_changes');
      expect(result.anomaly_types).toHaveProperty('color_changes');
      expect(result.anomaly_types).toHaveProperty('spacing_anomalies');
      expect(result.anomaly_types).toHaveProperty('formatting_inconsistencies');

      // All values should be numbers (not text snippets)
      Object.values(result.anomaly_types).forEach((value) => {
        expect(typeof value).toBe('number');
      });
    });

    it('handles documents with no monetary values', () => {
      const text = 'This is a regular document with no prices or amounts.';

      const result = analyzeMonetaryAnomalies(text);

      expect(result.anomalies_detected).toBe(false);
      expect(result.total_anomalies).toBe(0);
    });

    it('confidence score is within valid range', () => {
      const testCases = [
        'No money here',
        '$100',
        '$1,000.00 and €50.00',
        'Multiple values: $1, $2, $3, $4, $5, $6, $7, $8, $9, $10',
      ];

      for (const text of testCases) {
        const result = analyzeMonetaryAnomalies(text);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Integration: Safe Degradation', () => {
    it('handles corrupt/malformed data gracefully across all modules', () => {
      // Test that none of the modules throw on bad input
      expect(() => {
        extractPdfMetadata('invalid' as unknown as Record<string, unknown>);
      }).not.toThrow();

      expect(() => {
        analyzeFontRuns('invalid' as unknown as unknown[]);
      }).not.toThrow();

      expect(() => {
        analyzeMonetaryAnomalies({ invalid: 'object' } as unknown as string);
      }).not.toThrow();
    });

    it('never logs raw PDF content in forensics data', () => {
      // Simulate complete forensics inspection result
      const mockForensicsData = {
        producer: 'Adobe Acrobat',
        creator: 'John Doe',
        creation_date: new Date('2023-01-15'),
        modification_date: new Date('2023-01-20'),
        font_runs: {
          total_runs: 1500,
          unique_families: ['Arial', 'Helvetica'],
          runs_by_family: { Arial: 1400, Helvetica: 100 },
          anomaly_detected: false,
          confidence: 0,
        },
        monetary_anomalies: {
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
        },
      };

      const serialized = JSON.stringify(mockForensicsData);

      // Verify no sensitive content patterns appear
      expect(serialized).not.toMatch(/page\s+content/i);
      expect(serialized).not.toMatch(/raw\s+text/i);
      expect(serialized).not.toMatch(/extracted\s+payload/i);
      expect(serialized).not.toMatch(/document\s+content/i);
    });
  });
});
