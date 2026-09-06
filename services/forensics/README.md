# DOC-03: Node-Side PDF Inspection Forensics Service

## Overview

The forensics service provides client-side PDF inspection and anomaly detection for the Recheq verification system. It extracts metadata, analyzes font patterns, and flags monetary text anomalies—all while ensuring no raw PDF content is logged.

**Design principle**: Graceful degradation. If PDF inspection fails (corrupt file, read error), the system marks the record as `not_assessed` and continues. Forensics is optional evidence, not a blocker.

---

## Architecture

### Module Structure

```
services/api/src/forensics/
├── pdf-metadata.ts           # Extract producer, creator, creation/mod dates
├── font-runs.ts              # Detect font anomalies, aggregate families
├── monetary-anomalies.ts     # Flag monetary text anomalies (safe aggregation)
└── forensics-service.ts      # Database layer (create, update records)

services/api/tests/
└── forensics.test.ts         # Unit + integration tests (30+ test cases)
```

### Data Flow

```
PDF File (on disk)
    ↓
[PDF Parsing Layer - pdf-parse library]
    ↓
┌─────────────────────────────────────┐
│  PDF Inspector (coordinator)        │
│  - calls extractPdfMetadata()        │
│  - calls analyzeFontRuns()           │
│  - calls analyzeMonetaryAnomalies()  │
└─────────────────────────────────────┘
    ↓
[ForensicsData]
    ↓
[forensics-service.ts]
    ↓
[Database: forensics table]
    ↓
[EvidenceAssembly: set has_forensics=true]
    ↓
[Rules Engine: checkForensicsMetadata()]
```

---

## Module Reference

### 1. pdf-metadata.ts

**Purpose**: Extract PDF metadata safely (producer, creator, creation date, modification date).

**Key Functions**:

- **`extractPdfMetadata(pdfInfo)`** — Main entry point
  - Input: `pdfInfo` object from pdf-parse (typically `doc.info`)
  - Output: `PdfMetadata` with producer, creator, creation_date, modification_date
  - Graceful: Returns null for missing/malformed fields

- **`parseMetadataDate(dateStr)`** — Parse ISO 8601 dates
  - Handles common PDF date formats
  - Returns null if unparseable (no throw)

- **`extractMetadataString(value)`** — Safely extract string metadata
  - Validates type, trims whitespace
  - Rejects empty strings as null

**Safe Logging**: All outputs are strings or timestamps. Never logs raw PDF content.

**Example**:

```typescript
import * as pdf from 'pdf-parse';
import { extractPdfMetadata } from './pdf-metadata.js';

const buffer = await fs.promises.readFile('document.pdf');
const doc = await pdf(buffer);
const metadata = extractPdfMetadata(doc.info);
// { producer: 'iText', creator: 'Microsoft Word', creation_date: Date, ... }
```

---

### 2. font-runs.ts

**Purpose**: Analyze font usage patterns to detect suspicious formatting changes.

**Key Functions**:

- **`analyzeFontRuns(fontRuns)`** — Main anomaly detection
  - Input: Array of font run objects (from pdf-parse or similar)
  - Output: `FontRunAnalysis` with aggregated families, counts, anomaly flag, confidence
  - Graceful: Returns empty analysis for missing/malformed input

**Anomaly Detection Heuristics**:

| Condition                                                     | Severity   | Confidence |
| ------------------------------------------------------------- | ---------- | ---------- |
| >3 distinct font families                                     | Suspicious | +0.3-0.4   |
| Business font + suspicious font mix (e.g., Arial + Wingdings) | Suspicious | +0.2       |
| Extreme distribution (one font <5% of runs, others >90%)      | Suspicious | +0.15      |

**Safe Logging**: Returns only aggregated data (family names, counts, percentages). Never logs character-level analysis.

**Example**:

```typescript
import { analyzeFontRuns } from './font-runs.js';

const analysis = analyzeFontRuns(fontRuns);
// {
//   total_runs: 1500,
//   unique_families: ['Arial', 'Helvetica'],
//   runs_by_family: { Arial: 1400, Helvetica: 100 },
//   anomaly_detected: false,
//   confidence: 0
// }
```

---

### 3. monetary-anomalies.ts

**Purpose**: Detect suspicious patterns in currency text (without exposing raw amounts).

**Key Functions**:

- **`analyzeMonetaryAnomalies(documentText)`** — Main entry point
  - Input: Document text extracted from PDF
  - Output: `MonetaryAnomalyAnalysis` with anomaly flags, confidence, anomaly counts
  - Graceful: Returns empty analysis for empty/null input

**Anomaly Types Detected**:

| Anomaly Type               | Example                                         | Detection Method                           |
| -------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Font changes               | `$1000` in different font than surrounding text | Proximity analysis (~5 char window)        |
| Size changes               | Monetary values sized differently               | Standard deviation of lengths              |
| Color changes              | Red vs. black currency                          | (Placeholder for full PDF rendering layer) |
| Spacing anomalies          | `value$1000` without space                      | Whitespace boundary analysis               |
| Formatting inconsistencies | Mixed `$1,000.00` and `$2.000,00`               | Delimiter consistency check                |

**Safe Logging**: Returns only:

- Boolean flags (anomalies_detected)
- Counts (total_anomalies, per type)
- Confidence score (0.0–1.0)
- Never raw amounts, text snippets, or document content

**Example**:

```typescript
import { analyzeMonetaryAnomalies } from './monetary-anomalies.js';

const text = 'Invoice: $1,000.00. Total: $2,500.50.';
const analysis = analyzeMonetaryAnomalies(text);
// {
//   anomalies_detected: false,
//   total_anomalies: 0,
//   confidence: 0,
//   anomaly_types: {
//     font_changes: 0,
//     size_changes: 0,
//     color_changes: 0,
//     spacing_anomalies: 0,
//     formatting_inconsistencies: 0
//   }
// }
```

---

### 4. forensics-service.ts

**Purpose**: Database layer for forensics records (Drizzle ORM, async, error-throwing).

**Key Functions**:

- **`createForensicsRecord(db, documentId)`** — Create pending forensics record
  - Returns: Forensics record ID
  - Called on document upload to initiate async inspection

- **`updateForensicsSuccess(db, forensicsId, data)`** — Update with inspection results
  - Stores: metadata (producer, creator, dates), font_runs analysis, monetary_anomalies analysis
  - Sets status: `'completed'`, completed_at: now

- **`updateForensicsFailure(db, forensicsId, errorMessage)`** — Handle inspection failure
  - Sets status: `'not_assessed'` (graceful degradation)
  - Stores error message in metadata_raw (informational only)
  - Completed_at: set, allowing evidence assembly to skip failed inspections

- **`getForensicsByDocumentId(db, documentId)`** — Retrieve forensics record
  - Returns: Full forensics record with all fields, or null

**Service Pattern**:

- All functions are async and throw on database errors
- No Result<T> wrapper (consistent with extraction-service pattern)
- Uses Drizzle ORM with typed queries
- Graceful failure: updateForensicsFailure marks as not_assessed, not failed

**Example**:

```typescript
import { createForensicsRecord, updateForensicsSuccess } from './forensics-service.js';

const forensicsId = await createForensicsRecord(db, documentId);

// After inspection completes
await updateForensicsSuccess(db, forensicsId, {
  metadata: { producer, creator, creation_date, modification_date },
  fontRuns: fontAnalysis,
  monetaryAnomalies: monetaryAnalysis,
});
```

---

## Integrations

### With EvidenceAssembly

After forensics inspection completes:

1. Query `forensics` table for the document
2. If status is `'completed'`: Set `has_forensics: true` in EvidenceAssembly
3. Add `'forensics'` to `origins` array

```typescript
// In evidence-service.ts
const forensicsRecord = await getForensicsByDocumentId(db, documentId);
const hasForensics = forensicsRecord?.status === 'completed' && forensicsRecord?.producer !== null;

return {
  origins: [...origins, hasForensics ? 'forensics' : null].filter(Boolean),
  has_forensics: hasForensics,
  // ...
};
```

### With Rules Engine

The existing `checkForensicsMetadata` rule in `packages/rules/src/checks/forensics-metadata.ts` receives forensics data and returns findings:

```typescript
export function checkForensicsMetadata(forensics: ForensicsData): FindingInput[] {
  const findings: FindingInput[] = [];

  // Font anomaly finding
  if (forensics.font_runs?.anomaly_detected) {
    findings.push({
      rule_id: 'forensics-font-anomaly',
      severity: 'medium',
      status: 'flagged',
      title: 'Suspicious Font Changes Detected',
      explanation: `Document shows ${forensics.font_runs.unique_families.length} fonts (confidence: ${forensics.font_runs.confidence})`,
      expected: 'Consistent font family',
      observed: forensics.font_runs.unique_families.join(', '),
      source_document_ids: [documentId],
    });
  }

  // Monetary anomaly finding
  if (forensics.monetary_anomalies?.anomalies_detected) {
    findings.push({
      rule_id: 'forensics-monetary-anomaly',
      severity: 'high',
      status: 'flagged',
      title: 'Monetary Text Anomalies',
      explanation: `${forensics.monetary_anomalies.total_anomalies} anomalies detected`,
      expected: 'No formatting anomalies',
      observed: `${forensics.monetary_anomalies.total_anomalies} detected`,
      source_document_ids: [documentId],
    });
  }

  return findings;
}
```

---

## Safe Logging Patterns

### ✅ SAFE: What We Log

```typescript
logger.info('forensics_inspection_complete', context, {
  document_id: documentId,
  forensics_status: 'completed',
  producer: 'Adobe Acrobat',
  creator: 'Microsoft Word',
  creation_date: '2023-01-15T10:00:00Z',
  font_family_count: 2,
  unique_fonts: ['Arial', 'Helvetica'],
  monetary_anomaly_detected: true,
  monetary_anomaly_confidence: 0.75,
});
```

### ❌ UNSAFE: What We NEVER Log

```typescript
// ❌ Never log raw PDF text
logger.info('forensics_extraction', context, {
  raw_document_content: pdfText, // BAD
});

// ❌ Never log full monetary amounts
logger.info('monetary_analysis', context, {
  detected_amounts: ['$1,000,000', '$500,000'], // BAD
});

// ❌ Never log character-level font analysis
logger.info('font_analysis', context, {
  character_font_changes: [...], // BAD
});
```

**Logger Redaction**: The logger automatically redacts keys matching:

- `/document[-_]?content/i`
- `/raw[-_]?document/i`
- `/extraction[-_]?payload/i`
- `/extracted[-_]?text/i`

Always use safe keys: `forensics_status`, `font_family_count`, `monetary_anomaly_detected`.

---

## Graceful Degradation

### Corrupt PDF Handling

```typescript
async function inspectPdf(filePath: string): Promise<ForensicsData | null> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const doc = await pdf(buffer);
    return {
      metadata: extractPdfMetadata(doc.info),
      fontRuns: analyzeFontRuns(doc.fontRuns || []),
      monetaryAnomalies: analyzeMonetaryAnomalies(doc.text || ''),
    };
  } catch (err) {
    // Log warning but don't throw
    logger.warn('pdf_inspection_failed', context, {
      document_id: documentId,
      error_type: err.name,
      error_message: err.message,
    });

    // Mark as not_assessed, allow investigation to continue
    await updateForensicsFailure(db, forensicsId, err.message);
    return null;
  }
}
```

### Missing Field Handling

All three modules gracefully handle missing/malformed input:

- `extractPdfMetadata({})` → all fields null
- `analyzeFontRuns([])` → empty analysis, no anomaly
- `analyzeMonetaryAnomalies(null)` → empty analysis, no anomaly

No exceptions thrown. Evidence assembly skips null/not_assessed forensics records.

---

## Testing

Run forensics tests:

```bash
cd services/api
npm run test -- tests/forensics.test.ts
```

**Test Coverage**:

- Metadata extraction: 10 test cases (valid, missing, malformed, date parsing)
- Font anomaly detection: 8 test cases (single/multi-font, suspicious, extreme distribution)
- Monetary anomaly detection: 10 test cases (currencies, spacing, formatting, no logging)
- Integration: 2 test cases (graceful degradation, safe serialization)

**Total**: 30+ test cases ensuring:

- ✅ All fields extracted where available
- ✅ Graceful degradation on missing/corrupt data
- ✅ No raw document content in outputs
- ✅ Confidence scores in valid range (0.0–1.0)
- ✅ Safe aggregation only (no character analysis)

---

## Performance Considerations

- **Metadata extraction**: O(1) — parses info object
- **Font analysis**: O(n) where n = number of font runs (typically 100s–1000s)
- **Monetary anomaly detection**: O(m) where m = document length (regex matching)
- **Database operations**: Standard Drizzle ORM performance

For large PDFs (>10MB), consider:

1. Streaming PDF parsing if available
2. Batching font/monetary analysis
3. Deferring forensics inspection to a background worker queue

---

## Future Enhancements

- [ ] PDF rendering layer for accurate color/sizing anomaly detection
- [ ] Machine learning model for document forgery detection
- [ ] Watermark/signature detection
- [ ] OCR-based text comparison with embedded text
- [ ] Background worker queue for async inspection of large PDFs
- [ ] Caching of forensics results for identical PDFs (by SHA256)

---

## Related Documentation

- **DOC-01**: Provider-independent document extraction system
- **DOC-02**: Payslip/Form 16 schemas and prompts
- **EvidenceAssembly**: `packages/schema/src/evidence.ts`
- **Finding Patterns**: `packages/schema/src/finding.ts`
- **Logger Redaction**: `packages/config/src/logging.ts`
- **Forensics Database Schema**: `services/api/src/db/schema/forensics.ts`
