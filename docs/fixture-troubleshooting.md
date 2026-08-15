# Fixture Validation Troubleshooting Guide

## Overview

The Tieout fixture suite validates the document extraction system against 10 pre-defined test cases (3 clean payslips, 2 doctored payslips, 3 clean Form 16s, 2 doctored Form 16s). This guide helps debug fixture failures in local development and CI.

---

## Quick Start

### Run Fixtures Locally

```bash
# Run all 10 fixture validations
pnpm fixtures

# With verbose output
pnpm fixtures 2>&1 | tee fixture-output.log
```

### Run via CI Script

```bash
# Wrapper with color output and CI detection
bash scripts/ci-fixtures.sh
```

---

## Common Failure Scenarios

### 1. **"No fixture found for [document-id]"**

**Cause**: A fixture file is missing or the document ID in the fixture doesn't match.

**Solution**:

- Check that all 10 fixture files exist:

  ```bash
  ls -la fixtures/extraction/
  ```

  Should show:
  - `payslip-clean-01.json`, `payslip-clean-02.json`, `payslip-clean-03.json`
  - `payslip-doctored-01.json`, `payslip-doctored-02.json`
  - `form16-clean-01.json`, `form16-clean-02.json`, `form16-clean-03.json`
  - `form16-doctored-01.json`, `form16-doctored-02.json`

- Verify each fixture file is valid JSON:
  ```bash
  for f in fixtures/extraction/*.json; do
    echo "Checking $f..."
    node -e "JSON.parse(require('fs').readFileSync('$f'))"
  done
  ```

### 2. **"Expected X findings, got Y"**

**Cause**: Extraction logic or rules engine changed, affecting the number of findings.

**Solution**:

1. Identify which fixture failed and why:

   ```bash
   pnpm fixtures 2>&1 | grep -A5 "Expected"
   ```

2. Check if the extraction logic recently changed:

   ```bash
   git diff services/api/src/extraction/
   git diff packages/rules/
   ```

3. If the change is intentional, update the fixture's expected output:
   - Edit `fixtures/extraction/[fixture-name].json`
   - Update the `_expected` field with the new finding count/verdicts
   - Re-run `pnpm fixtures` to verify

### 3. **"Verdict mismatch: expected PASS, got FLAGGED"**

**Cause**: A new finding was raised that changes the verdict, or a finding threshold changed.

**Solution**:

1. Determine which finding caused the change:

   ```bash
   pnpm fixtures 2>&1 | grep -B10 "Verdict mismatch"
   ```

2. Review the rules that fired:
   - Check `packages/rules/src/checks/` for recently modified rules
   - Look for new severity levels or status changes

3. Decide:
   - **If the new verdict is correct**: Update the fixture's `_expected.verdict`
   - **If the new verdict is wrong**: The rules engine may have a bug; investigate

4. Update the fixture:
   ```json
   {
     "_fixture": "payslip-clean-01",
     "_description": "Clean payslip with all required fields",
     "_expected": {
       "finding_count": 0,
       "verdict": "PASS"
     }
     // ... rest of extraction data ...
   }
   ```

### 4. **"Score mismatch: expected 10, got 15"**

**Cause**: Risk scoring changed due to finding weight updates.

**Solution**:

1. Review recent changes to `packages/rules/src/score.ts`:

   ```bash
   git log -p packages/rules/src/score.ts | head -100
   ```

2. Determine if the new score is correct:
   - Recalculate manually or review the scoring logic
   - Update fixture if intentional, or revert if unintended

3. Update the fixture:
   ```json
   {
     "_expected": {
       "finding_count": 0,
       "score": 15,
       "verdict": "PASS"
     }
   }
   ```

### 5. **"Extraction failed: JSON validation error"**

**Cause**: Extracted data doesn't match the Zod schema.

**Solution**:

1. Check the fixture JSON schema validity:

   ```bash
   npx tsc --noEmit packages/schema/src/payslip.ts
   npx tsc --noEmit packages/schema/src/form16.ts
   ```

2. Validate fixture against schema:

   ```bash
   node --experimental-strip-types << 'EOF'
   import { PayslipExtractionV1 } from './packages/schema/src/payslip.js';
   import fs from 'fs';
   const data = JSON.parse(fs.readFileSync('./fixtures/extraction/payslip-clean-01.json'));
   const result = PayslipExtractionV1.safeParse(data);
   if (!result.success) console.error(result.error.issues);
   else console.log('✓ Valid');
   EOF
   ```

3. Fix the fixture JSON to match the schema

### 6. **"Cannot find module '@tieout/test-fixtures'"**

**Cause**: Dependencies not installed or test-fixtures package not built.

**Solution**:

```bash
# Install all dependencies
pnpm install

# Build the test-fixtures package
pnpm build

# Try fixtures again
pnpm fixtures
```

### 7. **"ENOENT: no such file or directory, open 'fixtures/...'"**

**Cause**: Running `pnpm fixtures` from wrong directory.

**Solution**:

```bash
# Always run from project root
cd /path/to/Recheq
pnpm fixtures

# Or use absolute paths
node --experimental-strip-types scripts/run-fixtures.ts
```

---

## Understanding Fixture Structure

Each fixture JSON has:

```json
{
  "_fixture": "payslip-clean-01",
  "_description": "Clean payslip with all salary components",
  "_expected": {
    "finding_count": 0,
    "score": 0,
    "verdict": "PASS"
  },
  // --- Extraction data ---
  "schema_version": "payslip-v1",
  "employee_name": "John Doe",
  "employer_name": "TechCorp Inc",
  "basic": 50000,
  // ... more fields ...
  "salary_components": [
    { "raw_label": "Basic", "amount": 50000 }
    // ... more components ...
  ]
}
```

**Fields**:

- `_fixture`: Unique identifier for the test case
- `_description`: Human-readable description (for debugging)
- `_expected`: Expected outcomes after rules evaluation:
  - `finding_count`: Expected number of findings
  - `score`: Expected risk score (0–100)
  - `verdict`: Expected verdict (PASS, FLAGGED, FAILED)
- Rest: Actual extracted document data

---

## Modifying Fixtures

### Add a New Finding to Doctored Fixture

If a rule should now catch an issue it previously missed:

1. Update the `_expected` field:

   ```json
   {
     "_expected": {
       "finding_count": 1, // Was 0, now 1
       "score": 25,
       "verdict": "FLAGGED"
     }
   }
   ```

2. Verify the fixture still makes sense:
   ```bash
   pnpm fixtures
   ```

### Update Verdict for All Payslip-Clean Fixtures

If rules changed globally:

```bash
# Find all affected fixtures
grep -l "payslip-clean" fixtures/extraction/*.json

# Edit each one to update _expected.verdict
nano fixtures/extraction/payslip-clean-01.json
```

---

## Debugging Rules Engine

### Check Which Rules Fire for a Fixture

Create a debug script:

```typescript
// debug-fixture.ts
import { loadFixtures } from '@tieout/test-fixtures';
import { runAllChecks } from '@tieout/rules';

const tests = await loadFixtures('./fixtures');
const test = tests.find((t) => t.name.includes('payslip-clean-01'));

if (test) {
  const findings = runAllChecks(test.fixture.context);
  console.log(
    'Findings:',
    findings.map((f) => ({ rule_id: f.rule_id, severity: f.severity, status: f.status })),
  );
}
```

Run it:

```bash
node --experimental-strip-types debug-fixture.ts
```

### Trace Scoring Logic

Edit `packages/rules/src/score.ts` and add logging:

```typescript
export function calculateRiskScore(findings: ScorableFinding[]): number {
  console.log('Input findings:', findings);
  const score = /* calculation */;
  console.log('Calculated score:', score);
  return score;
}
```

Re-run `pnpm fixtures` and check the log.

---

## CI Integration

### Fixture Failures in CI

1. **Check the CI log**: GitHub Actions → [Workflow] → build-artifacts → Fixture Validation
2. **Reproduce locally**: Pull the branch and run `pnpm fixtures`
3. **Fix locally**: Update fixtures or code, commit, push
4. **CI should pass**: The fixture gate will re-run automatically

### Bypass Fixture Gate (Not Recommended)

If a fixture failure is a known issue:

```yaml
# In .github/workflows/ci.yml
- name: 🧩 Fixture Validation (OPS-05 Gate)
  if: ${{ false }} # Temporarily disable
  run: bash scripts/ci-fixtures.sh
```

**Always** enable it again before merging to master.

---

## Adding New Fixtures

When adding a new extraction type (e.g., `bank-statement`):

1. Create schema: `packages/schema/src/bank-statement.ts`
2. Create fixture files: `fixtures/extraction/bank-statement-*.json`
3. Add load logic to `@tieout/test-fixtures` (in the loadFixtures function)
4. Create rules in `packages/rules/src/checks/`
5. Run `pnpm fixtures` to validate

---

## Performance Tips

- **Fast fixture check** (no full rules run):

  ```bash
  node --experimental-strip-types << 'EOF'
  import { loadFixtures } from '@tieout/test-fixtures';
  const tests = await loadFixtures('./fixtures');
  console.log(`Loaded ${tests.length} fixtures`);
  EOF
  ```

- **Profile rules engine**:

  ```bash
  time pnpm fixtures
  ```

- **Run single fixture** (modify script temporarily):
  ```typescript
  // In run-fixtures.ts, filter by name
  for (const test of tests.filter((t) => t.name.includes('payslip-clean-01'))) {
    // ...
  }
  ```

---

## References

- **Fixture Files**: `fixtures/extraction/`
- **Fixture Loader**: `packages/test-fixtures/src/loader.ts`
- **Fixture Runner**: `scripts/run-fixtures.ts`
- **Fixture CI Gate**: `.github/workflows/ci.yml` (build-artifacts stage)
- **Rules Engine**: `packages/rules/src/`
- **Schema Definitions**: `packages/schema/src/`
