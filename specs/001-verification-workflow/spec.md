# Spec: Verification Workflow Model

> Source of truth for the step engine (SDD loop: Specify → Plan → Tasks → Implement).
> Requirements are EARS statements copied verbatim from RCQ-20101 (KAN-15).
> Conformance review: [conformance.md](./conformance.md) (RCQ-20125).

## 1. Purpose

The verification workflow turns a submitted case into a verdict by executing
discrete verification steps on a DAG. The engine — not any individual check —
owns scheduling, state, failure semantics and provenance.

References to constitution principles use the section numbers of
[docs/CONSTITUTION.md](../../docs/CONSTITUTION.md) (§1 Core Engineering
Philosophy, §2 Monorepo Boundaries, §3 Security Mandates, §4 Testing).

## 2. Requirements (EARS, verbatim)

### Ubiquitous

- **R1.1** - The engine shall represent every check as a discrete step with a stable id, a declared input set and a declared output artifact.
- **R1.2** - The engine shall persist per-step status, timing and evidence reference for every step of every case.
- **R1.3** - The engine shall be able to compute a verdict from any subset of completed steps.
- **R1.15** - The engine shall record, for every step, which provider and which model version produced its artifact.

### Event-driven

- **R1.4** - When a case is submitted, the engine shall resolve the step graph, schedule all steps whose dependencies are satisfied, and set case status to processing.
- **R1.5** - When a step completes, the engine shall persist its result and schedule any step whose dependencies are now satisfied.
- **R1.6** - When all fast steps reach a terminal state, the engine shall compute an interim verdict without waiting for slow steps.

### State-driven

- **R1.7** - While any step is running, the engine shall report case status as processing.
- **R1.8** - While a slow step is awaiting_external, the engine shall keep the case usable with an interim verdict rather than blocking.

### Unwanted behaviour

- **R1.9** - If a step's required input is unavailable, then the engine shall mark that step not_assessed and continue with remaining steps.
- **R1.10** - If a step throws, then the engine shall mark it failed, record the reason, and continue with steps that do not depend on it.
- **R1.11** - If a step exceeds its declared timeout, then the engine shall mark it timed_out and treat it as not_assessed for verdict purposes.
- **R1.12** - If every step fails or is not_assessed, then the engine shall set the verdict to insufficient_evidence and shall not set status to failed.
- **R1.13** - If a step is retried, then the engine shall not duplicate its findings or its audit events.
- **R1.16** - If a step's declared data source is unavailable or its licence has lapsed, then the engine shall mark it not_assessed and shall not fall back to any undeclared source.

### Optional feature

- **R1.14** - Where a step is declared slow, the engine shall exclude it from the interim verdict and schedule it independently of the fast path.

R1.15 and R1.16 are the diligence requirements: R1.15 makes provenance
queryable per finding; R1.16 makes P9 (declared-sources-only) enforceable in
code rather than in policy.

## 3. Step lifecycle state machine

States (`packages/workflow/src/types.ts`): `pending`, `running`, `succeeded`,
`failed`, `timed_out`, `not_assessed`, `awaiting_external`.

```text
            ┌───────────┐ requires()=false / dep blocked / null artifact
            │  pending  │──────────────────────────────────────────► not_assessed
            └─────┬─────◄────────────── retry (new engine run)
                  │ deps satisfied & scheduled
                  ▼
            ┌───────────┐  run() resolves   ┌───────────┐
            │  running  │──────────────────►│ succeeded │ (null artifact ⇒ not_assessed)
            └─────┬─────┘                   └───────────┘
                  │ run() throws        ┌──────────┐
                  ├────────────────────►│  failed  │
                  │ deadline exceeded   └──────────┘
                  ├────────────────────►┌───────────┐
                  │                     │ timed_out │  (≡ not_assessed for verdict)
                  ├────────────────────►├───────────┤
                  │ provider pending    │awaiting_external
                  ▼                     └───────────┘
            (terminal states are final within one run; retries start fresh runs)
```

Enumerated legal transitions:

| From            | To                  | Trigger                                                            |
| --------------- | ------------------- | ------------------------------------------------------------------ |
| `pending`       | `running`           | dependencies satisfied, `requires(ctx)` true                       |
| `pending`       | `not_assessed`      | `requires(ctx)` false, or upstream dependency failed               |
| `running`       | `succeeded`         | `run()` resolved with non-null artifact                            |
| `running`       | `not_assessed`      | `run()` resolved `succeeded` with null artifact                    |
| `running`       | `failed`            | `run()` threw (non-recoverable), or undeclared provenance returned |
| `running`       | `timed_out`         | declared `timeoutMs` exceeded                                      |
| `running`       | `awaiting_external` | `run()` resolved with that state (external actor)                  |
| terminal states | (none)              | re-entry only via a new engine run (retry/reprocess)               |

Illegal at load time (engine refuses to construct): duplicate ids, unknown
dependency references, cycles (mutual dependency), fast→slow edges.

## 4. Step catalogue

The original plan envisioned a nine-step catalogue. During build the design
consolidated to four engine steps (design change D2 below); the four contract
step ids surfaced to candidates remain unchanged.

| Engine id           | Contract id(s)      | Speed | Timeout | DependsOn                                      | Declared dataSource        |
| ------------------- | ------------------- | ----- | ------- | ---------------------------------------------- | -------------------------- |
| `doc.extract`       | `payslip`, `form16` | fast  | 60 s    | —                                              | `derived`, licence `none`  |
| `doc.forensics`     | `payslip`, `form16` | fast  | 30 s    | —                                              | `derived`, licence `none`  |
| `epfo.history`      | `epfo`              | fast  | 45 s    | —                                              | `epfo:signzy`, `consented` |
| `rules.triangulate` | `rules`             | fast  | 15 s    | `doc.extract`, `doc.forensics`, `epfo.history` | `derived`, licence `none`  |

All production steps currently declare `fast`; the slow-path mechanics
(R1.14) ship in the engine and are exercised by tests. The provenance register
(`epfo:signzy`, `mca:data.gov.in`, `derived`) is closed; declaring an
unregistered source fails construction.

## 5. Verdict computation

- The interim verdict is computed over terminal states of fast steps only (R1.6, R1.14).
- `timed_out` is treated exactly like `not_assessed` for verdict purposes (R1.11).
- Verdict matrix:

| Usable evidence (succeeded / awaiting_external) | Any fast step failed? | Interim verdict                 |
| ----------------------------------------------- | --------------------- | ------------------------------- |
| 0                                               | any                   | `insufficient_evidence` (R1.12) |
| ≥ 1                                             | no                    | `verified`                      |
| ≥ 1                                             | yes                   | `verified_with_notes`           |

- The engine never sets case status to `failed` (R1.12); the orchestrator
  commits `complete` with the computed verdict.
- Final verdict authority is `rules.triangulate` (deterministic rules,
  constitution §1/§2); the engine matrix above governs runs where triangulation
  itself did not produce an artifact.

## 6. Edge cases (explicit answers)

| Edge case                                          | Answer                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Mutual dependency                                  | detected at construction; engine refuses to start                                                              |
| Step succeeds with empty artifact                  | coerced to `not_assessed`                                                                                      |
| Case reprocessed after a rule change               | open findings replaced wholesale in one transaction                                                            |
| Slow step replies after `complete`                 | outcome surfaced once via `onSlowStepSettled`; audit event written by the observer; committed status unchanged |
| Two steps declare the same output artifact         | duplicate step ids rejected at construction                                                                    |
| Undeclared data source                             | construction-time rejection; result-level undeclared provenance marks the step `failed` with an alert          |
| Transient provider outage (rate limit/unavailable) | step raises `RecoverableWorkflowError`; the job is retried instead of failing the step                         |

## 7. Design changes during build (legitimate, recorded)

- **D1 — Input declaration via dependency graph.** R1.1's "declared input set"
  is realised as `dependsOn` plus typed artifacts (`StepResult<TOut>`); the
  optional typed input slot (`TIn` via `ctx.input`) exists but the engine does
  not populate it in v1.
- **D2 — Four consolidated engine steps.** The nine-step catalogue collapsed
  into four steps whose artifacts map onto the four contract step ids
  (`payslip`, `form16`, `epfo`, `rules`) exposed by the API contract.
- **D3 — Per-step status derived, not stored.** Per-step status/timing/
  evidence for the public and ops views are projected at read time from
  persisted domain rows (extractions, forensics, epfo records, findings) by
  `services/api/src/workflows/step-projection.ts`. Engine-level
  `StepResult` records are not durably persisted; residual gap deferred to
  Phase 2 ([KAN-66]).
- **D4 — Case processing runs in-process** from the submit route rather than
  through pg-boss (platform decision). pg-boss remains only for employer /
  retention / webhook jobs.

## 8. Deferred requirements

| Requirement                                                 | Disposition         | Ticket |
| ----------------------------------------------------------- | ------------------- | ------ |
| R1.2 (residual: durable engine step records)                | deferred to Phase 2 | KAN-66 |
| R1.16 (residual: licence-lapse detection before scheduling) | deferred to Phase 2 | KAN-66 |

[KAN-66]: https://annylive007.atlassian.net/browse/KAN-66
