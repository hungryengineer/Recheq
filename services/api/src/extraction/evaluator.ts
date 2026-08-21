export enum FailureMode {
  MISSING_FIELD = 'MISSING_FIELD',
  HALLUCINATED_FIELD = 'HALLUCINATED_FIELD',
  VALUE_MISMATCH = 'VALUE_MISMATCH',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
}

export interface Failure {
  path: string;
  mode: FailureMode;
  expected?: unknown;
  actual?: unknown;
}

export interface EvaluationResult {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  failures: Failure[];
}

/**
 * Flattens an object to a dot-notation key-value map.
 * E.g. { basic: { amount: 55000 } } => { "basic.amount": 55000 }
 */
export function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return result;
  }

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Skip internal fields
    if (key.startsWith('_')) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const value = (obj as Record<string, unknown>)[key];

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${path}[${index}]`));
        } else {
          result[`${path}[${index}]`] = item;
        }
      });
    } else {
      result[path] = value;
    }
  }

  return result;
}

/**
 * Compares actual extraction against expected labels and calculates reliability metrics.
 */
export function evaluateExtraction(expected: unknown, actual: unknown): EvaluationResult {
  const flatExpected = flattenObject(expected);
  const flatActual = flattenObject(actual);

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const failures: Failure[] = [];

  const allPaths = new Set([...Object.keys(flatExpected), ...Object.keys(flatActual)]);

  for (const path of allPaths) {
    // Ignore schema version metadata and extraction notes as they are not extracted fields
    if (path === 'schema_version' || path === 'extraction_notes') continue;
    // Also ignore labels from the expected if we just want to match amount (but sometimes labels matter).
    // We will keep them for strict matching.

    const hasExpected = path in flatExpected;
    const hasActual = path in flatActual;
    const valExpected = flatExpected[path];
    const valActual = flatActual[path];

    if (hasExpected && !hasActual) {
      // It was expected but LLM missed it
      if (valExpected !== null && valExpected !== undefined) {
        falseNegatives++;
        failures.push({ path, mode: FailureMode.MISSING_FIELD, expected: valExpected });
      }
    } else if (!hasExpected && hasActual) {
      // LLM hallucinated a field that wasn't in the expected output
      if (valActual !== null && valActual !== undefined) {
        falsePositives++;
        failures.push({ path, mode: FailureMode.HALLUCINATED_FIELD, actual: valActual });
      }
    } else if (hasExpected && hasActual) {
      // Field exists in both
      if (valExpected === null && valActual !== null) {
        falsePositives++;
        failures.push({
          path,
          mode: FailureMode.HALLUCINATED_FIELD,
          actual: valActual,
          expected: null,
        });
        continue;
      }

      if (valExpected !== null && valExpected !== undefined && valActual === null) {
        falseNegatives++;
        failures.push({
          path,
          mode: FailureMode.MISSING_FIELD,
          expected: valExpected,
        });
      } else if (
        typeof valExpected !== typeof valActual &&
        valActual !== null &&
        valExpected !== null
      ) {
        falsePositives++;
        falseNegatives++;
        failures.push({
          path,
          mode: FailureMode.TYPE_MISMATCH,
          expected: valExpected,
          actual: valActual,
        });
      } else if (valExpected !== valActual) {
        falsePositives++;
        falseNegatives++;
        failures.push({
          path,
          mode: FailureMode.VALUE_MISMATCH,
          expected: valExpected,
          actual: valActual,
        });
      } else {
        // Only count as true positive if it's a real value (not null)
        if (valExpected !== null) {
          truePositives++;
        }
      }
    }
  }

  const precision =
    truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;

  const recall =
    truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    failures,
  };
}
