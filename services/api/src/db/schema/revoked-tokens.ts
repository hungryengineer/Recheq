import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';

// ─── Revoked Sessions / JWT Denylist ────────────────────────────
// Records a JWT's jti once it has been revoked (e.g. logout, password change).
// Entries are kept until the JWT's natural expiry then pruned, so the table
// stays bounded. Storage is deliberately denormalized (no FK) so revocation
// continues to work even for sessions owned by users/orgs later deleted.
export const revoked_tokens = pgTable(
  'revoked_tokens',
  {
    jti: varchar('jti', { length: 64 }).primaryKey(),
    exp: timestamp('exp', { withTimezone: true }).notNull(),
    reason: varchar('reason', { length: 50 }).notNull().default('logout'),
    revoked_at: timestamp('revoked_at', { withTimezone: true }).notNull().defaultNow(),
    revoked_by: varchar('revoked_by', { length: 200 }),
  },
  (table) => [index('idx_revoked_tokens_exp').on(table.exp)],
);

export const revoked_tokens_ttl_seconds = 60 * 60 * 24 * 8; // 7d JWT + 1d grace
