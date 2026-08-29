export function sanitizeExtractedData<T>(data: T): T {
  return sanitizeValue(data) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.includes('\u0000') ? value.replaceAll('\u0000', '') : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

export function sanitizeErrorMessage(message: string): string {
  let out = '';
  for (const ch of message) {
    const code = ch.charCodeAt(0);
    const isControl = code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code < 32);
    out += isControl ? ' ' : ch;
    if (out.length >= 1024) break;
  }
  return out.trim();
}
