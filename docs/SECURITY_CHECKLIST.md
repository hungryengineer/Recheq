# Security Checklist — OPS-07

Automated and manual checks for token isolation, org scoping, and secret leakage.

## Token Boundaries

| Check                                 | How verified | File                                      |
| ------------------------------------- | ------------ | ----------------------------------------- |
| Unknown token → 401                   | Unit test    | `security-boundaries.integration.test.ts` |
| Hash-mismatch token → 401             | Unit test    | `security-boundaries.integration.test.ts` |
| Consent token on employer route → 403 | Unit test    | `security-boundaries.integration.test.ts` |
| Employer token on consent route → 403 | Unit test    | `security-boundaries.integration.test.ts` |
| Expired token → 410 (not 401)         | Unit test    | `security-boundaries.integration.test.ts` |

## Organisation Isolation

| Check                                                       | How verified | File                                          |
| ----------------------------------------------------------- | ------------ | --------------------------------------------- |
| `getCase` with wrong `org_id` → 404                         | Unit test    | `security-boundaries.integration.test.ts`     |
| 404 used instead of 403 (prevents org existence disclosure) | Unit test    | `security-boundaries.integration.test.ts`     |
| `listCases` only returns own-org cases                      | Unit test    | `security-boundaries.integration.test.ts`     |
| `auth.orgId` comes from middleware, not request body        | Code review  | `routes/cases/list.ts`, `get.ts`, `create.ts` |

## Candidate View Isolation

| Check                                           | How verified | File                                      |
| ----------------------------------------------- | ------------ | ----------------------------------------- |
| `risk_score` absent from candidate API response | Unit test    | `security-boundaries.integration.test.ts` |
| `verdict` absent from candidate API response    | Unit test    | `security-boundaries.integration.test.ts` |
| `org_id` absent from candidate API response     | Unit test    | `security-boundaries.integration.test.ts` |
| `created_by` absent from candidate API response | Unit test    | `security-boundaries.integration.test.ts` |

## Secret Leakage

| Check                                                     | How verified | File                                      |
| --------------------------------------------------------- | ------------ | ----------------------------------------- |
| `DATABASE_URL` absent from NEXT_PUBLIC_ output            | Unit test    | `no-secret-leak.test.ts`                  |
| `OPENAI_API_KEY` / `gsk_` absent from NEXT_PUBLIC_ output | Unit test    | `no-secret-leak.test.ts`                  |
| `S3_SECRET_KEY` / `minioadmin` absent from NEXT_PUBLIC_   | Unit test    | `no-secret-leak.test.ts`                  |
| `TOKEN_PEPPER` absent from NEXT_PUBLIC_ output            | Unit test    | `no-secret-leak.test.ts`                  |
| No `NEXT_PUBLIC_DATABASE_URL` or similar env exposure     | Unit test    | `no-secret-leak.test.ts`                  |
| Nested sensitive fields are redacted                      | Unit test    | `security-boundaries.integration.test.ts` |
| Error responses contain no stack traces                   | Unit test    | `no-secret-leak.test.ts`                  |
| Error responses contain no internal file paths            | Unit test    | `no-secret-leak.test.ts`                  |

## Document Storage

| Check                                             | How verified | File                                      |
| ------------------------------------------------- | ------------ | ----------------------------------------- |
| Storage path requires `org_id` + `case_id` prefix | Unit test    | `security-boundaries.integration.test.ts` |
| Two orgs with same doc ID have different paths    | Unit test    | `security-boundaries.integration.test.ts` |
| Direct S3/MinIO URL not exposed to browser        | Unit test    | `security-boundaries.integration.test.ts` |

## Running the Tests

```bash
# Unit/integration tests
pnpm test -- services/api/tests/security-boundaries.integration.test.ts
pnpm test -- apps/web/tests/no-secret-leak.test.ts

# Live API smoke test (requires running API)
API_BASE_URL=http://localhost:4000 npx tsx scripts/security-smoke-test.ts
```

## CI Gate

The unit tests run in the `unit-tests` stage of CI. The smoke test is available for pre-deploy
validation but is not automatically run in CI (requires a live API instance).

## Architectural Controls

- Raw tokens are never stored. Only SHA-256 hashes are persisted.
- Token purpose is a database-stored value, not a URL segment that can be forged.
- `org_id` is injected from the auth middleware, never read from the request body.
- `CandidateSafeView` is a named projection type — adding fields to `CaseRecord` does not automatically expose them.
- Response sanitization (`sanitizeSensitiveFields`) runs as middleware on all public JSON responses.
