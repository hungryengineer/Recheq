# Recheq.bvg Project Constitution

Welcome to the Recheq codebase. This document is the ultimate source of truth for our engineering philosophy, standards, and architecture. If there is ambiguity in PR reviews, or if questions arise regarding tech stack, rules, or boundaries, refer to this constitution. **The written spec—not chat history—is the source of truth.**

---

## 1. Core Engineering Philosophy

- **Zero-Trust Architecture**: Validate everything at the boundary. We use **Zod** for all domain types and external payload validation. Never use TypeScript `any` or blind type assertions (`as Type`).
- **Atomic & Deterministic Integrity**:
  - Always prefer SQL atomic operations (e.g., `sql\`count + 1\``) over read-modify-write loops.
  - Anticipate race conditions and utilize proper locking (`pg_advisory_xact_lock` or handle constraint violations).
- **Audit-ability**: All critical record updates must preserve cryptographic hash chains using the `AuditService`. Never spoof a hash.
- **Specification-Driven Development (SDD)**: All feature development follows a strict loop: `Specify -> Plan -> Tasks -> Implement`.

---

## 2. Monorepo Boundaries & Structure

We employ a strict boundaries-driven architecture using Turborepo/pnpm workspaces. Avoid cyclic dependencies and adhere to this structure:

- **`@recheq/schema`** (in `packages/schema`): The single source of truth for Zod domain types and enums. Contains no business logic.
- **`@recheq/rules`** (in `packages/rules`): Pure, deterministic business logic. Zero side effects. No DB, network, or clock access allowed here.
- **`@recheq/api`** (in `services/api`): Backend execution layer containing routing, Drizzle ORM queries, token systems, and storage integration.
- **`apps/web`** (in `apps/web`): The frontend Next.js application.

_All workspace packages must use ES Modules (`"type": "module"`) and imports must explicitly include the `.js` extension._

---

## 3. Security & Validation Mandates

CodeRabbit and peer reviews will strictly enforce the following rules:

1. **Mandatory Zod usage**: Always enforce runtime validation using utilities like `validateBody`.
2. **Prevent Mass Assignment**: Explicitly map updated fields for Database writes. Strip unexpected keys from API payloads.
3. **No `any` Types**: `unknown` with type guards is acceptable if necessary, but explicit types are always preferred.
4. **SQL Injection & XSS Immunity**: Always use Drizzle ORM's prepared statements/parameters for database queries. Never interpolate untrusted strings into raw SQL.
5. **Transactional Outbox Pattern**: External events/jobs (like PgBoss) must never be published halfway through a database transaction. Accumulate and publish them **only after** the transaction successfully commits.

---

## 4. Testing & Verification

We do not merge broken builds, nor do we bypass tests to achieve a "green" build.

1. **Test Integrity**: Never skip or comment out failing tests. Fix the underlying logic or correct the test mock.
2. **Specific Assertions**: Tests must assert specific and meaningful outcomes (e.g., exact `statusCode`, error `code`, or explicit messages), never generic errors.
3. **Mandatory Pre-Push Checks**:
   Before pushing, developers must verify:
   - `pnpm run typecheck`
   - `pnpm format:check` (or `pnpm lint`)
   - `pnpm test`
     All type and closure narrowing issues must be resolved locally.

---

## 5. Clean Code & Formatting

- **Imports**: Group imports at the top of the file. Avoid mid-file dynamic imports unless essential for lazy loading.
- **No Dead Code**: Ensure unused variables, unused database pool initializations, and non-observability console logs are cleaned up before merging.
- **Formatting**: The project uses Prettier. Developers must run `pnpm exec prettier --write .` to ensure formatting adheres to CI standards.

---

> **Note to AI Agents and Developers**: If requested to fix issues on another branch, treat the codebase with these exact strict architectural rules. Provide clean, self-contained fixes.

_End of Constitution._
