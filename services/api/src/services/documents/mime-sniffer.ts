// ─── Content-Based MIME Detection ───────────────────────────────
// Determines MIME type from file content (magic bytes), not from
// the file extension. This prevents spoofed extensions from bypassing
// type restrictions.

export interface MimeResult {
  mimeType: string;
  extension: string;
}

// ─── Magic Byte Signatures ──────────────────────────────────────

const SIGNATURES: Array<{ bytes: number[]; offset: number; mimeType: string; extension: string }> = [
  // PDF: %PDF (0x25 0x50 0x44 0x46)
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf', extension: 'pdf' },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    mimeType: 'image/png',
    extension: 'png',
  },
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mimeType: 'image/jpeg', extension: 'jpg' },
];

// ─── Allowed MIME Types ─────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

/**
 * Sniffs the MIME type from file content by checking magic bytes.
 * Returns null if the content does not match any known signature.
 */
export function sniffMimeType(content: Buffer): MimeResult | null {
  if (content.length === 0) {
    return null;
  }

  for (const sig of SIGNATURES) {
    if (content.length < sig.offset + sig.bytes.length) {
      continue;
    }

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (content[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return { mimeType: sig.mimeType, extension: sig.extension };
    }
  }

  return null;
}

/**
 * Checks whether a MIME type is allowed for document upload.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}
