#!/usr/bin/env bash
# Run from repo root: bash scripts/verify-phase1.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "CreatorExec Phase 1 file verification"
echo "Repo: $ROOT"
echo "Git:  $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
echo

check ".env.example exists" test -f .env.example
check "supabase migration exists" test -f supabase/migrations/20260709000000_initial_schema.sql
check "supabase client exists" test -f src/lib/supabase/client.ts
check "database types exist" test -f src/lib/supabase/database.types.ts
check "test script exists" test -f scripts/test-supabase.mjs
check "@supabase/supabase-js in package.json" grep -q '@supabase/supabase-js' package.json
check "@supabase/supabase-js installed" test -f node_modules/@supabase/supabase-js/package.json
check ".env in .gitignore" grep -q '^\.env$' .gitignore

echo
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "Run: git fetch origin && git checkout main && git pull origin main"
  exit 1
fi
