# FRONTEND.md

## PART 0 — Shared

### The situation
You own every pixel and the six screens in the demo.
Open `recheq-screens.svg` in a browser now. That is your spec — build it, don't design it.
Binding artifact: `contract/openapi.yaml`. You do not touch `services/api/**`, `lib/server/**`, fixtures, or the model provider.

> Identical in `BACKEND.md`, `FRONTEND.md`, `PLATFORM.md`. If you change anything here, change it in all three and announce it.

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

```text
status      draft | awaiting_consent | awaiting_documents | processing | complete | withdrawn
verdict     verified | verified_with_notes | needs_review | insufficient_evidence  <- no "rejected"
severity    high | medium | low
doc_kind    payslip | form_16
score       min(100, 40*high + 15*medium + 5*low)   <- hand-computable on purpose
```

**Rule IDs** — canonical kebab-case from `packages/rules/src/checks/`. `CHK-*` does not exist; delete it wherever found.

```text
payslip-arithmetic        payslip-arithmetic-gross  payslip-arithmetic-net
pf-implies-basic          pf-matches-epfo           dual-employment
dates-within-epfo-period  form16-reconciles-payslip employer-name-match
identity-consistent       ctc-plausible             epfo-gap-analysis
forensics-metadata        forensics-font-anomalies  forensics-monetary-anomalies
```

### Error handling

Branch on HTTP status, not on `error.code`. `services/api/src/http/errors.ts` emits seven generic codes today — `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `GONE`, `VALIDATION_ERROR`, `INTERNAL_ERROR`. Everything else is a refinement. Status is guaranteed; code is a bonus. Always have a default branch.

```json
{ 
  "error": { 
    "code": "VALIDATION_ERROR", 
    "message": "Some fields need attention.",
    "details": { "fields": [{ "path": "uan", "message": "UAN must be 12 digits." }] },
    "request_id": "req_01HZYD" 
  } 
}
```

Full catalogue — 21 codes, 62 documented responses — in `contract/openapi.yaml`.

### Environment

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tieout
APP_BASE_URL=http://localhost:3000        # ABSENT from .env.example - add it
DEV_USER_ID=00000000-0000-0000-0000-000000000001
DEV_ORG_ID=00000000-0000-0000-0000-000000000002
```

### Checkpoints - 15 min, all three present, no laptops

| Hour | Question | If no |
| --- | --- | --- |
| CP1 | 4 | Does POST `/api/cases` write a real row? |
| CP2 | 8 | Has a doctored payslip produced a real finding from a real extraction? |
| CP3 | 12 | Does the full chain run clean twice? |

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
| `pnpm --filter @tieout/web build` fails, `WorkerError` | Delete the `webpack:` block (Next 16 uses Turbopack) and the `rewrites()` block (proxies to a server that will never exist); add `turbopack: {}` |
| `lib/api/*` is five in-memory mock files, 29 lines of "mock"/"simulate" | Delete `store.ts`, rewrite the rest to fetch same-origin. Keep every exported name identical so pages don't change. |
| Backend won't exist for 4 hours | Run Prism. You are never blocked. |
| Two style systems: ~25 CSS vars used 11 times vs ~200 raw palette classes (`text-gray-900` x39) | Define tokens once via `@theme`, delete every raw palette class from the six demo screens |
| FE hardcodes `CHK-PAYSLIP-ARITH`; the API emits `pf-implies-basic` | Render whatever string the API returns, through a display map with raw-id fallback |
| `APP_BASE_URL` missing from `.env.example` | Add it |
| `app/page.tsx` says "standalone candidate frontend" - wrong, this app hosts the dashboard | `redirect('/cases')` |
| No app shell, no loading/error boundaries, one bare `<body>` layout | Two route-group layouts, one loading state on `/status`. Nothing more. |

---

## PART 2 — Setup

```bash
corepack enable && corepack prepare pnpm@10.12.4 --activate
cp .env.example .env       # then add APP_BASE_URL
pnpm install
pnpm approve-builds        # approve esbuild, or vitest won't start
pnpm --filter tieout/web dev
```

Never be blocked - start this the moment FE-1 lands and leave it running:

```bash
npx @stoplight/prism-cli mock contract/openapi.yaml --port 4010 --errors
```

Set `API_BASE_URL=http://localhost:4010`. Every screen builds against realistic data before the backend exists.
`--errors` makes Prism reject requests that violate the contract, so you're validated before backend is written. Flip to same-origin at H8.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build: Call retries were exceeded `{ type: 'WorkerError' }` | FE-1 - the `webpack:` block |
| `pnpm install` warns "Ignored build scripts: esbuild" | `pnpm approve-builds && pnpm rebuild esbuild` |
| Candidate link opens blank or wrong | `APP_BASE_URL` unset. Then `grep -rn "localhost:3000" apps/web/src` - should appear only in `.env` |
| Form silently does nothing, log says Invalid Server Actions request | Only happens behind a tunnel. On plain localhost it never occurs - which is why we stay on localhost. |
| Port 3000 in use | `lsof -ti:3000` |

---

## PART 3 — Tasks

Feed one at a time to your agent. Prefix every prompt:

> Recheq monorepo: pnpm workspaces, TypeScript, Next 16 App Router, Tailwind v4, Zod, Vitest. Hackathon sprint, hours remaining. Implement ONLY the task below. Inspect existing files first. Prefer the smallest change that works. Do not refactor adjacent code. Do not add abstractions. Run the acceptance command and paste the output.

| Hours | Task |
| --- | --- |
| 0-1 | **FE-1** build fix, env, landing redirect |
| 1-3 | **FE-2** tokens and shell |
| 3-5 | **FE-3** screens 1 and 2 |
| 4 | **CP1** |
| 5-8 | **FE-4** the ledger, screen 6 |
| 8 | **CP2** - flip off Prism |
| 8-11 | **FE-5** screens 3, 4, 5 |
| 11-12 | **FE-6** kill the mocks |
| 12-13 | Polish the two pitch screens |

### FE-1 · Build fix, env, landing — 1 h, blocks everything

**Files:** `apps/web/next.config.ts` · `package.json` · `src/app/page.tsx` · `src/app/globals.tmp.css` (delete) · `tailwind.config.ts` (delete) · `.env.example`

`pnpm --filter @tieout/web build` fails with "Error: Call retries were exceeded { type: 'WorkerError' }".

1. In `next.config.ts`:
* delete the entire `webpack:` block - Next 16 defaults to Turbopack and this kills the build worker
* delete the `rewrites()` block - it proxies `/api/*` to `localhost:4000`, a server that will never exist. We serve the API from Next itself.
* keep `transpilePackages`
* add: `turbopack: {}`
* add: `serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist']`

2. Change the dev script from `next dev --webpack` to `next dev`.
3. Delete `src/app/globals.tmp.css` (223 lines, never imported).
4. Delete `tailwind.config.ts` (Tailwind v4 ignores it; theme goes in `@theme`).
5. Add `APP_BASE_URL=http://localhost:3000` to `.env` and `.env.example`. It does not currently exist anywhere, which is why candidate links would be unopenable.
6. `src/app/page.tsx` says "This is the standalone candidate frontend. You should access this application via your unique candidate link." Wrong - this app hosts the verifier dashboard too. Replace the whole component with `redirect('/cases')`.

**Accept:** `pnpm --filter @tieout/web build` exits 0 · `curl -sI localhost:3000 | head -1` → `307` to `/cases`

### FE-2 · Tokens and shell — 2 h, no backend dependency

**Files:** `src/app/globals.css` · `src/app/(dashboard)/layout.tsx` · `src/app/c/[token]/layout.tsx` · `src/app/c/[token]/status/loading.tsx` (new)

Two competing systems: ~25 CSS custom properties in `globals.css` used 11 times, versus ~200 raw Tailwind palette classes (`text-gray-900` x39, `text-gray-500` x20, `border-gray-300` x14). Pick the tokens.

1. Rewrite `globals.css` using Tailwind v4's `@theme` so tokens become real utilities. Match `recheq-screens.svg` exactly:
```css
--color-page: #FAF9F5
--color-surface: #FFFFFF
--color-border: #E2E0D8
--color-fg: #1F1E1C
--color-fg-muted: #6B6A65
--color-fg-subtle: #9A9892
--color-accent: #2C6ECB
--color-accent-bg: #E8F0FB
--color-high: #C0392B
--color-high-bg: #FDECEA
--color-medium: #B8730A
--color-medium-bg: #FBF0DC
--color-ok: #1D7A55
--color-ok-bg: #E3F3EC
--radius-card: 12px
--radius-control: 8px
```

2. `(dashboard)/layout.tsx`: top nav - "Recheq" wordmark, Cases, Settings, avatar - over a `max-w-7xl` container. Exactly as in the SVG.
3. `c/[token]/layout.tsx`: no nav, `max-w-md` centred column, page background.
4. One `loading.tsx` on the status route. Nothing else.

Delete every raw palette class from the six demo screens. No page declares its own `max-w-*` wrapper.

**Accept:** `grep -rE "(text|bg|border)-(gray|blue|red|green|yellow|slate|zinc)-[0-9]" apps/web/src/app apps/web/src/components` → nothing

### FE-3 · Screens 1 and 2 — 2 h

**Files:** `(dashboard)/cases/page.tsx` · `cases/new/page.tsx` · `components/dashboard/*`

Build screens 1 and 2 exactly as in `recheq-screens.svg` (top row). Shapes: the `CaseSummary` and `CaseCreateInput` schemas in `contract/openapi.yaml`. Point at Prism on `:4010`.

**Screen 1 - `/cases`:**
Title "Cases", primary "+ New case" right-aligned. Table: CANDIDATE, EMPLOYER, STATUS, VERDICT. Status and verdict as pill badges from the tokens - complete=neutral, processing=accent, needs review=medium, verified=ok.
No filters, no search, no pagination.
Empty state: "No cases yet" plus the CTA. An empty list is not an error.

**Screen 2 - `/cases/new`:**
Two-column form. On submit POST `/api/cases` and render the success panel in the SVG: green tint, "Case created - candidate link", URL in mono, Copy button.
Do NOT navigate away - the demo needs the link visible on the same screen.
Build the link from the `candidate_link` field the API returns. Never construct it in the frontend.
On 422, map `details.fields[]` onto inputs by `path`. Preserve entered values.

`createCase` is a Server Action (`'use server'` in `lib/api/actions.ts`). Keep it one - on same-origin localhost it works fine. Do not convert it.

**Accept:** both screens match the SVG against Prism; the create form shows a copyable link on the same page; a 422 renders inline field errors without clearing the form.

### FE-4 · Screen 6, the ledger — 3 h, the screen the pitch lands on

**Files:** `(dashboard)/cases/[id]/page.tsx` · `components/ledger/*` · `src/lib/rule-display.ts` (new)

Build screen 6 exactly as in `recheq-screens.svg` (bottom, full width). Shape: the `CaseDetail` schema in `contract/openapi.yaml`.

Top to bottom:

* back link + case id in mono 10px muted
* candidate name 22px, verdict badge right-aligned
* "Senior Analyst at Acme Technologies Pvt Ltd" 13px muted
* four stat tiles: Risk score - with "40x2 high + 0 med" in mono beside the number, the arithmetic must be VISIBLE, that is the auditability claim - High severity, Medium severity, Independent sources
* evidence chips from `origins`: green when present, neutral "Employer pending" when absent
* "Discrepancy ledger" heading
* `FindingCards`
* not-assessed strip

**FindingCard:**

* severity badge left, `rule_id` in mono 10px muted FAR RIGHT. Never hide the `rule_id`.
* title 14px, explanation 12px muted
* EXPECTED / OBSERVED as small-caps labels with mono values side by side; observed tinted with the severity colour
* `source_label` as an accent link on the right. The API supplies this string - never render a raw uuid.
* border colour is the severity colour

Not-assessed is a flat strip with a muted mono list. NEVER styled like a finding. Absence of evidence must not look like evidence.

`lib/rule-display.ts` maps `rule_id` -> friendly title, covering all 15 ids listed in PART 0. Fall back to the raw `rule_id` for anything unmapped so a new rule can never render blank. Delete every `CHK-*` string from `apps/web`.

Render findings in API order - it already sorts by severity then `rule_id`. Do not re-sort.

**Accept:** `grep -rn "CHK-" apps/web` → nothing. Screen matches the SVG. An unmapped `rule_id` renders the raw id, not blank. Not-assessed is visually distinct from findings.

### FE-5 · Screens 3, 4, 5 — the public journey — 3 h

**Files:** `c/[token]/page.tsx` · `upload/page.tsx` · `status/page.tsx` · `components/candidate/*`

Build screens 3, 4, 5 exactly as in `recheq-screens.svg` (middle row). These are a narrow `max-w-md` centred column in the same web app - no separate mobile treatment, no device switching. Shapes: `PublicCaseContext` and `StatusResponse` in `contract/openapi.yaml`.

**Screen 3 - consent, `/c/[token]`:**

* "Acme Corp has asked us to verify your employment at Acme Technologies."
* "What we'll collect": payslip, Form 16, EPFO contribution history via your UAN
* divider, then:
* Why: Employment verification only
* Kept: 180 days, then deleted
* Where: India; documents are read by an AI model hosted outside India
* Rights: Withdraw anytime

* dark "I consent" button, muted "Decline" below.

THREE HARD RULES:

1. No upload control on this screen. Consent must be standalone, not bundled.
2. All of it fits without scrolling in the `max-w-md` column. If it scrolls, cut words, never disclosures.
3. The "Where" row stays. Documents genuinely leave India for the model call. Disclosing it is the differentiator; hiding it is the actual risk.

404 and 410 get DIFFERENT copy: "This link isn't valid" (no retry offered) versus "This link has expired - ask your recruiter for a new one".

**Screen 4 - upload, `/c/[token]/upload`:**

* One card per document, four visually distinct states: empty (dashed border), uploading (progress), uploaded (solid green, filename in mono), failed (red, retry).
* UAN field below, optional.
* Submit disabled with "Both documents needed" until both are uploaded.
* 413 and 415 render INLINE ON THAT CARD ONLY - never reset the other card's state.
* A 200 response (duplicate sha256) is success, not an error.

**Screen 5 - status, `/c/[token]/status`:**

* Poll `GET /api/public/:token/status` every 2s. Render the `steps` array verbatim - done (green check), active (accent), pending (grey). NAMED STEPS, NEVER A BARE SPINNER. The named steps make the wait read as work happening, and they advertise the architecture while a judge watches.
* "Usually under 90 seconds. Keep this page open."
* Redirect to a thank-you state on complete. If the response carries `error`, show it as a degraded note - the case still completes.
* Do NOT promise an email. Email is not wired.

**HARD CONSTRAINT** on all three: never render `risk_score`, `verdict`, or a `finding`.

**Accept:** all three match the SVG; devtools on each shows no verdict, `risk_score`, or findings key in any response.

### FE-6 · Kill the mocks — 1 h, after CP2

**Files:** `lib/api/store.ts` (delete) · `client.ts` (new) · `cases.ts` · `candidate.ts` · `actions.ts` · `employer.ts`

1. Delete `store.ts`.
2. `client.ts`: a small fetch wrapper hitting same-origin `/api/**`, parsing the `{ error: { code, message, details, request_id } }` envelope and throwing a typed `ApiError` carrying status, code, details.
3. Rewrite `cases.ts`, `candidate.ts`, `actions.ts` to call real routes. Keep every exported function name and signature identical so pages do not change.
4. Validate responses with the Zod schemas from `@tieout/schema` before returning.
5. Leave `employer.ts` on mocks - the employer flow is cut. Mark it `// DEMO: not wired, employer path cut`.
6. Update `apps/web/tests/*` to stub fetch instead of the deleted store.

**Accept:** `grep -rn "mockCases\|mockState" apps/web/src` → nothing. Create a case in the browser, restart `pnpm dev`, the case is still there.

---

## PART 4 — Your test checklist

### UI states — every screen, every state:

| Screen | Loading | Success | Empty | Validation error | Server error |
| --- | --- | --- | --- | --- | --- |
| `/cases` | skeleton rows | table | "No cases yet" + CTA | - | banner + retry |
| `/cases/new` | button spinner | link panel with Copy | - | inline per field from `details.fields[]` | banner, form preserved |
| `/cases/[id]` | skeleton | ledger | "No findings" ≠ "not assessed" | - | banner + retry |
| `/c/[token]` | skeleton | consent form | - | - | 404 vs 410, different copy |
| `/c/[token]/upload` | per-card progress | green card + filename | both empty, submit disabled | inline on that card only | retry on that card, other card keeps state |
| `/c/[token]/status` | named steps | redirect on complete | - | - | degraded note, still completes |

Force each against Prism by sending a shape the contract rejects, or `docker compose stop postgres`.

### Compliance:

```bash
grep -rn "CHK-" apps/web                                                              # nothing
grep -rn "mockCases\|mockState" apps/web/src                                          # nothing after FE-6
grep -rE "(text|bg|border)-(gray|blue|red|green|yellow)-[0-9]" apps/web/src/app apps/web/src/components
```

**Before freeze:** open devtools on each of the three public screens. No verdict, `risk_score`, or findings in any response. This is the worst bug we can ship.

**Your acceptance:** all six screens match the SVG, run against the real API with no mocks, and the full chain in PART 5 completes without a blank screen or an unhandled error at any step.

---

## PART 5 — The end-to-end script

Platform runs this every 30 min from H10, but you should run it yourself after FE-6.

| # | Step | Pass |
| --- | --- | --- |
| 1 | Open `localhost:3000` | Redirects to `/cases` |
| 2 | Case list | Seeded cases with status and verdict badges |
| 3 | + New case, fill, submit | Link panel appears on the same page |
| 4 | Paste the link in a new tab | Consent screen, no scrolling |
| 5 | Read the copy | "Where" row present |
| 6 | Grant consent | Redirects to upload |
| 7 | Upload doctored payslip + Form 16 | Both cards green, filenames shown |
| 8 | Enter UAN, submit | Status screen, named steps advancing |
| 9 | Watch to completion | complete inside 90 s |
| 10 | Open the case in the dashboard | `needs_review`, score 80 |
| 11 | Read the ledger | ≥2 high findings, each with rule id, expected, observed, source label |
| 12 | Not-assessed | Quiet strip, visually distinct |
| 13 | Devtools on the candidate tab | No verdict / score / findings |
| 14 | Restart `pnpm dev`, reload | The case is still there |

---

## PART 6 — Handoffs

* From BE at H1: `/api/cases` is live - flip that one route off Prism.
* From BE at H8: confirm `GET /api/cases/:id` returns `not_assessed` and `source_label`. You render both - if they're missing, tell them immediately.
* To Platform at H11: hand over for the dry run. They own end-to-end timing, not you.
