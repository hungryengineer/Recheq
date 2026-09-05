import net from 'node:net';

// ─── Webhook destination guard ──────────────────────────────────
// Webhook URLs are attacker-influenceable (the org admin sets them), so the
// delivery path must never POST to SSRF targets: loopback, private, link-local,
// or documentation/reserved address space. Both the create route and the
// delivery worker enforce this so a URL persisted before validation is still
// rejected at send time.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  // The guards above ensure a 4-part all-numeric address; non-null assertions
  // satisfy noUncheckedIndexedAccess on the tuple destructure.
  const a = parts[0]!;
  const b = parts[1]!;
  const c = parts[2]!;
  if (a === 0) return true; // 0.0.0.0/8 current network
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a === 198 && b === 51) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::' || lower === '::1') return true; // unspecified + loopback
  if (
    lower.startsWith('fe80') ||
    lower.startsWith('fe90') ||
    lower.startsWith('fea0') ||
    lower.startsWith('feb0')
  )
    return true; // fe80::/10 link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique-local
  if (
    lower.startsWith('fec0') ||
    lower.startsWith('fed0') ||
    lower.startsWith('fee0') ||
    lower.startsWith('fef0')
  )
    return true; // fec0::/10 site-local
  if (lower.startsWith('ff')) return true; // multicast
  if (lower.startsWith('2001:db8')) return true; // documentation range
  const v4Tail = lower.split(':').pop() ?? '';
  if (v4Tail.includes('.')) return isPrivateIPv4(v4Tail); // IPv4-mapped/translated
  return false;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.example',
  '.invalid',
  '.test',
];

export function isSafeWebhookUrl(urlLike: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlLike);
  } catch {
    return false;
  }

  // HTTPS only: the signature covering the body is meaningless in transit on
  // plaintext HTTP, and mixed content would leak the shared secret.
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (!parsed.hostname) return false;

  const host = parsed.hostname.toLowerCase();
  const ipType = net.isIP(host);

  if (ipType === 4) return !isPrivateIPv4(host);
  if (ipType === 6) return !isPrivateIPv6(host);

  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  return true;
}

export function assertSafeWebhookUrl(urlLike: string): void {
  if (!isSafeWebhookUrl(urlLike)) {
    throw new Error('Webhook destinations must use HTTPS and a public (non-private/loopback) host');
  }
}
