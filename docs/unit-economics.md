# Unit Economics Model

This document outlines the unit economics for Recheq's background verification engine, specifically addressing diligence question Q3. It demonstrates the technical levers and cost structures involved at various scales of operation.

## The Split: Infrastructure vs. Inference

A fundamental operating principle of Recheq's architecture is the strict decoupling of **Infrastructure** costs from **Inference** costs.

- **Infrastructure:** Includes database (PostgreSQL), serverless compute (Vercel/Next.js/Node engines), and blob storage. These costs are a fraction of a cent per check and scale sub-linearly. For unit economic purposes, infrastructure cost is negligible.
- **Inference (COGS):** The dominant cost driver is the extraction and evaluation logic powered by large language models (currently Gemini 2.5 Flash). This is the true Cost of Goods Sold (COGS). A partner will respect you for knowing which is which: _inference is where the margin battle is fought._

## Cost Per Case at Scale

The engine dynamically tracks input and output tokens for every verification step to calculate exact, un-estimated costs over the actual document corpus.

Assuming an average document package involves ~15,000 input tokens (payslips, form16s, rules) and ~1,500 output tokens per case. Using Gemini 1.5/2.5 Flash pricing (approx. $0.075 / 1M input, $0.30 / 1M output) at an exchange rate of 83 INR:

| Scale | Volume (Cases/mo) | Approx. INR Cost / Case | Total Inference COGS | Margin Profile (against 99 INR price) |
| ----- | ----------------- | ----------------------- | -------------------- | ------------------------------------- |
| 1x    | 1,000             | ~ INR 1.31              | INR 1,310            | 98.6%                                 |
| 10x   | 10,000            | ~ INR 1.31              | INR 13,100           | 98.6%                                 |
| 100x  | 100,000           | ~ INR 0.85*             | INR 85,000           | 99.1%                                 |

_\*At 100x scale, Batch APIs and context caching begin to compress the per-case inference cost._

## Gross Margin Analysis

Recheq prices instant checks at **INR 99-199**.

**Market Reference:**

- Legacy API-based data checks currently run **INR 100-500** each.
- Full-service comprehensive human screening runs **INR 2,500-10,000** per candidate.

With an inference cost of under INR 2 per check, Recheq commands a **98%+ gross margin** at the baseline 99 INR price point, dramatically undercutting the legacy full-service model while maintaining software-tier margins on the API checks.

## Margin Levers

To sustain and improve these margins as volume scales, we employ the following technical levers:

1. **Cheap-Tier-First Routing:** Trivial classification tasks (e.g., determining document type or checking image blurriness) are routed to micro-models or traditional heuristics before ever hitting the primary inference engine.
2. **Context Caching on Identical System Prompts:** The engine reuses the massive rule-evaluation system prompt across candidates via prompt caching. At high concurrency, this reduces input token costs by up to 50% for the largest context components.
3. **Batch API for the Non-Latency-Sensitive Path:** "Slow" steps (like deep background traces or complex multi-document correlation that don't block the instant interim verdict) are routed through asynchronous Batch APIs, yielding a 50% discount on inference costs.
