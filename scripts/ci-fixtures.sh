#!/bin/bash
# ─── OPS-05: CI Fixture Gate Wrapper ────────────────────────────
# Safe wrapper for running the 10-fixture suite in CI/local environments.
# Ensures:
# - No raw document content or secrets printed
# - Clear pass/fail reporting
# - Exit codes for CI integration

set -euo pipefail

# Color output for terminals (auto-disabled in CI)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect if running in CI (GitHub Actions, GitLab CI, etc.)
if [[ "${CI:-false}" == "true" ]]; then
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 Running Tieout Fixture Validation Suite${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

# Verify fixtures directory exists
FIXTURES_DIR="${PROJECT_ROOT}/fixtures/extraction"
if [[ ! -d "$FIXTURES_DIR" ]]; then
  echo -e "${RED}❌ Fixtures directory not found: $FIXTURES_DIR${NC}"
  exit 1
fi

# Count fixture files
FIXTURE_COUNT=$(find "$FIXTURES_DIR" -maxdepth 1 -name '*.json' -type f | wc -l)
echo -e "${BLUE}Found $FIXTURE_COUNT fixture files${NC}"

if [[ $FIXTURE_COUNT -ne 10 ]]; then
  echo -e "${YELLOW}⚠️  Expected 10 fixtures, found $FIXTURE_COUNT${NC}"
fi

echo ""
echo -e "${BLUE}Running fixture validation...${NC}"
echo ""

# Use npm/pnpm to run the fixtures script
# The script handles all output sanitization internally
cd "$PROJECT_ROOT"

# Try pnpm first, fall back to npm
if command -v pnpm &> /dev/null; then
  FIXTURES_CMD="pnpm fixtures"
elif command -v npm &> /dev/null; then
  FIXTURES_CMD="npm run fixtures"
else
  echo -e "${RED}❌ Neither pnpm nor npm found in PATH${NC}"
  exit 1
fi

if $FIXTURES_CMD; then
  echo ""
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ All fixture validations passed!${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  exit 0
else
  EXIT_CODE=$?
  echo ""
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo -e "${RED}❌ Fixture validation failed!${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting tips:${NC}"
  echo "  1. Check docs/fixture-troubleshooting.md for guidance"
  echo "  2. Run 'pnpm fixtures' locally to debug"
  echo "  3. Verify all fixture JSON files are valid"
  echo "  4. Ensure no breaking changes to extraction logic"
  exit "$EXIT_CODE"
fi
