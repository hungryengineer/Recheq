# Unit Economics Model

This document outlines the unit economics for Recheq's background verification engine, specifically addressing diligence question Q3. It demonstrates the technical levers and cost structures involved at various scales of operation.

## The Split: Infrastructure vs. Inference vs. EPFO

A fundamental operating principle of Recheq's architecture is the strict decoupling of **Infrastructure** costs from **Inference** costs, with **EPFO verification** as a separate COGS line.

- **Infrastructure:** Includes database (PostgreSQL), serverless compute (Vercel/Next.js/Node engines), and blob storage. These costs are a fraction of a cent per check and scale sub-linearly. For unit economic purposes, infrastructure cost is negligible.
- **Inference (COGS):** The extraction and evaluation logic powered by large language models (currently Gemini 3.6 Flash). This is the primary software COGS. A partner will respect you for knowing which is which: _inference is where the margin battle is fought._
- **EPFO API (COGS):** Aggregator lookups (planned provider: Signzy / `epfo:signzy`) cost roughly **₹10–50 per candidate**. At the ₹99 price point this is not a rounding error — it is the second COGS battleground after inference.

## Measured Inference Cost (from extraction evaluation corpus)

Token counts below are **measured** by `pnpm evaluate` over the 16-document labelled extraction corpus (11 generated fixtures + 5 real payroll templates), using `gemini-3.6-flash` with plain-text PDF extracts.

See [`docs/extraction-evaluation-results.md`](extraction-evaluation-results.md) for precision/recall (98.08% / 95.05%) and failure-mode breakdown.

| Metric                                            | Measured value |
| ------------------------------------------------- | -------------- |
| Documents evaluated                               | 16             |
| Avg input tokens / document                       | **836**        |
| Avg output tokens / document                      | **382**        |
| Inference cost / case (Flash pricing, USD→INR 83) | **~₹0.015**    |

Pricing basis: Gemini Flash-tier at **$0.075 / 1M input** and **$0.30 / 1M output** tokens (aligned with `packages/workflow/src/engine.ts` INR rates of ₹6.225/1M in, ₹24.9/1M out).

## Cost Per Case at Scale

Assuming one payslip + one Form 16 extraction per case (≈2× single-document token load → **~₹0.03 inference** per case at measured rates).

| Scale | Volume (Cases/mo) | Inference COGS / Case | EPFO COGS / Case | Combined COGS / Case (EPFO high) | Gross margin at ₹99 |
| ----- | ----------------- | --------------------- | ---------------- | -------------------------------- | ------------------- |
| 1x    | 1,000             | ~₹0.03                | ₹10–50           | ~₹50.03                          | ~49.5%              |
| 10x   | 10,000            | ~₹0.03                | ₹10–50           | ~₹50.03                          | ~49.5%              |
| 100x  | 100,000           | ~₹0.02*               | ₹10–50           | ~₹50.02                          | ~49.5%              |

_\*At 100x scale, Batch APIs and context caching begin to compress the per-case inference cost._

**Gross margin formula (₹99 price point):**

`(99 − inference_cost − epfo_cost) / 99`

At measured inference **~₹0.03/case** and EPFO high case **₹50/case**: `(99 − 0.03 − 50) / 99 ≈ 49.5%`.

Inference-only margin would misleadingly suggest ~99.97%; **EPFO dominates COGS at the ₹99 price point**, not Gemini.

## Gross Margin Analysis

Recheq prices instant checks at **INR 99-199**.

**Market Reference:**

- Legacy API-based data checks currently run **INR 100-500** each.
- Full-service comprehensive human screening runs **INR 2,500-10,000** per candidate.

With inference under **INR 0.05** per document extraction but EPFO lookup at **INR 10–50**, the **combined COGS at ₹99 is ~50%** in the high-EPFO case. The product still dramatically undercuts full-service screening while maintaining software-tier margins on API checks at higher price points (₹199).

## Margin Levers

To sustain and improve these margins as volume scales, we employ the following technical levers:

1. **Cheap-Tier-First Routing:** Trivial classification tasks (e.g., determining document type or checking image blurriness) are routed to micro-models or traditional heuristics before ever hitting the primary inference engine.
2. **Context Caching on Identical System Prompts:** The engine reuses the massive rule-evaluation system prompt across candidates via prompt caching. At high concurrency, this reduces input token costs by up to 50% for the largest context components.
3. **Batch API for the Non-Latency-Sensitive Path:** "Slow" steps (like deep background traces or complex multi-document correlation that don't block the instant interim verdict) are routed through asynchronous Batch APIs, yielding a 50% discount on inference costs.
4. **EPFO cost negotiation at scale:** Aggregator pricing compresses with volume commitments; routing only UAN-present cases to paid EPFO pulls avoids unnecessary lookups.
