import { describe, it, expect } from 'vitest';
import { evaluateExtraction, flattenObject, FailureMode } from '../src/extraction/evaluator.js';

describe('Evaluator', () => {
  describe('flattenObject', () => {
    it('flattens nested objects', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: { e: 3 },
        },
        _ignore: 4,
      };

      const flat = flattenObject(obj);
      expect(flat).toEqual({
        a: 1,
        'b.c': 2,
        'b.d.e': 3,
      });
    });

    it('flattens arrays', () => {
      const obj = {
        items: [
          { name: 'apple', amount: 1 },
          { name: 'banana', amount: 2 },
        ],
      };

      const flat = flattenObject(obj);
      expect(flat).toEqual({
        'items[0].name': 'apple',
        'items[0].amount': 1,
        'items[1].name': 'banana',
        'items[1].amount': 2,
      });
    });
  });

  describe('evaluateExtraction', () => {
    it('calculates perfect precision and recall', () => {
      const expected = {
        name: 'Priya',
        basic: { amount: 50000, raw_label: 'Basic' },
        other: null,
      };
      const actual = {
        name: 'Priya',
        basic: { amount: 50000, raw_label: 'Basic' },
        other: null,
      };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(3); // name, basic.amount, basic.raw_label
      expect(result.falsePositives).toBe(0);
      expect(result.falseNegatives).toBe(0);
      expect(result.precision).toBe(1);
      expect(result.recall).toBe(1);
      expect(result.failures).toHaveLength(0);
    });

    it('identifies missing fields (False Negatives)', () => {
      const expected = { a: 1, b: 2 };
      const actual = { a: 1 };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(1);
      expect(result.falsePositives).toBe(0);
      expect(result.falseNegatives).toBe(1);
      expect(result.recall).toBe(0.5);
      expect(result.precision).toBe(1);
      expect(result.failures[0].mode).toBe(FailureMode.MISSING_FIELD);
      expect(result.failures[0].path).toBe('b');
    });

    it('identifies hallucinated fields (False Positives)', () => {
      const expected = { a: 1 };
      const actual = { a: 1, b: 2 };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(1);
      expect(result.falsePositives).toBe(1);
      expect(result.falseNegatives).toBe(0);
      expect(result.recall).toBe(1);
      expect(result.precision).toBe(0.5);
      expect(result.failures[0].mode).toBe(FailureMode.HALLUCINATED_FIELD);
      expect(result.failures[0].path).toBe('b');
    });

    it('identifies value mismatches', () => {
      const expected = { a: 1 };
      const actual = { a: 2 };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(0);
      expect(result.falsePositives).toBe(1);
      expect(result.falseNegatives).toBe(1);
      expect(result.precision).toBe(0);
      expect(result.recall).toBe(0);
      expect(result.failures[0].mode).toBe(FailureMode.VALUE_MISMATCH);
    });

    it('identifies type mismatches', () => {
      const expected = { a: 1 };
      const actual = { a: '1' };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(0);
      expect(result.falsePositives).toBe(1);
      expect(result.falseNegatives).toBe(1);
      expect(result.failures[0].mode).toBe(FailureMode.TYPE_MISMATCH);
    });

    it('identifies explicit null in actual as missing field', () => {
      const expected = { a: 1 };
      const actual = { a: null };

      const result = evaluateExtraction(expected, actual);
      expect(result.truePositives).toBe(0);
      expect(result.falsePositives).toBe(0);
      expect(result.falseNegatives).toBe(1);
      expect(result.failures[0].mode).toBe(FailureMode.MISSING_FIELD);
    });

    it('ignores schema metadata fields', () => {
      const expected = { a: 1, schema_version: 'v1' };
      const actual = { a: 1, schema_version: 'v2' };

      const result = evaluateExtraction(expected, actual);
      expect(result.falseNegatives).toBe(0);
      expect(result.falsePositives).toBe(0);
    });
  });
});
