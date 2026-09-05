# PLATFORM.md

## PART 0 — Shared

**The situation**

You own **perception, the demo's raw material, and whether it works on stage.**
Binding artifact: `contract/openapi.yaml`. You do not touch route handlers, the repository, or UI components.

Your lane has **zero dependency on the other two**. That means you are never blocked - and if you slip, nobody can cover for you.

---

> Identical in `BACKEND.md`, `FRONTEND.md`, `PLATFORM.md`. If you change anything here, change it in all three and announce it.

### The situation

347 tests pass, typecheck is clean, the 11-check rules engine works - and a case created in the browser vanishes on restart. Three lines explain it:

| File                                      | Line |                                              |
| ----------------------------------------- | ---- | -------------------------------------------- |
| `services/api/src/routes/cases/create.ts` | 1    | `// …since Express/Fastify isn't set up yet` |
| `services/api/src/workers/worker.ts`      | 37   | `// Placeholder for actual processing logic` |
| `apps/web/src/lib/api/store.ts`           | 8    | `globalForStore.mockCases = [ … ]`           |

`grep -c "processCase(" worker.ts` returns **`0`**. The 158-line pipeline is orphaned. This is a wiring problem, not a quality problem.

### The three decisions

| Decision           | Why                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No Fastify.**    | Next route handlers call the existing handlers via a 25-line adapter. Handlers are already `(req, deps) => {status, body}`. `apps/web/package.json` declares `@recheq/api`; `next.config.ts` lists it in `transpilePackages`. |
| **No pg-boss.**    | Fire the pipeline in-process from submit, poll for status. Kills queue bootstrap, worker wiring, idempotency, a whole failure surface.                                                                                        |
| **No deployment.** | One laptop, one tab, localhost. No Docker, no TLS, no Server Actions origin problem, no venue wifi.                                                                                                                           |

### Frozen enums

```text
status      draft | awaiting_consent | awaiting_documents | processing | complete | withdrawn
verdict     verified | verified_with_notes | needs_review | insufficient_evidence  <- no "rejected"
severity    high | medium | low
doc_kind    payslip | form_16
score       min(100, 40*high + 15*medium + 5*low)   <- hand-computable on purpose
```

**Rule IDs** — canonical kebab-case from `packages/rules/src/checks/`. `CHK-*` does not exist; delete it wherever found.

```text
payslip-arithmetic  payslip-arithmetic-gross  payslip-arithmetic-net
pf-implies-basic    pf-matches-epfo           dual-employment
dates-within-epfo-period  form16-reconciles-payslip  employer-name-match
identity-consistent  ctc-plausible  epfo-gap-analysis
forensics-metadata  forensics-font-anomalies  forensics-monetary-anomalies
```

### Error handling

**Branch on HTTP status, not on `error.code`.** `services/api/src/http/errors.ts` emits seven generic codes today - `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `GONE`, `VALIDATION_ERROR`, `INTERNAL_ERROR`. Everything else is a refinement. Status is guaranteed; `code` is a bonus. Always have a default branch.

Full catalogue - 21 codes, 62 documented responses - in `contract/openapi.yaml`.

### Environment

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recheq
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

| Hour | Question | If no                                                                  |
| ---- | -------- | ---------------------------------------------------------------------- |
| CP1  | 4        | Does POST /api/cases write a real row?                                 |
| CP2  | 8        | Has a doctored payslip produced a real finding from a real extraction? |
| CP3  | 12       | Does the full chain run clean twice?                                   |

### Degradation ladder - you own this call

| Rung | Trigger                      | Action                                                   |
| ---- | ---------------------------- | -------------------------------------------------------- |
| 0    | On track                     | Live upload, live extraction                             |
| 1    | Model unreliable             | `EXTRACTION_FALLBACK=fixture`, Say so on stage.          |
| 2    | Repository incomplete at H10 | Seeded cases + live case creation. Skip upload.          |
| 3    | Nothing wired by H11         | Demo on mocks; show psql output and passing rules tests. |
| 4    | Breaks at H14                | Play the backup video, narrate live.                     |

Never fake a finding. Judges forgive a stated limitation; they do not forgive discovering one.

### Not built today

Fastify · pg-boss · SeaweedFS · generated OpenAPI · Schemathesis · generated FE client · RLS · retention · employer flow · dispute wiring · component library · Docker · deployment · backups · observability · load tests · model router · rename · the 7 missing rule tests · case list filters · reprocess.

### Rules

- The seam beats the feature.
- Merge to main every two hours, behind a flag if unfinished.
- Nobody fixes anybody else's code - report it, keep moving.
- Code freeze H13 regardless of state. Rehearse three times.

---

## PART 1 — Your gaps

| Gap                                                                                                                      | Workaround                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Zero PDFs in the repo - `fixtures/extraction/` is pre-extracted JSON, so forensics has never run on a real file          | Create real PDFs. Task one, and it is the demo.                                                                                        |
| `fixtures/expected/` does not exist. `pnpm fixtures` prints a warning and exits 0 - the mandatory gate validates nothing | Write expected JSON, make the script exit 1 on zero fixtures                                                                           |
| No Gemini provider; `.env.example` has only `OPENAI_*`                                                                   | Add one behind the existing `LlmDocumentExtractor` interface                                                                           |
| A flaky model API can kill the demo at hour 14                                                                           | `EXTRACTION_FALLBACK=fixture` - two failures and it serves the fixture extractor, loudly logged and recorded in `extractions.model_id` |
| MinIO Community archived Feb 2026, no patches, AGPL risk                                                                 | Leave it running. It works. Name it on the honest-risks slide. Swapping is a week-2 job.                                               |
| No seed data - a failed live upload means no demo                                                                        | `pnpm seed`: one clean and one forged case, already complete                                                                           |
| No EPFO data                                                                                                             | Fixture provider - already scaffolded at `services/api/src/epfo/fixture-epfo-provider.ts`                                              |

---

## PART 2 — Setup

```bash
corepack enable && corepack prepare pnpm@10.12.4 --activate
cp .env.example .env       # add APP_BASE_URL, DEV_*, GEMINI_API_KEY
pnpm install
pnpm approve-builds        # approve esbuild, or vitest won't start
docker compose up -d       # postgres, minio, mailpit

psql "postgresql://postgres:postgres@localhost:5432/recheq" -f db/migrations/0001_initial_schema.sql

docker run --rm --network host minio/mc:latest sh -c \
  "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb --ignore-existing local/documents"
```

Health, one line:

```bash
pg_isready -h localhost -p 5432 -U postgres && \
curl -sf http://localhost:9000/minio/health/live && \
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" && \
echo "stack OK"
```

### Commands

| Command                  | Note                                                |
| ------------------------ | --------------------------------------------------- |
| `pnpm typecheck`         | must stay clean - it is today                       |
| `pnpm test`              | 347 passing, 6 skipped                              |
| `pnpm fixtures`          | currently exits 0 with zero fixtures - that's OPS-4 |
| `docker compose down -v` | drops volumes; use after a schema change            |

### Troubleshooting

| Symptom                                               | Fix                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm install` warns "Ignored build scripts: esbuild" | `pnpm approve-builds && pnpm rebuild esbuild`                                                     |
| NoSuchBucket on upload                                | Run the `mc mb` command above                                                                     |
| relation "cases" does not exist                       | Migration not applied                                                                             |
| Extraction hangs or returns junk                      | `EXTRACTION_FALLBACK=fixture`, restart. Check `extractions.model_id` to see which path served it. |
| Stale schema after a pull                             | `docker compose down -v && docker compose up -d`, re-run migration + bucket                       |
| Port 9000 or 5432 in use                              | `lsof -ti:9000`                                                                                   |

---

## PART 3 — Tasks

| Hours | Task                                               |
| ----- | -------------------------------------------------- |
| 0-2   | **OPS-1** doctored PDFs - before anything else     |
| 2-4   | **OPS-2** EPFO fixtures                            |
| 4     | **CP1**                                            |
| 4-7   | **OPS-3** Gemini provider with fallback            |
| 7-8   | **OPS-4** expected fixtures and the gate           |
| 8     | **CP2** - you call it                              |
| 8-10  | **OPS-5** seed script                              |
| 10-12 | **OPS-6** dry runs every 30 min, precision numbers |
| 12-14 | **OPS-7** deck and backup video                    |
| 13    | Freeze - you run the rehearsals                    |

### OPS-1 · The doctored documents - 2 h

Manual work, not an agent task. Open a PDF editor.
**Files:** `fixtures/documents/clean-01/{payslip,form16}.pdf` · `doctored-01/{payslip,form16}.pdf` · `doctored-02/payslip.pdf` · `docs/DEMO_FIXTURES.md`

- Take a real payslip from a team inbox. Redact the name and employee id. Save as `clean-01/payslip.pdf`. Same for a Form 16.
- `doctored-01` is the money moment. Copy `clean-01` and change only the basic salary, roughly ₹30,000 → ₹52,000. Leave the PF deduction at ₹3,600. Then:
- `pf-implies-basic` fires - ₹3,600 ÷ 0.12 = ₹30,000, but basic reads ₹52,000
- `pf-matches-epfo` fires - the EPFO record from OPS-2 says ₹1,800
- Two independent contradictions from one edit.

- `doctored-02`: change only net pay so gross - deductions ≠ net. Fires `payslip-arithmetic`.
- `docs/DEMO_FIXTURES.md` names each file and the rule it triggers.

**Accept:** a teammate looking at `doctored-01/payslip.pdf` cannot tell it was edited. If it looks fake, the demo is worthless - redo it.

### OPS-2 · EPFO fixtures - 2 h

**Files:** `fixtures/epfo/{arun-clean,arun-doctored,dual-employment}.json` · `services/api/src/epfo/fixture-epfo-provider.ts`

The fixture EPFO provider is scaffolded but has no data matching the demo.

1. `arun-doctored.json` for UAN 100123456789: one `member_period` at Acme Technologies with monthly contributions where March 2026 `employee_share` is 1800. This is the second independent contradiction against the doctored payslip's 3600, and the most persuasive line in the pitch: the employer filed it, the candidate never touched it.
2. `arun-clean.json`: same shape, `employee_share` 3600, consistent with the clean payslip.
3. `dual-employment.json`: two establishments with overlapping contributions in the same three months, for a second demo case if time allows.
4. Make `fixture-epfo-provider.ts` resolve by UAN and return a deterministic synthetic history for unknown UANs, so a live-typed UAN never crashes the demo.

Normalise everything to `EmploymentHistorySchema` in `packages/schema`.

**Accept:** `pnpm --filter @recheq/api test -- epfo` passes; running the rules engine over `doctored-01` + `arun-doctored` fires both `pf-implies-basic` and `pf-matches-epfo`.

### OPS-3 · Gemini provider with fixture fallback - 3 h

**Files:** `services/api/src/extraction/providers/gemini-extractor.ts` (new) · `llm-document-extractor.ts` · `prompts/payslip-v1.ts` · `.env.example` · `tests/extraction.test.ts`

Providers today are anthropic, ollama, openai-compatible. Add Gemini plus a demo safety valve.

1. `gemini-extractor.ts` implements the existing `LlmDocumentExtractor` interface. Send the PDF as an inline base64 part. Force JSON output matching the `payslip-v1` / `form16-v1` Zod schema. Reuse `schema-retry.ts`: one retry with the Zod error appended, then `ExtractionFailed`.
2. Env: `GEMINI_API_KEY`, `EXTRACTION_MODEL`, `EXTRACTION_FALLBACK`.
3. When `EXTRACTION_FALLBACK=fixture` and Gemini fails or returns non-conforming JSON twice, fall back to the fixture extractor rather than failing the case. Log loudly which path was taken and record it in `extractions.model_id` so we never lie about it on stage.
4. State all four prompt invariants explicitly in the system prompt:

- return null for anything not legible or not present, never guess
- do not compute any value, read printed figures only
- preserve labels verbatim in `raw_label`
- explain every null in `extraction_notes`

Use a Flash-tier model, not Pro. Roughly 5x cheaper, fast enough, and today you will run hundreds of test extractions.

**Accept:** `pnpm --filter @recheq/api test -- extraction` passes. Critically: extracting `doctored-01/payslip.pdf` returns `basic=52000` and `pf_employee=3600` - the model read the doctored numbers correctly. It is not supposed to notice they contradict. That is the rules engine's job, and that split is the pitch.

### OPS-4 · Expected fixtures and the gate - 1 h

**Files:** `fixtures/expected/*.json` (new) · `scripts/run-fixtures.ts`

`pnpm fixtures` prints "[WARNING] Could not read fixtures directory" and calls `process.exit(0)`. CI is green on a suite that validates nothing.

1. `fixtures/expected/<name>.json` per fixture, declaring expected verdict, risk score, and the exact set of rule_ids that must fire.
2. In `run-fixtures.ts`: if zero fixtures load, exit 1, not 0.
3. Print "N/M passed".

**Accept:** `pnpm fixtures` -> "N/M passed", exit 0. `rm -rf fixtures/expected && pnpm fixtures; echo $?` -> non-zero.

### OPS-5 · Seed script - 2 h

**Files:** `scripts/seed-demo.ts` (new) · `package.json`

Create, idempotently:

- one org and one verifier user matching `DEV_ORG_ID` / `DEV_USER_ID`
- one CLEAN case, already complete, verdict `verified`
- one FORGED case, already complete, verdict `needs_review`, with the two high findings from `doctored-01` and their audit events

This is the backup if live upload fails on stage, and it is what the case list shows before you create anything.

Add `seed` and `seed:reset` scripts. `seed:reset` drops and re-creates so running twice is safe.

**Accept:** `pnpm seed` && `pnpm seed` produces no duplicates. `/cases` shows two browsable cases; the forged one opens to a populated ledger.

### OPS-6 · Dry runs and the numbers - 2 h, continuous from H10

Run the full chain every 30 minutes, one browser tab, in order:

| #   | Step                              | Pass                                                                  |
| --- | --------------------------------- | --------------------------------------------------------------------- |
| 1   | Open localhost:3000               | Redirects to `/cases`                                                 |
| 2   | Case list                         | Seeded cases with badges                                              |
| 3   | + New case, fill, submit          | Link panel on the same page                                           |
| 4   | Paste link in a new tab           | Consent screen, no scrolling                                          |
| 5   | Read the copy                     | "Where" row present                                                   |
| 6   | Grant consent                     | Redirects to upload                                                   |
| 7   | Upload doctored payslip + Form 16 | Both cards green                                                      |
| 8   | Enter UAN, submit                 | Named steps advancing                                                 |
| 9   | Watch to completion               | complete inside 90 s - time this, it's a pitch claim                  |
| 10  | Open in the dashboard             | `needs_review`, score 80                                              |
| 11  | Read the ledger                   | ≥2 high findings, each with rule id, expected, observed, source label |
| 12  | Not-assessed                      | Quiet strip, visually distinct                                        |
| 13  | Devtools on the candidate tab     | No verdict / score / findings                                         |
| 14  | Restart `pnpm dev`, reload        | The case is still there                                               |

Log failures by step number and report to whoever owns that lane. Do not fix their code.
Produce two numbers for the slide: of the doctored documents, how many were caught; of the clean ones, how many produced a false high finding. State the sample size honestly - "5/5 caught, 0 false positives on 5 clean documents" beats no number.

**Accept:** three consecutive clean runs.

### OPS-7 · Deck and backup - 2 h

Record a 3-minute screen capture the moment you get three clean runs. That is rung 4 of the ladder and it has saved more hackathon teams than any other artefact.
Eight slides:

- Problem - employment verification takes 3-7 days because it waits on someone else's inbox.
- Insight - don't verify a document, verify consistency across independently-sourced records.
- A candidate can forge a payslip. They cannot forge a payslip and a Form 16 and the employer-filed EPFO record and have all three agree on arithmetic.
- Live demo - the 14 steps above.
- How - the model reads, deterministic rules decide. That split is why verdicts are reproducible and why a candidate can contest one.
- Defensibility - 11 checks, hash-chained audit log, no rejected verdict, candidate dispute channel, the precision numbers from OPS-6.
- Business - ₹99-199 per instant check, ~₹1-3 inference cost, sell to BGV agencies first because their cost base is humans on email.
- Honest risks - say all four out loud: EPFO is behind a provider interface and mocked today; small employers have no PF record; scanned payslips defeat metadata forensics; documents leave India for the model call.

---

## PART 4 — Acceptance for the whole system

You verify these, because you're the only one with the full picture:

- [ ] `pnpm --filter @recheq/web build` exits 0
- [ ] `pnpm typecheck` clean, `pnpm test` 347 passing
- [ ] `pnpm fixtures` reports N/N and exits non-zero when a fixture is broken
- [ ] `grep -r "mockCases\|mockState\|Placeholder for actual\|CHK-" .` returns nothing
- [ ] A case created in the browser is a row in Postgres and survives a restart
- [ ] A doctored payslip produces ≥2 high findings from a real extraction - or, if the fixture fallback served it, that is stated on stage
- [ ] Verdict `needs_review`, risk score displayed with its arithmetic visible
- [ ] Every finding shows rule id, expected, observed, and a human source label - never a raw uuid
- [ ] `not_assessed` is a separate array in the API and a visually distinct strip in the UI
- [ ] Consent is standalone, fits without scrolling, includes the cross-border disclosure
- [ ] No public endpoint returns verdict, risk_score, or findings
- [ ] The audit chain verifies for a case that went through the full pipeline
- [ ] The 14-step script runs clean three times
- [ ] A 3-minute backup recording exists

Not tested today, and say so plainly if asked: no load testing, no security scanning beyond the existing gitleaks CI step, no accessibility audit, no cross-browser matrix, no RLS verification, no restore drill, no contract fuzzing.

All of it is in `IMPLEMENTATION_PATH.md` milestones 9 and 11. A team that knows exactly what it hasn't tested reads as more credible than one claiming full coverage.

---

## PART 5 — Handoffs

- To BE at H2: `fixtures/epfo/*.json` - they need it for the fixture provider.
- To BE at H4: `fixtures/documents/doctored-01/` - they test the pipeline against it.
- You call CP2 at H8. If a doctored payslip hasn't produced a real finding from a real extraction, you announce the degradation rung. Nobody else has the whole picture.
- You run the rehearsals from H13. Three of them.
