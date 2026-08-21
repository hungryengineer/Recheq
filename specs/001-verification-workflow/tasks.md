# Task Breakdown: Verification Workflow

## Tasks (≤ 2-hour units, testable & TDD-driven)

### Task 1: Step Interfaces and Contract Definitions
**Time estimate:** 1 hr
**Implementation:**
- Set up `packages/workflow` workspace.
- Write unit tests verifying that objects implementing `VerificationStep` are type-safe and export pure `requires()` methods.
- Implement the types (`VerificationStep`, `StepState`, `StepResult`) ensuring `provenance` and `dataSource` fields are required.
- **Traceability:** R1.1, R1.15, R1.16

### Task 2: Engine DAG Resolution and Happy Path Execution
**Time estimate:** 2 hrs
**Implementation:**
- Write test: Fake graph resolves dependencies correctly and schedules independent steps concurrently (max 4).
- Write test: Case submission shifts case status to `processing`.
- Write test: Idempotency blocks duplicate findings and audit events.
- Implement the core step scheduler logic in `engine.ts` using `Promise.all` bounds.
- **Traceability:** R1.4, R1.7, R1.13

### Task 3: Error Handling, Timeouts, and Missing Inputs
**Time estimate:** 2 hrs
**Implementation:**
- Write test: Thrown exception leads to `failed` and isolates from unrelated steps.
- Write test: Timeout via `AbortController` triggers `timed_out` state.
- Write test: Missing inputs (via `requires()` returning false) transition step to `not_assessed`.
- Write test: Step dependency failure cascades `not_assessed` downstream.
- Write test: Undeclared data source halts execution.
- Implement these mechanisms inside the engine execution loop.
- **Traceability:** R1.9, R1.10, R1.11, R1.16

### Task 4: Verdict Computation and Fast/Slow Path Separation
**Time estimate:** 2 hrs
**Implementation:**
- Write test: Engine computes an interim verdict as soon as fast steps terminate, ignoring slow ones.
- Write test: All steps failing or being `not_assessed` results in `insufficient_evidence` without marking the case as `failed`.
- Write test: A step entering `awaiting_external` doesn't block the interim verdict.
- Implement the logic extracting `fast` vs `slow` steps and trigger verdict calculations accordingly.
- **Traceability:** R1.3, R1.6, R1.8, R1.12, R1.14

### Task 5: Database Persistence Layer (`case_steps`)
**Time estimate:** 1.5 hrs
**Implementation:**
- Write migration `0004_create_case_steps.sql`.
- Write repository test mocking state insertions and verifying single-transaction writes with audit chains.
- Implement persistence hook: when a step transitions, write `case_steps` array.
- **Traceability:** R1.2, R1.5

---

## Traceability Table

| Requirement | Description | Task |
|---|---|---|
| R1.1 | Discrete step representation with declared inputs/outputs | Task 1 |
| R1.2 | Persist per-step status, timing, and evidence | Task 5 |
| R1.3 | Compute verdict from subset of steps | Task 4 |
| R1.4 | Resolve step graph and schedule satisfied steps | Task 2 |
| R1.5 | Persist step result and schedule unblocked steps | Task 5 |
| R1.6 | Interim verdict after fast steps | Task 4 |
| R1.7 | Report case status as processing while running | Task 2 |
| R1.8 | Non-blocking slow steps keeping case usable | Task 4 |
| R1.9 | Missing inputs yield `not_assessed` | Task 3 |
| R1.10 | Step failure isolated, yields `failed` | Task 3 |
| R1.11 | Step timeout yields `timed_out` | Task 3 |
| R1.12 | Complete failure yields `insufficient_evidence` | Task 4 |
| R1.13 | Idempotent retries (no duplicate findings) | Task 2 |
| R1.14 | Slow steps excluded from interim verdict | Task 4 |
| R1.15 | Step provenance tracking (provider/model) | Task 1 |
| R1.16 | Data source declaration enforcement | Task 1, Task 3 |
