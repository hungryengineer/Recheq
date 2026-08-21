/**
 * True only for same-origin relative paths (RCQ-20110 open-redirect guard).
 *
 * Blocks absolute URLs ('https://evil.com'), protocol-relative references
 * ('//evil.com'), and the backslash bypasses ('/\evil.com', '\evil.com')
 * which URL parsers normalize into cross-host authority separators.
 *
 * Also rejects raw ASCII tab, LF and CR: `new URL()` strips control
 * characters before parsing, so '/\n/evil.example' silently resolves to
 * https://evil.example/.
 *
 * Kept dependency-free so both server middleware (proxy.ts) and client
 * components (login page) can share one implementation.
 */
export function isSafeRelativePath(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !/[\t\n\r]/.test(path)
  );
}
