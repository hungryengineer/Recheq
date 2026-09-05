# Extraction Evaluation Results

Model: `gemini-3.6-flash` (pinned via `DEFAULT_EXTRACTION_MODEL` / `.env.example`).

Measured by `pnpm evaluate` against the labelled extraction corpus.
Precision and recall are reported separately — hallucinated fields are more dangerous than missing ones.

## Aggregate Metrics

| Metric                  | Value  |
| ----------------------- | ------ |
| Documents evaluated     | 16     |
| Overall precision       | 98.08% |
| Overall recall          | 95.05% |
| True positives          | 307    |
| False positives         | 6      |
| False negatives         | 16     |
| Avg input tokens / doc  | 836    |
| Avg output tokens / doc | 382    |

## Failure Modes

| Failure mode       | Count |
| ------------------ | ----- |
| MISSING_FIELD      | 10    |
| HALLUCINATED_FIELD | 0     |
| VALUE_MISMATCH     | 6     |
| TYPE_MISMATCH      | 0     |

## Per-Document Breakdown

| Document                   | Precision | Recall  | MISSING | HALLUCINATED | VALUE_MISMATCH | TYPE_MISMATCH | Input tokens | Output tokens |
| -------------------------- | --------- | ------- | ------- | ------------ | -------------- | ------------- | ------------ | ------------- |
| form16-clean-01.json       | 100.00%   | 100.00% | 0       | 0            | 0              | 0             | 906          | 286           |
| form16-clean-02.json       | 100.00%   | 100.00% | 0       | 0            | 0              | 0             | 736          | 303           |
| form16-clean-03.json       | 100.00%   | 100.00% | 0       | 0            | 0              | 0             | 879          | 267           |
| form16-doctored-01.json    | 100.00%   | 100.00% | 0       | 0            | 0              | 0             | 906          | 286           |
| form16-doctored-02.json    | 100.00%   | 100.00% | 0       | 0            | 0              | 0             | 898          | 281           |
| payslip-arun-doctored.json | 95.65%    | 91.67%  | 1       | 0            | 1              | 0             | 821          | 416           |
| payslip-clean-01.json      | 95.65%    | 91.67%  | 1       | 0            | 1              | 0             | 823          | 420           |
| payslip-clean-02.json      | 95.83%    | 95.83%  | 0       | 0            | 1              | 0             | 832          | 441           |
| payslip-clean-03.json      | 94.74%    | 94.74%  | 0       | 0            | 1              | 0             | 793          | 378           |
| payslip-doctored-01.json   | 95.65%    | 91.67%  | 1       | 0            | 1              | 0             | 828          | 420           |
| payslip-doctored-02.json   | 94.74%    | 90.00%  | 1       | 0            | 1              | 0             | 813          | 383           |
| payslip-template-01.json   | 100.00%   | 95.65%  | 1       | 0            | 0              | 0             | 817          | 453           |
| payslip-template-02.json   | 100.00%   | 95.65%  | 1       | 0            | 0              | 0             | 820          | 440           |
| payslip-template-03.json   | 100.00%   | 95.65%  | 1       | 0            | 0              | 0             | 845          | 447           |
| payslip-template-04.json   | 100.00%   | 95.65%  | 1       | 0            | 0              | 0             | 828          | 445           |
| payslip-template-05.json   | 100.00%   | 91.30%  | 2       | 0            | 0              | 0             | 828          | 440           |
