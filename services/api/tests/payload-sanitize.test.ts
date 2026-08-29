import { describe, it, expect } from 'vitest';
import { sanitizeExtractedData, sanitizeErrorMessage } from '../src/extraction/payload-sanitize.js';

describe('sanitizeExtractedData', () => {
  it('strips NUL bytes from nested string leaves', () => {
    const dirty = {
      employer_name: 'Acme\u0000Pvt Ltd',
      pan: 'ABCPS1234F',
      nested: { name: 'ok', note: 'a\u0000b\u0000c' },
      list: ['x\u0000y', 'z'],
    };
    const clean = sanitizeExtractedData(dirty);
    expect(clean).toEqual({
      employer_name: 'AcmePvt Ltd',
      pan: 'ABCPS1234F',
      nested: { name: 'ok', note: 'abc' },
      list: ['xy', 'z'],
    });
  });

  it('leaves clean data untouched', () => {
    const clean = { employer_name: 'Acme', pay: 1000, details: { active: true } };
    expect(sanitizeExtractedData(clean)).toEqual(clean);
  });

  it('handles nulls, numbers and booleans', () => {
    expect(sanitizeExtractedData({ a: null, b: 1, c: false })).toEqual({ a: null, b: 1, c: false });
  });

  it('can be persisted as JSON', () => {
    const dirty = { name: 'abc\u0000def' };
    const json = JSON.stringify(sanitizeExtractedData(dirty));
    expect(json.includes('\u0000')).toBe(false);
  });
});

describe('sanitizeErrorMessage', () => {
  it('strips control characters and truncates long errors', () => {
    const msg = 'Failed query: update ... ' + '\u0000\u0001\u0002'.repeat(10) + ' x';
    const out = sanitizeErrorMessage(msg);
    expect(out.includes('\u0000')).toBe(false);
    expect(out.length).toBeLessThanOrEqual(1024);
  });

  it('trims whitespace', () => {
    expect(sanitizeErrorMessage('  hello  ')).toBe('hello');
  });
});
