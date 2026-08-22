# Reliability

Measured answers to the diligence questions "does this actually work, and
how do you know?" Every number below states its sample size. A percentage
without an `n` is not evidence.

## Precision and recall over a labelled corpus

**Precision is reported before recall, deliberately.** A false positive —
flagging an honest payslip as doctored — damages a real person's job
prospects. A missed catch costs us money. Both matter, but they are not
symmetrical, so we watch precision first.

The numbers below are produced by running our deterministic rules engine
over a labelled corpus of **n=20 documents (10 clean / 10 doctored)**,
where every doctored document is tampered using one of five methods and
labelled with the rule expected to catch it:

| Method                  | What it simulates                                          | Caught |
| ----------------------- | ---------------------------------------------------------- | ------ |
| amount-alteration       | Basic salary inflated, PF deduction left unchanged         | 2/2    |
| arithmetic-break        | Printed net salary altered; gross and deductions untouched | 2/2    |
| cross-document-mismatch | Form 16 income understated vs the payslip                  | 2/2    |
| font-anomaly-tamper     | Edited glyphs detected by font-run forensics               | 2/2    |
| monetary-region-tamper  | Altered money regions detected by forensic scan            | 2/2    |

- **Precision: 10/10 findings were true tampering = 100%**
  (0 false positives across 10 clean documents)
- **Recall: 10/10 doctored documents caught = 100%**

### Categorised failure modes

Every failure is placed into exactly one of five categories, so trends are
actionable instead of anecdotal:

| Category                   | Meaning                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `extraction-error`         | A document could not be parsed into structured evidence          |
| `rule-tolerance-too-tight` | A rule fired on a clean document (false positive)                |
| `rule-tolerance-too-loose` | A doctored document was not caught                               |
| `missing-evidence`         | A rule could not run because required evidence was absent        |
| `genuine-ambiguity`        | A rule fired correctly but for a different anomaly than declared |

On this corpus there are **0 failures to categorise** — the interesting part
is what the engine could _not_ assess, which we publish rather than hide:
on this run, 11 of the engine's rules emitted `not_assessed` at least once
because the evidence those rules need (EPFO history, forensic scans, paired
documents) was deliberately absent from some cases. The measurement script
prints the exact breakdown.

### Rerunning the numbers

```bash
pnpm measure:reliability            # human-readable report
pnpm measure:reliability -- --json  # machine-readable report
```

CI reruns the measurement on every pull request (Reliability Measurement
stage) with regression floors (`--min-precision`, `--min-recall`), so these
numbers cannot silently go stale as the engine or corpus changes.

## Known limits

Stated plainly, because diligence rewards honesty over polish:

- **Small employers with no PF record.** The strongest arithmetic rule
  (`pf-implies-basic`) cross-checks basic salary against the PF deduction.
  Employers below the statutory threshold pay no PF, so the document gives
  the engine nothing to check against — detection there relies on weaker
  signals only.
- **Scanned documents defeat metadata and font forensics.** Forensic rules
  read PDF internals (producer metadata, font runs, money-region pixels).
  A print–scan–reprint cycle destroys that signal; the engine then falls
  back to arithmetic and cross-document consistency alone.
- **EPFO contribution amounts are not yet captured** by our EPFO provider
  schema, so `pf-matches-epfo` currently emits `not_assessed` for every
  case — employment periods and employer names are verified, amounts are not.
- **Two rules are stubs today**: `identity-consistent` and
  `employer-name-match` return no findings even when evidence is present.
  They are tracked work, not shipped capability, and are excluded from the
  numbers above.
- **The corpus is synthetic and small (n=20).** It proves the engine's
  logic on known ground truth, not field performance at scale. Field data
  from real cases is the next reliability milestone.

## Related proof

Model independence — the verdict comes from the rules engine, not from
whichever AI model read the document — is proven by a separate CI check;
see RCQ-20116 / `services/api/tests/model-independence.test.ts`.
