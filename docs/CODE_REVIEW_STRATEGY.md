# Code Review & Security Strategy

## Overview

Tieout uses a **multi-layered security and code quality review** pipeline:

1. **Gitleaks** — Detects hardcoded secrets (API keys, credentials, tokens)
2. **CodeRabbit AI** — LLM-powered code review for bugs, security issues, compliance patterns
3. **ESLint + Prettier** — Automated style and common-error detection
4. **TypeScript** — Type safety enforcement
5. **Unit & Integration Tests** — Behavioral correctness
6. **Fixture Validation** — End-to-end extraction correctness

## CodeRabbit Integration

### What It Does

CodeRabbit is an AI code reviewer that scans PRs for:

- **Security vulnerabilities** — SQL injection, XSS, CSRF, insecure crypto, unvalidated redirects
- **Compliance issues** — Sensitive data logging, unprotected endpoints, missing auth checks
- **Performance regressions** — N+1 queries, memory leaks, inefficient algorithms
- **Code quality** — Duplicate logic, dead code, inconsistent patterns
- **Dependency risks** — Insecure or outdated packages

### PR Workflow

1. Open a pull request
2. **CodeRabbit posts a review** within seconds with findings and severity
3. Review comments include:
   - What was found (e.g., "SQL injection risk in query string")
   - Why it matters for Tieout (e.g., "financial data exposure")
   - Suggested fix or reference
4. **Strongly advise against merging PRs with critical security findings** (unless explicitly approved)

### For Fintech/Compliance Context

CodeRabbit understands:

- **Authentication/authorization** patterns
- **Data sensitivity** (PII, financial data)
- **Audit logging** requirements
- **Secrets management** best practices
- **Third-party integrations** (API security, webhook validation)

## Local Review (Before Push)

Install CodeRabbit CLI:

```bash
# macOS/Linux
curl -fsSL https://cli.coderabbit.ai/install.sh | sh

# Or via Homebrew
brew install coderabbit
```

Review your branch before pushing:

```bash
coderabbit review --base master
```

## CI Pipeline Integration

CodeRabbit runs automatically on eligible non-draft pull requests targeting configured branches. Status checks:

- ✅ CodeRabbit review completed → comments posted to PR
- ❌ Critical findings → strongly advised to fix before merge
- ⚠️ Medium/low findings → comments only (can merge)

## Configuration

CodeRabbit is configured via the `.coderabbit.yaml` file in the repository root. Findings are tuned for:

- **Language**: TypeScript/JavaScript
- **Framework**: Monorepo (pnpm workspaces)
- **Domain**: Financial data handling, compliance

## What Not to Ignore

**Strongly advised not to merge with CodeRabbit flagging:**

- Secret exposure (API keys, DB passwords, tokens)
- SQL injection or NoSQL injection risks
- Missing authentication on sensitive endpoints
- Unvalidated redirects or SSRF vectors
- Hardcoded credentials
- Insecure crypto (md5, base64-only encoding)
- Unencrypted sensitive data in transit

**Can merge if reviewed and accepted:**

- Code style inconsistencies (handled by ESLint/Prettier anyway)
- Performance suggestions for non-critical paths
- Refactoring recommendations
- Missing error handling (if intentional)

## Escalation

If CodeRabbit flags something you believe is:

- **False positive** → Comment in PR with reasoning
- **Accepted risk** → Comment with business justification and get peer review approval
- **Requires discussion** → Tag @security-review team

## Resources

- [CodeRabbit Documentation](https://docs.coderabbit.ai/)
- [Supported Security Rules](https://docs.coderabbit.ai/tools)
- [CLI Reference](https://docs.coderabbit.ai/tools/cli)
