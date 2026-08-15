# BACKEND.md

## PART 0 — Shared

### The three decisions
You own the seam: everything between an HTTP request and a row in Postgres.
Binding artifact: `contract/openapi.yaml`. You do not touch UI, fixtures, or the model provider.
Identical in `BACKEND.md`, `FRONTEND.md`, `PLATFORM.md`. If you change anything here, change it in all three and announce it.

### The situation
347 tests pass, typecheck is clean, the 11-check rules engine works — and a case created in the browser vanishes on restart. Three lines explain it:

| File | Line | |
|---|---|---|
| `services/api/src/routes/cases/create.ts` | 1 | `// …since Express/Fastify isn't set up yet` |
| `services/api/src/workers/worker.ts` | 37 | `// Placeholder for actual processing logic` |
| `apps/web/src/lib/api/store.ts` | 8 | `globalForStore.mockCases = [ … ]` |

`grep -c "processCase(" worker.ts` returns 0. The 158-line pipeline is orphaned. This is a wiring problem, not a quality problem.

### The three decisions

| Decision | Why |
|---|---|
| **No Fastify.** | Next route handlers call the existing handlers via a 25-line adapter. Handlers are already `(req, deps) => {status, body}`. `apps/web/package.json` declares `@tieout/api`; `next.config.ts` lists it in `transpilePackages`. |
| **No pg-boss.** | Fire the pipeline in-process from submit, poll for status. Kills queue bootstrap, worker wiring, idempotency, a whole failure surface. |
| **No deployment.** | One laptop, one tab, localhost. No Docker, no TLS, no Server Actions origin problem, no venue wifi. |

### Frozen enums
* **status:** `draft` | `awaiting_consent` | `awaiting_documents` | `processing` | `complete` | `withdrawn`
* **verdict:** `verified` | `verified_with_notes` | `needs_review` | `insufficient_evidence`  *(no "rejected")*
* **severity:** `high` | `medium` | `low`
* **doc_kind:** `payslip` | `form_16`
* **score:** `min(100, 40*high + 15*medium + 5*low)` *(hand-computable on purpose)*

### Rule IDs
Canonical kebab-case from `packages/rules/src/checks/`. `CHK-*` does not exist; delete it wherever found.
* `payslip-arithmetic`, `payslip-arithmetic-gross`, `payslip-arithmetic-net`
* `pf-implies-basic`, `pf-matches-epfo`, `dual-employment`
* `dates-within-epfo-period`, `form16-reconciles-payslip`, `employer-name-match`
* `identity-consistent`, `ctc-plausible`, `epfo-gap-analysis`
* `forensics-metadata`, `forensics-font-anomalies`, `forensics-monetary-anomalies`

### Error handling
Branch on HTTP status, not on `error.code`. `services/api/src/http/errors.ts` emits seven generic codes today — `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `GONE`, `VALIDATION_ERROR`, `INTERNAL_ERROR`. Everything else is a refinement. Status is guaranteed; code is a bonus. Always have a default branch.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "details": {
      "fields": [{ "path": "uan", "message": "UAN must be 12 digits." }]
    },
    "request_id": "req_01HZYD"
  }
}
```

Full catalogue — 21 codes, 62 documented responses — in `contract/openapi.yaml`.

### Environment

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tieout
APP_BASE_URL=http://localhost:3000        # ABSENT from .env.example - add it
DEV_USER_ID=00000000-0000-0000-0000-000000000001
DEV_ORG_ID=00000000-0000-0000-0000-000000000002
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=documents
S3_FORCE_PATH_STYLE=true
GEMINI_API_KEY=
EXTRACTION_MODEL=gemini-2.5-flash
EXTRACTION_FALLBACK=fixture
EPFO_PROVIDER=fixture
```

### Checkpoints - 15 min, all three present, no laptops

| Hour | Question | If no |
| --- | --- | --- |
| **CP1** | H4 | Does POST `/api/cases` write a real row? |
| **CP2** | H8 | Has a doctored payslip produced a real finding from a real extraction? |
| **CP3** | H12 | Does the full chain run clean twice? |

### Degradation ladder - check at CP2

| Rung | Trigger | Action |
| --- | --- | --- |
| 0 | On track | Live upload, live extraction |
| 1 | Model unreliable | `EXTRACTION_FALLBACK=fixture`, Say so on stage. |
| 2 | Repository incomplete at H10 | Seeded cases + live case creation. Skip upload. |
| 3 | Nothing wired by H11 | Demo on mocks; show psql output and passing rules tests. |
| 4 | Breaks at H14 | Play the backup video, narrate live. |

*Never fake a finding. Judges forgive a stated limitation; they do not forgive discovering one.*

### Not built today

Fastify · pg-boss · SeaweedFS · generated OpenAPI · Schemathesis · generated FE client · RLS · retention · employer flow · dispute wiring · component library · Docker · deployment · backups · observability · load tests · model router · rename · the 7 missing rule tests · case list filters · reprocess.

### Rules

* The seam beats the feature.
* Merge to main every two hours, behind a flag if unfinished.
* Nobody fixes anybody else's code — report it, keep moving.
* Code freeze H13 regardless of state. Rehearse three times.

---

## PART 1 — Your gaps

| Gap | Workaround |
| --- | --- |
| No HTTP server | Next route handlers + adapter. Do not build Fastify — 3.5 h on the critical path, and it blocks frontend. |
| No repository; ~15 `deps.db` methods exist only in test mocks | Implement the ~15 the demo touches. Loudly throw for the rest. |
| `worker.ts:37` placeholder; `processCase()` never called | Call it inline from submit, don't await, poll for status |
| No auth middleware | Hardcoded `{ userId, orgId }` from env. A seam, not a feature. |
| `not_assessed` is a finding status internally, a separate array in the API | You do the projection in `GET /api/cases/:id` |
| Findings carry raw uuids; the UI must never render one | You resolve `source_label` server-side |

*Nothing you build today is throwaway except the dev auth. The adapter, repository and route files all survive into the Fastify version later.*

---

## PART 2 — Setup

```bash
corepack enable && corepack prepare pnpm@10.12.4 --activate
cp .env.example .env       # then add APP_BASE_URL, DEV_USER_ID, DEV_ORG_ID
pnpm install
pnpm approve-builds        # approve esbuild, or vitest won't start
docker compose up -d       # postgres, minio, mailpit

# migrations do NOT run automatically
psql "postgresql://postgres:postgres@localhost:5432/tieout" -f db/migrations/0001_initial_schema.sql

# the bucket is NOT created automatically
docker run --rm --network host minio/mc:latest sh -c \
  "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb --ignore-existing local/documents"

pnpm --filter @tieout/web dev
```

**Health:** `pg_isready -h localhost -p 5432 -U postgres` · `psql "$DATABASE_URL" -c "\dt"` → 12 tables

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| relation "cases" does not exist | Migration not applied — run the `psql -f` above |
| Drizzle/postgres errors in the Next runtime | Add `serverExternalPackages: ['postgres','drizzle-orm','pdfjs-dist']` to `next.config.ts`; confirm `export const runtime = 'nodejs'` in the route file |
| "too many clients" after a few saves | Connection isn't a globalThis singleton — see BE-2 |
| NoSuchBucket on upload | Run the `mc mb` command above |
| not implemented in demo build | Expected for employer/dispute/reprocess/retention. If it fires on the demo path, implement that method. |
| Stale schema after a pull | `docker compose down -v && docker compose up -d`, then re-run migration + bucket |
| Port 5432 in use | A local Postgres is running. Stop it, or change the compose mapping and `DATABASE_URL`. |

---

## PART 3 — Tasks

Feed one at a time to your agent. Prefix every prompt:

> Recheq monorepo: pnpm workspaces, TypeScript, Next 16, Drizzle, PostgreSQL, Zod, Vitest.
> Hackathon sprint, hours remaining. Implement ONLY the task below. Inspect existing files
> first. Prefer the smallest change that works. Do not refactor adjacent code. Do not add
> abstractions. Run the acceptance command and paste the output.

| Hours | Task |
| --- | --- |
| 0-1 | **BE-1** adapter + first live route |
| 1-4 | **BE-2** repository |
| 4 | **CP1** |
| 4-6 | **BE-3** case read routes |
| 6-8 | **BE-4** public token routes |
| 8 | **CP2** |
| 8-10 | **BE-5** pipeline wiring + status |
| 10-12 | Bug fixes, demo path only |

### BE-1 · Adapter and first live route — 1 h

**Files:** `apps/web/src/lib/server/adapter.ts`, `deps.ts`, `apps/web/src/app/api/cases/route.ts` (all new)

The handlers in `services/api/src/routes/**` have the shape `(req: { body, context, auth }, deps) => { status, body }`. They are framework-agnostic. Call them from Next route handlers. Do NOT build a Fastify server.

1. `adapter.ts` exports `toHandler(fn) => (request: Request, ctx) => Promise<NextResponse>`:
* parse the JSON body, tolerating an empty body
* build a RequestContext (`services/api/src/observability/request-context.ts`)
* attach auth `{ userId: process.env.DEV_USER_ID, orgId: process.env.DEV_ORG_ID }`
* call `fn(req, deps)`
* return `NextResponse.json(result.body, { status: result.status })`
* catch and route through `toErrorResponse` from `services/api/src/http/errors.ts`, matching the envelope in `contract/openapi.yaml`
* attach a `request_id` (`crypto.randomUUID`) and include it on 5xx

2. `deps.ts` exports a memoised `buildDeps()`, guarded with `globalThis` against Next hot reload. May throw on unimplemented methods for now — BE-2 fills it in.
3. `app/api/cases/route.ts`:
```typescript
export const runtime = 'nodejs';
export const POST = toHandler(createCaseHandler);
export const GET  = toHandler(listCasesHandler);
```

Do not modify anything under `services/api/src/routes/`.

**Accept:**

```bash
curl -s -XPOST localhost:3000/api/cases -H 'content-type: application/json' \
  -H "authorization: Bearer \$DEV_TOKEN" \
  -d '{"candidate_name":"Test","candidate_email":"t@e.com","employer_name":"Acme","title":"Analyst","claimed_ctc":1200000,"employment_start":"2023-04-01","employment_end":"2026-03-31"}' -i | head -1
```

*(A 500 from inside the repository passes. A 404 from the router does not.)*

### BE-2 · The repository — 3 h, longest task of your day

**Files:** `apps/web/src/lib/server/db.ts`, `repository.ts` (new)

Implement the concrete database adapter, `CaseProcessingDeps['db']` in `services/api/src/workflows/case-processing.ts` and the case/consent/document service deps declare methods that only test mocks satisfy.

Implement ONLY these, with Drizzle against `services/api/src/db/schema/`:

* `createCase`, `getCaseById`, `listCases`, `updateCaseStatus`, `updateCaseStatusAndVerdict`
* `createConsent`, `getConsentByCaseId`
* `createDocument`, `getDocumentsForCase`, `getDocumentContent`
* `createExtraction`, `updateExtractionSuccess`, `updateExtractionFailure`, `getSuccessfulExtractions`
* `createEpfoRecord`
* `replaceFindings`, `getFindingsForCase`
* `transaction`

Throw `new Error('not implemented in demo build')` for every employer, dispute, reprocess and retention method. A loud throw beats a silent wrong answer.

* `db.ts`: module-level Drizzle connection reusing `createDb()` from `services/api/src/db/client.ts`, guarded with `globalThis` for hot reload.
* `transaction()` uses a real Drizzle transaction.
* `replaceFindings` and its audit `appendEvent` MUST run in ONE transaction. The hash-chained audit log is a pitch point — do not skip it to save time.
* `createDocument` is idempotent on sha256: same hash returns the existing row.
* Never log row contents.

**Accept:**

```bash
curl -s -XPOST localhost:3000/api/cases -d '{...}' -H 'content-type: application/json' | jq '.id'
psql "$DATABASE_URL" -c "SELECT id,status FROM cases"
psql "$DATABASE_URL" -c "SELECT count(*) FROM events"    # audit events written
```

### BE-3 · Case read routes — 2 h

**Files:** `apps/web/src/app/api/cases/[id]/route.ts`, `apps/web/src/lib/server/projections.ts` (new)

Implement `GET /api/cases/:id` returning exactly the `CaseDetail` schema in `contract/openapi.yaml`.

Three projections the frontend depends on. Do these server-side, not in the UI:

1. **`not_assessed` split.** The rules engine models unassessed rules as `FindingStatus = 'not_assessed'`. The API must NOT return those inside `findings`. Filter them out and project into `not_assessed: [{ rule_id, title, reason }]`. Get it wrong and the ledger reports "6 problems found" when there are 2.
2. **`source_label`.** Findings carry `source_document_ids` (uuids). Resolve each to a human string like "Payslip · Mar 2026". The frontend must never render a raw uuid.
3. **`origins`.** `string[]` of independent sources present (`payslip`, `form_16`, `epfo`, `employer`). Drives the evidence chips and the verdict's source count.

Sort findings by severity (`high`, `medium`, `low`) then `rule_id`, so order is stable across reloads. The UI does not re-sort.
Also return `400 INVALID_UUID` when `:id` is not a uuid — Next passes any string through.

**Accept:**

```bash
curl -s localhost:3000/api/cases/$ID | jq '{verdict,risk_score,origins,f:(.findings|length),na:(.not_assessed|length)}'
curl -s localhost:3000/api/cases/$ID | jq '[.findings[].status]|unique'  # no "not_assessed"
curl -s localhost:3000/api/cases/$ID | jq '.findings[0].source_label'    # a string, not a uuid
curl -s localhost:3000/api/cases/not-a-uuid -i | head -1                 # 400
```

### BE-4 · Public token routes — 2 h

**Files:** `apps/web/src/app/api/public/[token]/route.ts`, `consent/route.ts`, `documents/route.ts`, `uan/route.ts` (new)

Wire the candidate journey through the adapter, reusing handlers in `services/api/src/routes/public/` where they exist.

* `GET  /api/public/:token`            -> `getCandidateHandler`
* `POST /api/public/:token/consent`    -> `grantConsentHandler`
* `POST /api/public/:token/documents`  -> `uploadDocumentHandler` (multipart)
* `POST /api/public/:token/uan`        -> NEW, small: validate 12 digits, store `cases.uan`

**Multipart:** read with `request.formData()`, convert to Buffer, pass into the existing handler. Enforce 10MB (`413 FILE_TOO_LARGE`) and sniff MIME by content not extension (`415 UNSUPPORTED_MEDIA_TYPE`) — `services/api/src/services/documents/mime-sniffer.ts` already does this.

Two behaviours the frontend is coded against:

* duplicate upload (same sha256) returns 200 with the existing `document_id`, not 409
* consent with `granted:false` returns 200 with status "withdrawn", not an error

**HARD CONSTRAINT:** these endpoints must never return `risk_score`, `verdict`, or `findings`. Write the response shape explicitly; do not spread a case record. A judge opening devtools on the candidate page and seeing a verdict is the worst bug we can ship.

**Accept:**

```bash
curl -s localhost:3000/api/public/$T | jq 'has("verdict"),has("risk_score"),has("findings")'  # false false false
curl -s localhost:3000/api/public/nope -i | head -1       # 404
curl -s localhost:3000/api/public/expired -i | head -1    # 410
# consent twice -> second returns 409
```

### BE-5 · Pipeline wiring and status — 2 h

**Files:** `apps/web/src/lib/server/process.ts`, `app/api/public/[token]/submit/route.ts`, `status/route.ts` (new)

`services/api/src/workflows/case-processing.ts` implements the entire pipeline — extraction, forensics, EPFO, runAllChecks, verdict, findings, audit — 158 lines, correct, and nothing calls it. Do NOT wire pg-boss today.

1. `process.ts` exports `startProcessing(caseId)`:
* set status = `'processing'`
* call `processCase(caseId, false, buildDeps())` WITHOUT awaiting. `void` the promise, `.catch()` to log and mark the case degraded.
* return immediately
* Async behaviour, zero queue infrastructure.

2. `POST /api/public/:token/submit`
* verify the token
* `awaiting_documents` -> `processing`; anything else `409 INVALID_TRANSITION`
* if a required kind is missing: `409 DOCUMENTS_INCOMPLETE` with `details.missing`
* call `startProcessing`, return 202

3. `GET /api/public/:token/status`
* Return the four-step array exactly as in `contract/openapi.yaml`. Derive step states from extraction rows and case status; the UI renders them verbatim.

4. A hard extraction failure must NOT produce a failed status. The case reaches `'complete'` with verdict `'insufficient_evidence'` and `not_assessed` populated. A broken model call must never look like a candidate problem. Surface the reason in the optional `error` object on the status response, display-only.
5. Forensics is best-effort: if `pdfjs` throws in the Next runtime, catch it and let those checks report `not_assessed`. The arithmetic checks carry the demo.

**Accept:**

```bash
curl -s -XPOST localhost:3000/api/public/$T/submit -i | head -1    # 202
watch -n2 "curl -s localhost:3000/api/public/$T/status | jq .status"  # processing -> complete <60s
psql "$DATABASE_URL" -c "SELECT rule_id,severity FROM findings WHERE case_id='$ID'"
```

---

## PART 4 — Your test checklist

Every task: `pnpm typecheck && pnpm test` — 347 must stay green.

**Error paths** — all documented in `contract/openapi.yaml`:

| Case | Expect |
| --- | --- |
| `-d '{bad'` | `400 MALFORMED_JSON` |
| no auth header on `/api/cases` | `401` |
| `/api/cases/not-a-uuid` | `400 INVALID_UUID` |
| `/api/cases/$(uuidgen)` | `404` |
| bad token / expired token | `404` / `410` |
| consent twice | `409` |
| upload >10MB / a .zip | `413` / `415` |
| `{"uan":"123"}` | `422` with `details.fields[]` |
| submit with one document | `409 DOCUMENTS_INCOMPLETE` + `details.missing` |
| docker compose stop postgres then any call | `503` |

*message must never contain a stack trace, SQL fragment, file path, or personal data.*

**Before freeze:**

```bash
for p in "" "/status"; do curl -s "localhost:3000/api/public/$T$p" | jq 'has("verdict"),has("risk_score"),has("findings")'; done
# every line false
```

**Your acceptance:** a case created in the browser is a row in Postgres, survives a `pnpm dev` restart, and a doctored payslip produces ≥2 high findings with verdict: `needs_review`. The audit chain verifies via `verify-chain.ts`.

---

## PART 5 — Handoffs

* **To FE at H1:** BE-1 has landed — they can flip `/api/cases` off the Prism mock.
* **To FE at H8:** confirm `GET /api/cases/:id` returns `not_assessed` and `source_label`. They render both; if it's missing they're blocked.
* **From Platform at H2:** `fixtures/epfo/*.json` for the fixture provider.
* **From Platform at H4:** `fixtures/documents/doctored-01/` to test BE-5.
