# Tieout Hackathon — Three-Member Implementation Backlog

> **Note**: For the definitive engineering standards, codebase architecture, and team workflows, please refer to the [Project Constitution](docs/CONSTITUTION.md).

This document converts `TIEOUT_HACKATHON_BUILD_SPEC.md` into implementation stories. Each member can give their assigned workstream and one story at a time to Cursor/Codex.

The goal is not to build three isolated applications. The goal is to deliver one demonstrable vertical slice at every milestone:

```text
case creation → consent → upload → extraction → evidence → rules → verdict → ledger → dispute
```

## Team ownership

| Member                       | Primary workstream                                         | Owns                                           | Does not own                                       |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Member 1 — Backend Developer | Domain, database, API, rules, workflows                    | Business correctness and persistent state      | UI styling, deployment infrastructure              |
| Member 2 — Product Developer | Web product, extraction, PDF inspection                    | User journeys and document perception          | Verdict semantics, infrastructure                  |
| Member 3 — AIOps/DevOps      | Platform, CI/CD, security, observability, demo reliability | Running, protecting, and validating the system | Business-rule decisions, primary UI implementation |

## Frozen contracts everyone must preserve

These are shared constraints from the build specification:

- The LLM extracts printed facts; deterministic TypeScript rules calculate findings, score, and verdict.
- Allowed verdicts are `verified`, `verified_with_notes`, `needs_review`, and `insufficient_evidence`. There is no `rejected` verdict.
- Missing inputs produce `not_assessed`, not a finding.
- Preserve the extraction schemas, check IDs, API paths, error envelope, and status values.
- Use PostgreSQL as the only durable datastore. Use `pg-boss` only if background jobs are needed.
- Do not add Redis, Kafka, Kubernetes, RAG, agents, a vector database, or extra microservices.
- Do not log document contents, extracted personal data, access tokens, signed URLs, or secrets.
- Public candidate/employer pages must never expose risk score, verifier findings, or unrelated candidate data.
- Consent, the 10-fixture suite, forged-payslip flow, deterministic rules, audit chain, and token security are mandatory.

## How to use this backlog with Cursor/Codex

Each member should:

1. Start with the shared scaffold stories in Milestone 0.
2. Work only on stories assigned to their member unless the team agrees on a contract change.
3. Give Cursor/Codex one story at a time, not the entire backlog.
4. Ask it to inspect existing files before creating new ones.
5. Require tests in the same story as implementation.
6. Run the story's acceptance commands before marking it complete.
7. Commit by story ID, for example `feat(BE-04): implement deterministic score calculation`.

Recommended prompt prefix:

```text
You are implementing Tieout from TEAM_IMPLEMENTATION_BACKLOG.md and
TIEOUT_HACKATHON_BUILD_SPEC.md.

Implement only the story below. Inspect the repository before editing files.
Preserve existing contracts. Do not invent missing business rules.
Keep business logic deterministic and testable. Add tests with the change.
Report files changed, commands run, and any blocker.
```

---

# Milestone 0 — Contract freeze and repository scaffold

**Target:** Hours 0–2

**Exit condition:** all three members can install dependencies, run the type checker, and see the web/API package boundaries.

## TEAM-00 — Agree on the integration contract

**Owner:** All members

**Deliverable:** a short contract file that records the agreed package names, ports, environment variables, API ownership, and branch/merge conventions.

**Files:**

```text
docs/TEAM_CONTRACT.md
.env.example
```

**Acceptance criteria:**

- The team has agreed on `apps/web`, `services/api`, `packages/schema`, `packages/rules`, and `packages/config`.
- Web runs on port `3000`; API runs on port `4000`.
- No member has a private duplicate of the shared schemas or verdict calculator.
- API request/response contracts are recorded before frontend integration begins.

## TEAM-01 — Create the monorepo skeleton

**Owner:** Member 3, with review from Members 1 and 2

**Deliverable:** a bootable pnpm monorepo with placeholder web, API, shared schema, rules, and configuration packages.

**Files to scaffold:**

```text
package.json
pnpm-workspace.yaml
turbo.json
apps/web/
services/api/
packages/schema/
packages/rules/
packages/config/
packages/ui/
db/migrations/
fixtures/{documents,extraction,expected,epfo}/
scripts/
docs/
```

**Acceptance criteria:**

- `pnpm install` succeeds.
- `pnpm typecheck` succeeds.
- `pnpm build` succeeds.
- Web and API each expose a basic health response.
- Package imports use workspace package names rather than relative paths across applications.

## TEAM-02 — Add local infrastructure and environment validation

**Owner:** Member 3

**Deliverable:** reproducible local dependencies and validated environment configuration.

**Files:**

```text
docker-compose.yml
infra/compose/README.md
packages/config/src/env.ts
scripts/bootstrap.ts
scripts/wait-for-services.ts
```

**Services:** PostgreSQL, MinIO, and Mailpit. Ollama is optional.

**Acceptance criteria:**

- `docker compose up -d` starts only the required local services.
- `pnpm bootstrap` verifies Node/pnpm versions, starts dependencies, waits for PostgreSQL, and prints service URLs.
- Missing required environment variables fail with a human-readable message.
- `.env.example` contains no real credentials.

---

# Milestone 1 — Shared domain foundation

**Target:** Hours 2–6

**Exit condition:** the domain types, state machine, database base, and CI checks exist before feature work branches diverge.

## BE-01 — Define shared domain enums and types

**Owner:** Member 1

**Deliverable:** shared TypeScript/Zod definitions for cases, documents, findings, evidence, consent, tokens, verdicts, and events.

**Files:**

```text
packages/schema/src/enums.ts
packages/schema/src/case.ts
packages/schema/src/document.ts
packages/schema/src/finding.ts
packages/schema/src/consent.ts
packages/schema/src/evidence.ts
packages/schema/src/event.ts
packages/schema/src/index.ts
```

**Acceptance criteria:**

- Verdict and finding status values exactly match the specification.
- Document kinds include payslip and Form 16.
- Every extraction numeric field is nullable.
- Schemas reject unknown invalid enum values.
- Tests cover valid and invalid examples.

## BE-02 — Implement tolerances and score/verdict calculators

**Owner:** Member 1

**Deliverable:** pure functions for the frozen tolerances, risk score, independent-source count, and verdict.

**Files:**

```text
packages/rules/src/constants.ts
packages/rules/src/score.ts
packages/rules/src/verdict.ts
packages/rules/tests/score.test.ts
packages/rules/tests/verdict.test.ts
```

**Acceptance criteria:**

- Score is `min(100, 40×high + 15×medium + 5×low)`.
- Open findings are used for the verdict.
- One evidence origin produces `insufficient_evidence`.
- Open high findings produce `needs_review`.
- Medium findings without high findings produce `verified_with_notes`.
- No function can return `rejected`.

## BE-03 — Implement the case status transition machine

**Owner:** Member 1

**Deliverable:** one transition function used by all routes and workers.

**Files:**

```text
packages/rules/src/status-machine.ts
packages/rules/tests/status-machine.test.ts
services/api/src/domain/case-status.ts
```

**Acceptance criteria:**

- Valid transitions from the specification are accepted.
- Illegal transitions return a typed `INVALID_TRANSITION` error.
- Withdrawn transitions are available from consent, document, processing, and employer-waiting states.
- Routes do not assign `cases.status` directly.

## OPS-01 — Configure lint, typecheck, test, and build gates

**Owner:** Member 3

**Deliverable:** consistent local scripts and a CI workflow.

**Files:**

```text
.github/workflows/ci.yml
eslint.config.*
prettier.config.*
vitest.config.*
package.json
```

**Acceptance criteria:**

- CI runs lint, typecheck, unit tests, and build.
- Failed tests fail the workflow.
- CI does not require production secrets for unit tests.
- Fixture validation is reserved as a required gate once OPS-05 exists.

## OPS-02 — Add safe structured logging

**Owner:** Member 3

**Deliverable:** request/job logging with redaction.

**Files:**

```text
packages/config/src/logging.ts
services/api/src/observability/logger.ts
services/api/src/observability/request-context.ts
services/api/tests/logging-redaction.test.ts
```

**Acceptance criteria:**

- Logs include service, event, case ID when available, and duration.
- Logs never include document content, extraction payloads, tokens, signed URLs, or secrets.
- A test fails if known sensitive fields are emitted.

---

# Milestone 2 — Persistence, tokens, and auditability

**Target:** Hours 4–10

**Exit condition:** a case can be created, scoped to an organization, issued a purpose-bound token, and audited.

## BE-04 — Create the database schema and migrations

**Owner:** Member 1

**Deliverable:** PostgreSQL/Drizzle tables for the required aggregate data.

**Files:**

```text
services/api/src/db/client.ts
services/api/src/db/schema/organizations.ts
services/api/src/db/schema/users.ts
services/api/src/db/schema/cases.ts
services/api/src/db/schema/consents.ts
services/api/src/db/schema/documents.ts
services/api/src/db/schema/extractions.ts
services/api/src/db/schema/forensics.ts
services/api/src/db/schema/epfo-records.ts
services/api/src/db/schema/findings.ts
services/api/src/db/schema/employer-requests.ts
services/api/src/db/schema/events.ts
db/migrations/
```

**Acceptance criteria:**

- Required tables exist.
- `UNIQUE(case_id, sha256)`, `UNIQUE(case_id, seq)`, and `UNIQUE(token_hash)` exist.
- Cases carry `org_id`.
- Findings store rule ID, severity, explanation, expected, observed, source document IDs, and status.
- Migration can run on a clean PostgreSQL database.

## BE-05 — Implement case creation and organization scoping

**Owner:** Member 1

**Deliverable:** authenticated verifier case creation and case retrieval.

**Files:**

```text
services/api/src/routes/cases/create.ts
services/api/src/routes/cases/list.ts
services/api/src/routes/cases/get.ts
services/api/src/services/cases/case-service.ts
services/api/src/http/errors.ts
services/api/tests/cases.integration.test.ts
```

**Acceptance criteria:**

- `POST /api/cases` validates claimed employer, dates, title, CTC, and optional UAN.
- New cases start in `draft`.
- `GET /api/cases` and `GET /api/cases/:id` are organization-scoped.
- An organization cannot retrieve another organization's case.
- Non-2xx responses use the required error envelope.

## BE-06 — Implement purpose-bound public tokens

**Owner:** Member 1

**Deliverable:** secure consent and employer token issuance/verification.

**Files:**

```text
services/api/src/tokens/generate-token.ts
services/api/src/tokens/verify-token.ts
services/api/src/tokens/token-service.ts
services/api/src/routes/cases/invite.ts
services/api/tests/tokens.test.ts
```

**Acceptance criteria:**

- Raw tokens use 32 random bytes and are never stored.
- Only SHA-256 token hashes are persisted.
- Tokens have a purpose, case, and expiry.
- Consent tokens cannot access employer endpoints.
- Expired tokens return `410 TOKEN_EXPIRED`.
- Token values never appear in logs.

## BE-07 — Implement append-only hash-chained audit events

**Owner:** Member 1

**Deliverable:** transactional event append and verification.

**Files:**

```text
services/api/src/audit/canonical-json.ts
services/api/src/audit/audit-service.ts
services/api/src/audit/hash-chain.ts
services/api/tests/audit-chain.test.ts
scripts/verify-audit-chain.ts
```

**Acceptance criteria:**

- Every event has a monotonic per-case sequence.
- Hash calculation follows `prev_hash|seq|kind|canonical_json(payload)`.
- State mutation and event append occur in the same transaction.
- Modifying an event causes verification to fail.
- Erasure-ready payload handling is documented.

## OPS-03 — Provision local storage and database health checks

**Owner:** Member 3

**Deliverable:** operational checks for PostgreSQL and MinIO.

**Files:**

```text
services/api/src/health/health-route.ts
services/api/src/storage/s3-client.ts
services/api/src/storage/storage-health.ts
scripts/check-local-dependencies.ts
```

**Acceptance criteria:**

- API exposes liveness and readiness checks.
- Readiness fails when PostgreSQL or object storage is unavailable.
- Storage bucket creation is repeatable and does not make the bucket public.

---

# Milestone 3 — Candidate consent and document intake

**Target:** Hours 8–16

**Exit condition:** a candidate can open a tokenized mobile page, give consent, upload documents, provide UAN, submit, withdraw, and see status.

## BE-08 — Implement consent lifecycle endpoints

**Owner:** Member 1

**Deliverable:** public consent API with immutable consent text/version and withdrawal behavior.

**Files:**

```text
services/api/src/routes/public/candidate.ts
services/api/src/routes/public/consent.ts
services/api/src/services/consent/consent-service.ts
services/api/tests/consent.integration.test.ts
```

**Acceptance criteria:**

- `GET /api/public/:token` returns only candidate-safe case information.
- `POST /api/public/:token/consent` stores verbatim text, version, timestamp, IP, and user agent.
- Consent moves the case to `awaiting_documents`.
- `POST /api/public/:token/withdraw` records `withdrawn_at`, transitions the case, and appends an audit event.
- Withdrawn candidates cannot submit more documents.

## WEB-01 — Build the standalone consent page

**Owner:** Member 2

**Deliverable:** mobile-first consent page with explicit, understandable data-processing disclosure.

**Files:**

```text
apps/web/app/c/[token]/page.tsx
apps/web/components/candidate/ConsentSummary.tsx
apps/web/components/candidate/ConsentAction.tsx
apps/web/lib/api/candidate.ts
apps/web/tests/candidate-consent.test.tsx
```

**Acceptance criteria:**

- Above the fold explains what is collected, why, documents requested, sources checked, retention, third-party processing, withdrawal, and dispute path.
- Consent requires an explicit action.
- Loading, expired-token, already-consented, and API-error states exist.
- The page does not expose findings, risk score, or unrelated case data.

## BE-09 — Implement secure document upload

**Owner:** Member 1

**Deliverable:** server-side upload intake with content sniffing, hashing, private storage, and deduplication.

**Files:**

```text
services/api/src/routes/public/documents.ts
services/api/src/services/documents/document-service.ts
services/api/src/services/documents/mime-sniffer.ts
services/api/src/storage/document-storage.ts
services/api/tests/document-upload.test.ts
```

**Acceptance criteria:**

- Upload is limited to 10 MB.
- MIME type is determined from content, not extension.
- SHA-256 is calculated before persistence.
- Duplicate upload returns the existing case/document record.
- Documents are stored under `{org_id}/{case_id}/{document_id}.{ext}` in a private bucket.
- Invalid, oversized, and unsupported files use the required error envelope.

## WEB-02 — Build candidate upload and processing status screens

**Owner:** Member 2

**Deliverable:** candidate document upload, UAN entry, submit, progress, and withdrawal UI.

**Files:**

```text
apps/web/app/c/[token]/upload/page.tsx
apps/web/app/c/[token]/status/page.tsx
apps/web/components/candidate/DocumentUploader.tsx
apps/web/components/candidate/UanForm.tsx
apps/web/components/candidate/ProcessingStatus.tsx
apps/web/components/candidate/WithdrawAction.tsx
```

**Acceptance criteria:**

- Candidate can upload payslip and Form 16.
- Candidate can optionally submit UAN.
- Submit is disabled until required documents exist.
- Duplicate and failed uploads are understandable.
- Candidate sees processing, complete, withdrawn, and error states.
- No private verifier information appears in the page.

## OPS-04 — Add upload and public-endpoint protection

**Owner:** Member 3

**Deliverable:** operational security middleware for public candidate endpoints.

**Files:**

```text
services/api/src/security/rate-limit.ts
services/api/src/security/security-headers.ts
services/api/src/security/request-validation.ts
services/api/tests/public-endpoint-security.test.ts
```

**Acceptance criteria:**

- Public token routes are rate-limited.
- Security headers and CORS are configured.
- Token purpose is checked before route handling.
- Secrets are absent from HTML and JSON responses.
- Document URLs are not public object URLs.

---

# Milestone 4 — Extraction, forensics, EPFO evidence, and rules

**Target:** Hours 12–24

**Exit condition:** fixture JSON can run through the rules without an LLM; at least one real document can go through the extraction interface; the clean and forged scenarios produce the expected outcomes.

## BE-10 — Implement extraction and evidence persistence interfaces

**Owner:** Member 1

**Deliverable:** backend contracts for extraction records, evidence assembly, and provider failure handling.

**Files:**

```text
services/api/src/extraction/types.ts
services/api/src/extraction/extraction-service.ts
services/api/src/evidence/check-context.ts
services/api/src/evidence/evidence-service.ts
services/api/tests/evidence-assembly.test.ts
```

**Acceptance criteria:**

- Extraction records store model ID, schema version, token usage, and status.
- Failed extraction does not silently become a successful empty extraction.
- Extraction failure for one document does not erase other evidence.
- Check context can represent missing payslip, Form 16, EPFO, and employer evidence.

## DOC-01 — Implement provider-independent document extraction

**Owner:** Member 2

**Deliverable:** `LlmDocumentExtractor` interface and deterministic fixture extractor.

**Files:**

```text
services/api/src/extraction/llm-document-extractor.ts
services/api/src/extraction/fixture-extractor.ts
services/api/src/extraction/schema-retry.ts
services/api/src/extraction/providers/anthropic-extractor.ts
services/api/src/extraction/providers/openai-compatible-extractor.ts
services/api/src/extraction/providers/ollama-extractor.ts
services/api/tests/extraction.test.ts
```

**Acceptance criteria:**

- Application code depends on the interface, not a vendor SDK.
- Missing/illegible values become `null`.
- The extractor never computes arithmetic.
- Printed labels are retained in `raw_label`.
- Schema failure retries exactly once with the validation error.
- A second failure marks extraction failed and processing continues safely.
- Fixture extractor makes tests deterministic.

## DOC-02 — Implement payslip and Form 16 schemas/prompts

**Owner:** Member 2, reviewed by Member 1

**Deliverable:** validated extraction schemas and versioned prompts.

**Files:**

```text
packages/schema/src/payslip.ts
packages/schema/src/form16.ts
services/api/src/extraction/prompts/payslip-v1.ts
services/api/src/extraction/prompts/form16-v1.ts
fixtures/extraction/
```

**Acceptance criteria:**

- Payslip schema matches the frozen contract.
- Salary components preserve raw labels and canonical values.
- Prompt explicitly forbids calculation and guessing.
- Null explanations are stored in `extraction_notes`.
- Fixture extraction JSON validates against the schemas.

## DOC-03 — Implement Node-side PDF inspection

**Owner:** Member 2

**Deliverable:** metadata/text/font inspection with safe degradation.

**Files:**

```text
services/api/src/forensics/forensics-service.ts
services/api/src/forensics/pdf-metadata.ts
services/api/src/forensics/font-runs.ts
services/api/src/forensics/monetary-anomalies.ts
services/api/tests/forensics.test.ts
services/forensics/README.md
```

**Acceptance criteria:**

- Producer, creator, creation time, modification time, text, and font-run information are collected where available.
- Monetary text anomalies are represented as evidence, not a verdict.
- Inspection failure returns `null`/not-assessed behavior.
- Raw PDF content is not logged.

## BE-11 — Implement the fixture-backed EPFO provider

**Owner:** Member 1

**Deliverable:** `EpfoProvider` interface and deterministic fixture implementation.

**Files:**

```text
services/api/src/epfo/epfo-provider.ts
services/api/src/epfo/fixture-epfo-provider.ts
services/api/src/epfo/epfo-service.ts
fixtures/epfo/
services/api/tests/epfo.test.ts
```

**Acceptance criteria:**

- No real EPFO integration is attempted.
- Provider requires UAN and consent ID.
- Known fixture UAN returns deterministic employment history.
- Unknown UAN returns deterministic synthetic history or a typed unavailable result.
- Provider failure causes dependent rules to be not assessed.

## BE-12 — Implement deterministic rule registry

**Owner:** Member 1

**Deliverable:** pure rule functions and registry.

**Files:**

```text
packages/rules/src/check.ts
packages/rules/src/check-context.ts
packages/rules/src/checks/payslip-arithmetic.ts
packages/rules/src/checks/pf-implies-basic.ts
packages/rules/src/checks/pf-matches-epfo.ts
packages/rules/src/checks/dual-employment.ts
packages/rules/src/checks/dates-within-epfo-period.ts
packages/rules/src/checks/form16-reconciles-payslip.ts
packages/rules/src/checks/employer-name-match.ts
packages/rules/src/checks/identity-consistent.ts
packages/rules/src/checks/ctc-plausible.ts
packages/rules/src/checks/forensics-metadata.ts
packages/rules/src/checks/epfo-gap-analysis.ts
packages/rules/src/registry.ts
packages/rules/src/runner.ts
packages/rules/tests/checks/*.test.ts
```

**Acceptance criteria:**

- Rules are pure functions with no database, network, filesystem, LLM, or clock access.
- Four visible demo rules use the exact tolerances.
- Every unavailable-input rule is placed in `notAssessed`.
- Findings contain rule ID, severity, title, detail, expected, observed, and source documents.
- No check reads another check's output.
- Missing twelfth rule is documented rather than invented.

## BE-13 — Implement fixture runner and expected-output comparison

**Owner:** Member 1, with Member 2 supplying documents/extractions

**Deliverable:** command-line fixture test runner.

**Files:**

```text
scripts/run-fixtures.ts
packages/test-fixtures/src/fixture-loader.ts
packages/test-fixtures/src/expected-comparator.ts
fixtures/expected/case-*.json
packages/test-fixtures/tests/fixture-runner.test.ts
```

**Acceptance criteria:**

- Five clean and five doctored fixture cases are represented.
- Expected files pin rule IDs, severities, verdict, score, and not-assessed IDs.
- Random IDs and timestamps are excluded from comparison.
- A changed finding or verdict fails the command.

## OPS-05 — Make the fixture suite a CI gate

**Owner:** Member 3

**Deliverable:** CI and local commands that execute the 10-fixture suite.

**Files:**

```text
package.json
.github/workflows/ci.yml
scripts/ci-fixtures.sh
docs/fixture-troubleshooting.md
```

**Acceptance criteria:**

- `pnpm fixtures` runs all ten cases.
- CI fails when any fixture differs from its expected output.
- Fixture output does not print personal document contents or secrets.
- The command works without an LLM API key.

---

# Milestone 5 — Processing orchestration and verifier product

**Target:** Hours 20–32

**Exit condition:** the complete case processing flow works using fixture extraction, persisted findings, score, verdict, and a usable verifier dashboard.

## BE-14 — Implement case-processing orchestration

**Owner:** Member 1

**Deliverable:** idempotent case processing service and worker entry point.

**Files:**

```text
services/api/src/workflows/case-processing.ts
services/api/src/workflows/job-types.ts
services/api/src/workers/case-processing-worker.ts
services/api/src/workflows/idempotency.ts
services/api/tests/case-processing.integration.test.ts
```

**Acceptance criteria:**

- Processing checks current consent and case state before external work.
- Document extraction and forensics can run independently.
- EPFO is called only when UAN exists.
- Rules execute after evidence assembly.
- Findings, score, verdict, audit event, and status update are committed transactionally.
- Reprocessing is idempotent and replaces open findings safely.
- Withdrawn cases do not perform external work or final writes.

## OPS-06 — Configure pg-boss worker operation

**Owner:** Member 3

**Deliverable:** durable job setup, retries, concurrency, and worker health reporting.

**Files:**

```text
services/api/src/workflows/pgboss.ts
services/api/src/workers/worker.ts
services/api/src/workers/worker-health.ts
services/api/tests/worker-safety.test.ts
```

**Acceptance criteria:**

- Queues exist for case processing, employer workflow, retention, and webhooks as needed.
- Jobs are retryable and idempotent.
- Case processing concurrency is capped at four.
- Worker restart does not lose queued work.
- Worker logs contain job/case metadata but no personal document data.

## WEB-03 — Build the verifier dashboard shell

**Owner:** Member 2

**Deliverable:** case list, create-case flow, and case details shell using real API data.

**Files:**

```text
apps/web/app/(dashboard)/cases/page.tsx
apps/web/app/(dashboard)/cases/new/page.tsx
apps/web/app/(dashboard)/cases/[id]/page.tsx
apps/web/components/dashboard/CaseTable.tsx
apps/web/components/dashboard/CreateCaseForm.tsx
apps/web/components/dashboard/CaseStatusBadge.tsx
apps/web/lib/api/cases.ts
```

**Acceptance criteria:**

- Verifier can create a case with employer, dates, title, CTC, and optional UAN.
- Case list shows status and verdict.
- Details page handles loading, empty, processing, and error states.
- UI uses API data and does not hardcode final findings.

## WEB-04 — Build the discrepancy ledger and score display

**Owner:** Member 2

**Deliverable:** explainable findings view.

**Files:**

```text
apps/web/components/ledger/DiscrepancyLedger.tsx
apps/web/components/ledger/FindingCard.tsx
apps/web/components/ledger/NotAssessedList.tsx
apps/web/components/ledger/RiskScore.tsx
apps/web/components/ledger/SourceBadge.tsx
apps/web/tests/discrepancy-ledger.test.tsx
```

**Acceptance criteria:**

- Each finding shows rule ID, severity, title, explanation, expected, observed, source documents, and status.
- Score arithmetic is visible to the verifier.
- Not-assessed rules are visibly separate from findings.
- Ledger supports clean and forged fixture data.
- Candidate/private information is not exposed beyond the case scope.

## BE-15 — Add verifier reprocess and deletion behavior

**Owner:** Member 1

**Deliverable:** reprocess and case lifecycle endpoints.

**Files:**

```text
services/api/src/routes/cases/reprocess.ts
services/api/src/routes/cases/delete.ts
services/api/src/services/cases/reprocess-service.ts
services/api/tests/reprocess.integration.test.ts
```

**Acceptance criteria:**

- Reprocess uses the same deterministic pipeline.
- Open findings are replaced without duplicate active findings.
- An audit event records the reprocess request.
- Deleted/erased data follows the documented event payload redaction behavior.

---

# Milestone 6 — Employer confirmation and disputes

**Target:** Hours 28–38

**Exit condition:** candidate disputes remain visible, and employer confirmation can update evidence without exposing verifier-only information.

## BE-16 — Implement finding disputes

**Owner:** Member 1

**Deliverable:** candidate dispute endpoint and persisted dispute context.

**Files:**

```text
services/api/src/routes/public/dispute.ts
services/api/src/services/findings/dispute-service.ts
services/api/tests/dispute.integration.test.ts
```

**Acceptance criteria:**

- `POST /api/public/:token/dispute` validates the finding belongs to the case.
- Finding status becomes `disputed`.
- The finding remains visible to the verifier.
- Dispute action appends an audit event.
- Dispute does not silently change the verdict.

## WEB-05 — Add dispute UI

**Owner:** Member 2

**Deliverable:** candidate dispute action and verifier dispute context.

**Files:**

```text
apps/web/components/candidate/DisputeForm.tsx
apps/web/components/ledger/DisputeStatus.tsx
apps/web/tests/dispute-ui.test.tsx
```

**Acceptance criteria:**

- Candidate can dispute an eligible finding.
- Candidate sees confirmation/error state.
- Verifier sees that a finding is disputed and can read its context.

## BE-17 — Implement employer request and response workflow

**Owner:** Member 1

**Deliverable:** employer token, confirmation persistence, delayed reminders, and recomputation.

**Files:**

```text
services/api/src/routes/cases/employer-request.ts
services/api/src/routes/public/employer.ts
services/api/src/services/employer/employer-service.ts
services/api/src/workflows/employer-reminders.ts
services/api/tests/employer-workflow.integration.test.ts
```

**Acceptance criteria:**

- Employer token is separate from consent token.
- Employer page can confirm/correct only the permitted three fields and add a note.
- Employer cannot see risk score, findings, documents, or unrelated candidates.
- Production reminder schedule is represented as +48h, +72h, +96h.
- `DEMO_MODE=true` collapses reminder delay to approximately three seconds.
- A response short-circuits later reminders and triggers evidence recomputation.

## WEB-06 — Build employer confirmation page

**Owner:** Member 2

**Deliverable:** tokenized employer page with minimal disclosure.

**Files:**

```text
apps/web/app/e/[token]/page.tsx
apps/web/components/employer/EmployerConfirmationForm.tsx
apps/web/tests/employer-page.test.tsx
```

**Acceptance criteria:**

- Page shows only candidate name, employer name, three confirmation fields, optional note, and submit.
- Expired, wrong-purpose, submitted, and invalid-token states exist.
- Page is usable in an incognito browser.
- No risk score or finding details are rendered in HTML or API payloads.

## OPS-07 — Test secret and privacy boundaries end to end

**Owner:** Member 3

**Deliverable:** automated checks for browser/API leakage and public-token isolation.

**Files:**

```text
scripts/security-smoke-test.ts
services/api/tests/security-boundaries.integration.test.ts
apps/web/tests/no-secret-leak.test.ts
docs/SECURITY_CHECKLIST.md
```

**Acceptance criteria:**

- Wrong token cannot access a case.
- Consent token cannot call employer routes.
- Expired token returns the correct error.
- Organization A cannot access organization B data.
- Service keys, database URLs, LLM keys, and token pepper are absent from browser output.
- Document paths cannot be guessed into public access.

---

# Milestone 7 — Hardening, release, and demo

**Target:** Hours 36–48

**Exit condition:** the judge acceptance script passes reliably from a clean environment and a backup demo is available.

## BE-18 — Complete integration and failure-mode tests

**Owner:** Member 1

**Deliverable:** end-to-end API test covering the full clean and forged flows.

**Files:**

```text
services/api/tests/full-case-flow.integration.test.ts
services/api/tests/failure-modes.integration.test.ts
```

**Acceptance criteria:**

- Clean case: two origins, no open high findings, `verified`.
- Forged case: at least two high findings, `needs_review`, visible score.
- LLM invalid output retries once, then fails safely.
- Forensics timeout results in not-assessed behavior.
- EPFO unavailable results in not-assessed behavior.
- Withdrawn processing stops safely.

## DOC-04 — Stabilize extraction and fixture documents

**Owner:** Member 2

**Deliverable:** final document set and stable extraction outputs for the demo.

**Files:**

```text
fixtures/documents/case-01/...
fixtures/documents/case-06/...
fixtures/extraction/...
fixtures/expected/...
docs/DEMO_FIXTURES.md
```

**Acceptance criteria:**

- Five clean and five doctored fixtures exist.
- Doctored fixtures visibly preserve plausibility while changing independent signals.
- Expected findings are explicit JSON, not inferred during test execution.
- One clean and one forged case are seeded for the live demo.

## OPS-08 — Build deployment and smoke-test automation

**Owner:** Member 3

**Deliverable:** repeatable deployment configuration and a post-deploy smoke test.

**Files:**

```text
infra/deploy/README.md
infra/deploy/web.*
infra/deploy/api.*
scripts/smoke-test.ts
scripts/seed-demo.ts
```

**Acceptance criteria:**

- Web, API, worker, database, and private storage configuration are documented.
- Deployment does not require committing secrets.
- Smoke test verifies health, case creation, token generation, candidate status, and fixture processing.
- Backup demo case can be seeded without duplicating data unexpectedly.
- Rollback/redeploy instructions fit on one page.

## OPS-09 — Add operational dashboard and incident runbook

**Owner:** Member 3

**Deliverable:** minimum observability and a response guide for demo failures.

**Files:**

```text
services/api/src/observability/metrics.ts
docs/RUNBOOK.md
docs/DEMO.md
```

**Acceptance criteria:**

- Team can identify case latency, extraction failures, provider errors, forensic failures, and verdict counts.
- Runbook explains what to do if LLM, worker, storage, or email fails.
- A local/backup fixture path exists when live extraction is unavailable.

## TEAM-03 — Freeze and rehearse the judge flow

**Owner:** All members; Member 3 coordinates

**Deliverable:** verified demonstration of clean, forged, dispute, and employer paths.

**Acceptance criteria:**

- Clean case reaches `verified` in under 90 seconds.
- Forged payslip produces at least two high findings and `needs_review`.
- Candidate dispute changes finding status to `disputed` while keeping it visible.
- Employer confirmation works in an incognito session.
- Audit chain verification passes.
- CI is green.
- Phone journey and backup screenshots/video are ready.

---

# Story dependency map

```text
TEAM-00/01
   ├── BE-01/02/03 ──┬── BE-04/05/06/07
   │                  ├── BE-08/09/10/11/12/13
   │                  └── BE-14/15/16/17/18
   ├── WEB-01/02 ─────┬── WEB-03/04
   │                   └── WEB-05/06
   └── OPS-01/02/03 ───┬── OPS-04/05/06/07/08/09
                        └── TEAM-03
```

## Merge order

To avoid blocking one another, merge in this order:

1. `TEAM-00`, `TEAM-01`, `TEAM-02`
2. `BE-01`, `BE-02`, `BE-03`, `OPS-01`, `OPS-02`
3. `BE-04` through `BE-07`
4. `BE-08`, `BE-09`, `WEB-01`, `WEB-02`, `OPS-04`
5. `DOC-01`, `DOC-02`, `BE-10`, `BE-11`, `BE-12`, `BE-13`, `OPS-05`
6. `BE-14`, `OPS-06`, `WEB-03`, `WEB-04`, `BE-15`
7. `BE-16`, `WEB-05`, `BE-17`, `WEB-06`, `OPS-07`
8. `BE-18`, `DOC-04`, `OPS-08`, `OPS-09`, `TEAM-03`

## Branch and commit convention

Use one branch per story:

```text
codex/BE-04-database-schema
codex/WEB-02-candidate-upload
codex/OPS-05-fixture-ci-gate
```

Each story commit should contain:

- implementation
- tests
- configuration needed to run it
- a short documentation update if behavior or setup changed

## Definition of done for every story

- The acceptance criteria are met.
- The code compiles and the focused tests pass.
- No frozen contract was changed silently.
- Sensitive data is not logged or exposed.
- The story can be demonstrated or verified independently.
- Cursor/Codex reports files changed, commands run, and remaining risks.
