import stringify from 'fast-json-stable-stringify';

/**
 * Serializes a JSON object into a deterministic, canonical string.
 * This guarantees that { "a": 1, "b": 2 } and { "b": 2, "a": 1 }
 * produce the exact same string, which is critical for consistent hashing.
 */
export function toCanonicalJson(payload: unknown): string {
  if (payload === undefined) {
    return '';
  }
  return stringify(payload);
}
