#!/usr/bin/env bash
# Automated checks for task-tracker changes: type-check, tests, and diff rules.
# Usage: check.sh [--base <git-ref>] [--build]
#   --base   branch the change is based on (default: main); the diff starts at its merge-base with HEAD
#   --build  also run `npm run build`
# Exit code: 0 if no check failed (warnings allowed), 1 otherwise.

set -uo pipefail

BASE="main"
RUN_BUILD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --build) RUN_BUILD=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Always run from the app folder of the current checkout (main repo or a worktree).
ROOT="$(git rev-parse --show-toplevel)/task-tracker"
cd "$ROOT" || exit 2

FAILED=0
WARNINGS=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILED=$((FAILED + 1)); }
warn() { echo "  WARN  $1"; WARNINGS=$((WARNINGS + 1)); }
section() { echo; echo "== $1"; }

# --- Changed files -----------------------------------------------------------
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "Base ref '$BASE' not found" >&2
  exit 2
fi
# Diff from the merge-base so commits added to $BASE after branching don't count as part of this change.
if ! BASE_SHA=$(git merge-base "$BASE" HEAD); then
  echo "No merge-base between '$BASE' and HEAD" >&2
  exit 2
fi

section "Changed files (since merge-base with $BASE, ${BASE_SHA:0:8}, plus uncommitted and untracked)"
CHANGED=$( { git diff --name-only --relative "$BASE_SHA" -- . ; git ls-files --others --exclude-standard -- . ; } | sort -u)
if [[ -z "$CHANGED" ]]; then
  echo "  (none)"
else
  echo "$CHANGED" | sed 's/^/  /'
fi
# seed.ts prints progress on purpose, so it is left out of the console.log scan.
UNTRACKED=$(git ls-files --others --exclude-standard -- src ':!src/seed.ts')

# Lines added in src/ (tracked diff + whole untracked files), excluding src/seed.ts.
added_src_lines() {
  git diff -U0 "$BASE_SHA" -- src ':!src/seed.ts' | grep -E '^\+[^+]' | sed 's/^+//'
  for f in $UNTRACKED; do cat "$f"; done
}

# --- Diff rules --------------------------------------------------------------
section "Diff rules"

# .env.example is the tracked template and may change; any other .env file must not.
if echo "$CHANGED" | grep -E '(^|/)\.env(\..*)?$' | grep -qvE '(^|/)\.env\.example$'; then
  fail ".env file changed or untracked; it must stay out of the repo"
else
  pass "no .env files in the change"
fi

SPECS=$(echo "$CHANGED" | grep -E '\.spec\.ts$' || true)
if [[ -n "$SPECS" ]] && grep -nE '\b(it|describe|test)\.(only|skip)\(|\bx(it|describe)\(|\bf(it|describe)\(' $SPECS 2>/dev/null; then
  fail "focused or skipped tests (.only / .skip / xit / fit) in changed specs"
else
  pass "no focused or skipped tests"
fi

if added_src_lines | grep -nE 'console\.(log|debug)\(' >/dev/null; then
  warn "console.log/debug added in src/ (outside seed.ts); remove debug logs"
else
  pass "no console.log added"
fi

# Filters take values, which must be :params. Single-line only; multi-line templates are a manual check.
if added_src_lines | grep -nE '\.(where|andWhere|orWhere|having|andHaving|orHaving|query)\([[:space:]]*`[^`]*\$\{' >/dev/null; then
  fail "filter or raw query built with a template string; use parameters (:name) instead"
else
  pass "no string-built filters"
fi
# Column names can't be parameterized, so a template here is only safe if the value is whitelisted.
if added_src_lines | grep -nE '\.(select|addSelect|orderBy|addOrderBy|groupBy|addGroupBy|innerJoin|leftJoin|innerJoinAndSelect|leftJoinAndSelect)\([[:space:]]*`[^`]*\$\{' >/dev/null; then
  warn "select/orderBy/groupBy/join built with a template string; check the value is whitelisted (e.g. @IsIn)"
fi

SRC_CHANGED=$(echo "$CHANGED" | grep -E '^src/.*\.ts$' | grep -vE '\.spec\.ts$' || true)
if [[ -n "$SRC_CHANGED" && -z "$SPECS" ]]; then
  warn "src/ changed but no *.spec.ts changed; bug fixes and features need tests"
elif [[ -n "$SRC_CHANGED" ]]; then
  pass "spec files changed alongside src/"
fi

ENTITIES=$(echo "$CHANGED" | grep -E '\.entity\.ts$' || true)
for e in $ENTITIES; do
  [[ -f "$e" ]] || continue
  warn "$e changed: synchronize: true alters the table on next start"
  CLASS=$(grep -oE 'export class [A-Za-z0-9_]+' "$e" | head -1 | awk '{print $3}')
  if [[ -n "$CLASS" ]] && ! grep -qE "\b$CLASS\b" src/data-source.ts; then
    fail "entity $CLASS is not in the entities list of src/data-source.ts"
  fi
done

DTOS=$(echo "$CHANGED" | grep -E '^src/.*/dto/.*\.ts$' || true)
for d in $DTOS; do
  [[ -f "$d" ]] || continue
  # A property with no decorator above it is silently dropped by whitelist: true.
  # Comment lines are skipped; a decorator's arguments may span lines until its parentheses close.
  UNDECORATED=$(awk '
    /^[[:space:]]*(\/\/|\/\*|\*)/ { next }
    depth > 0 { depth += gsub(/\(/, "(") - gsub(/\)/, ")"); next }
    /^[[:space:]]*@/ { decorated = 1; depth = gsub(/\(/, "(") - gsub(/\)/, ")"); next }
    /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[?!]?[[:space:]]*:/ { if (!decorated) print FILENAME ":" NR ": " $0; decorated = 0; next }
    /[^[:space:]]/ { decorated = 0 }
  ' "$d")
  if [[ -n "$UNDECORATED" ]]; then
    echo "$UNDECORATED" | sed 's/^/        /'
    warn "$d may have fields without class-validator decorators (dropped by whitelist); read the file to confirm"
  fi
done

# --- Type-check --------------------------------------------------------------
section "Type-check (npx tsc --noEmit)"
if TSC_OUT=$(npx tsc --noEmit 2>&1); then
  pass "tsc"
else
  echo "$TSC_OUT" | head -40 | sed 's/^/        /'
  fail "tsc reported errors"
fi

# --- Tests -------------------------------------------------------------------
section "Tests (npm test)"
if TEST_OUT=$(npm test --silent -- --ci 2>&1); then
  echo "$TEST_OUT" | grep -E '^(Tests|Test Suites):' | sed 's/^/        /'
  pass "jest"
else
  echo "$TEST_OUT" | tail -40 | sed 's/^/        /'
  fail "jest reported failures"
fi

# --- Build (optional) --------------------------------------------------------
if [[ $RUN_BUILD -eq 1 ]]; then
  section "Build (npm run build)"
  if BUILD_OUT=$(npm run build --silent 2>&1); then
    pass "build"
  else
    echo "$BUILD_OUT" | tail -30 | sed 's/^/        /'
    fail "build failed"
  fi
fi

# --- Summary -----------------------------------------------------------------
section "Summary"
echo "  $FAILED failed, $WARNINGS warning(s)"
[[ $FAILED -eq 0 ]]
