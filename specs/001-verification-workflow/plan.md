# Implementation Plan: Verification Workflow

## New Files Created

- `packages/workflow/package.json` - Initialize the new workflow package as an independent workspace.
- `packages/workflow/src/types.ts` - Define the `VerificationStep`, `StepResult`, and `StepState` contracts.
- `packages/workflow/src/engine.ts` - Implement the DAG execution, concurrent scheduling, and error handling logic.
- `packages/workflow/tests/engine.test.ts` - Test suite for the engine using fake steps and zero external dependencies (TDD).
- `services/api/src/repositories/case_steps.ts` - Persistence layer for tracking individual step states.
- `db/migrations/0004_create_case_steps.sql` - Schema migration for the `case_steps` table.

## Existing Files Modified

- `services/api/src/workflows/case-processing.ts` - Refactored to construct the context and delegate execution to `engine.run()`.
- `services/api/src/api/routes/cases.ts` - API contract updated to return `steps[]` with `state`, `reason`, and `provenance`.
- `contract/openapi.yaml` - Document the updated response schemas and three previously undocumented routes.

## Existing Code Deleted

- **Deleted:** The hardcoded, imperative 162-line sequence in `services/api/src/workflows/case-processing.ts`. All existing fixed-step invocations and tight couplings will be removed and replaced by discrete classes implementing `VerificationStep`.
