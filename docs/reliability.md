# Reliability

How Recheq stays trustworthy when the AI underneath it changes.

## What happens if we swap the AI model?

Short answer: **the model itself has no say in the outcome.**

Recheq's verdicts ("verified", "needs review", etc.) are not produced by the
AI model. The model only _reads_ a document — a payslip or a Form 16 — and
turns it into structured data. The verdict is then calculated by our own
**rules engine**, which checks that structured data with plain,
auditable logic (arithmetic consistency, EPFO cross-checks, date overlap,
and so on).

One precision matters here. Swapping the model proves that **model identity
cannot influence outcomes**: when two different models hand the rules engine
the _same structured evidence_, the findings, risk score and verdict are
identical — because the rules engine simply has no input slot for which
model produced the data. Of course, if a future model read documents
_differently_ — better or worse — the structured evidence it hands over can
change, and then the rules engine will rightly reach a different conclusion.
That is not model leakage; that is diligence responding to the evidence.

That means the extraction layer is replaceable. If a better or cheaper model
appears tomorrow — or today's model disappears — the rules engine keeps
working on whatever structured evidence it receives and reaches its
conclusions through the same auditable logic.

We prove this with an automated test instead of asking you to take our word
for it:

- **Test:** [`services/api/tests/model-independence.test.ts`](../../services/api/tests/model-independence.test.ts)
- **What it does:** takes our whole corpus of sample documents, reads them
  once with the current extractor and once with a stand-in "next
  generation" model that produces identical structured data under a
  different model identity, and asserts the resulting findings, risk score
  and verdict are **identical** across every document. It also verifies that
  the triangulation step — where all evidence is combined into a verdict —
  declares itself model-free (`provenance.model = null`) by contract, on
  both success and failure paths.
- **When it runs:** automatically on every pull request in CI, so any
  change that makes outcomes depend on a specific model would fail the
  build before it ships.

## Why this matters for diligence

- No vendor lock-in on a single model provider.
- Cost can be optimised freely: swapping models never moves a candidate's
  verdict.
- The judgement logic is ours, inspectable, and version-controlled — not
  buried inside someone else's weights.
