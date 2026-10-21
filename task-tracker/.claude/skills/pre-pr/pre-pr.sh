#!/usr/bin/env bash
# Team pre-MR checklist for task-tracker: branch name, commit messages, issue links, sync with
# the base branch, MR scope, docs and env vars; then the code checks from verify-changes
# (diff rules, type-check, tests, build).
# Usage: pre-pr.sh [--base <git-ref>] [--no-code]
#   --base     branch the MR targets (default: origin/main); run `git fetch origin main` first
#   --no-code  skip verify-changes/check.sh and run only the team-process checks
# Exit code: 0 if no check failed (warnings allowed), 1 otherwise.

set -uo pipefail

BASE="origin/main"
RUN_CODE=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --no-code) RUN_CODE=0; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Always run from the task-tracker root (this file lives in .claude/skills/pre-pr/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 2

FAILED=0
WARNINGS=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILED=$((FAILED + 1)); }
warn() { echo "  WARN  $1"; WARNINGS=$((WARNINGS + 1)); }
info() { echo "  INFO  $1"; }
indent() { sed 's/^/        /'; }
section() { echo; echo "== $1"; }

# Commit and branch types from the root CLAUDE.md.
TYPES='feat|fix|docs|test|refactor|chore'

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "Base ref '$BASE' not found; run git fetch origin main" >&2
  exit 2
fi
if ! BASE_SHA=$(git merge-base "$BASE" HEAD); then
  echo "No merge-base between '$BASE' and HEAD" >&2
  exit 2
fi

# --- Branch ------------------------------------------------------------------
section "Branch"
BRANCH=$(git branch --show-current)
RE_BRANCH="^($TYPES)/[a-z0-9]+(-[a-z0-9]+)*$"
if [[ -z "$BRANCH" ]]; then
  fail "detached HEAD; check out the branch the MR is for"
elif [[ "$BRANCH" == "main" ]]; then
  fail "on main; the work needs its own branch: <type>/<short-kebab-description>"
elif [[ ! "$BRANCH" =~ $RE_BRANCH ]]; then
  fail "'$BRANCH' doesn't match <type>/<short-kebab-description> (types: ${TYPES//|/, })"
else
  pass "branch name $BRANCH"
fi
RE_ISSUE_ID='(^|[/-])(issue-?)?[0-9]+(-|$)'
if [[ -n "$BRANCH" && "$BRANCH" =~ $RE_ISSUE_ID ]]; then
  warn "'$BRANCH' looks like it contains an issue ID; link the issue in the commits and MR instead"
fi

# --- Commits -----------------------------------------------------------------
section "Commits since merge-base with $BASE (${BASE_SHA:0:8})"
RE_SUBJECT="^($TYPES)(\([a-z0-9-]+\))?!?: [^[:space:]]"
RE_FOLDER_SCOPE='^[a-z]+\((task-tracker|dojo-ai-training|src|public)\)'
RE_FIXUP='^(fixup!|squash!|amend!|wip|WIP)'
HASHES=$(git rev-list --no-merges --reverse "$BASE_SHA"..HEAD)
ISSUES=""
if [[ -z "$HASHES" ]]; then
  fail "no commits on this branch since $BASE"
fi
for h in $HASHES; do
  SUBJECT=$(git show -s --format=%s "$h")
  REFS=$(git show -s --format=%b "$h" | grep -oE '(Closes|Refs) #[0-9]+' | paste -sd' ' -)
  ISSUES+="$REFS "
  PROBLEMS=()
  [[ "$SUBJECT" =~ $RE_SUBJECT ]] || PROBLEMS+=("not <type>(<scope>): <summary> with type ${TYPES//|/, }")
  (( ${#SUBJECT} <= 72 )) || PROBLEMS+=("subject is ${#SUBJECT} chars; max 72")
  [[ "$SUBJECT" == *. ]] && PROBLEMS+=("trailing period")
  [[ "$SUBJECT" =~ $RE_FOLDER_SCOPE ]] && PROBLEMS+=("scope is a folder name; use the feature or area (tasks, search, ...)")
  [[ "$SUBJECT" =~ $RE_FIXUP ]] && PROBLEMS+=("fixup / WIP commit; squash it before the MR")
  if (( ${#PROBLEMS[@]} )); then
    fail "${h:0:7} $SUBJECT"
    printf '%s\n' "${PROBLEMS[@]}" | sed 's/^/- /' | indent
  else
    pass "${h:0:7} $SUBJECT"
  fi
  if [[ "$SUBJECT" =~ ^(feat|fix) && -z "$REFS" ]]; then
    warn "${h:0:7} is a feat/fix with no 'Closes #N' or 'Refs #N' in the body"
  fi
done
ISSUES=$(echo "$ISSUES" | grep -oE '#[0-9]+' | sort -u | paste -sd' ' -)
if [[ -n "$ISSUES" ]]; then
  info "issues referenced: $ISSUES"
elif [[ -n "$HASHES" ]]; then
  warn "no commit references an issue; the MR's Why section needs Closes #N for a code change"
fi

# --- Sync with the base ------------------------------------------------------
section "Up to date with $BASE"
BEHIND=$(git rev-list --count HEAD.."$BASE")
if (( BEHIND == 0 )); then
  pass "branch has every commit of $BASE"
# git 2.34 has no `merge-tree --write-tree`; the old 3-way form prints conflict markers instead.
elif git merge-tree "$BASE_SHA" HEAD "$BASE" | grep -q '^+<<<<<<<'; then
  fail "$BASE has $BEHIND new commit(s) that conflict with this branch; merge or rebase and resolve them"
else
  warn "$BASE has $BEHIND new commit(s); merge or rebase, then re-run the checks"
fi

# --- Working tree ------------------------------------------------------------
section "Working tree"
DIRTY=$(git status --porcelain -- .)
if [[ -n "$DIRTY" ]]; then
  warn "uncommitted changes in task-tracker/ are not in the MR, but the code checks below include them"
  echo "$DIRTY" | indent
else
  pass "no uncommitted changes in task-tracker/"
fi

# --- Scope -------------------------------------------------------------------
section "Scope"
CHANGED_ALL=$(git diff --name-only "$BASE_SHA" HEAD)
CHANGED=$(git diff --name-only --relative "$BASE_SHA" HEAD -- .)
OUTSIDE=$(echo "$CHANGED_ALL" | grep -v '^task-tracker/' | grep -v '^$' || true)
if [[ -n "$OUTSIDE" ]]; then
  warn "files outside task-tracker/ in this MR; keep notes and code in separate MRs unless they belong together"
  echo "$OUTSIDE" | indent
else
  pass "all changes are under task-tracker/"
fi
if echo "$CHANGED" | grep -qE '^(dist|node_modules|coverage)/'; then
  fail "build output or dependencies committed (dist/, node_modules/ or coverage/)"
fi
if echo "$CHANGED" | grep -qx 'package-lock.json' && ! echo "$CHANGED" | grep -qx 'package.json'; then
  warn "package-lock.json changed without package.json; was it changed by accident?"
fi
TODOS=$(git diff -U0 "$BASE_SHA" HEAD -- src public | grep -E '^\+[^+]' | grep -E '\b(TODO|FIXME|XXX)\b' || true)
if [[ -n "$TODOS" ]]; then
  warn "TODO / FIXME added; finish it or link a follow-up issue"
  echo "$TODOS" | indent
else
  pass "no TODO / FIXME added"
fi

# --- Docs and config ---------------------------------------------------------
section "Docs and config"
API=$(echo "$CHANGED" | grep -E '(\.controller\.ts$|/dto/[^/]*\.ts$)' | grep -vE '\.spec\.ts$' || true)
if [[ -z "$API" ]]; then
  pass "no controller or DTO change"
elif echo "$CHANGED" | grep -qx 'README.md'; then
  pass "README.md changed along with the controllers / DTOs; check its API table matches"
else
  warn "controllers or DTOs changed but README.md didn't; check its API table"
  echo "$API" | indent
fi
# Names only: never print values from .env.example.
NEW_ENV=$(git diff -U0 "$BASE_SHA" HEAD -- src | grep -E '^\+[^+]' | grep -oE 'process\.env\.[A-Z0-9_]+' | sed 's/^process\.env\.//' | sort -u)
for v in $NEW_ENV; do
  if grep -qE "^$v=" .env.example 2>/dev/null; then
    pass "$v is listed in .env.example"
  else
    warn "$v is used in src/ but not listed in .env.example"
  fi
done
if echo "$CHANGED" | grep -q '^public/'; then
  info "public/ changed: the MR needs before/after screenshots"
fi

# --- Code checks -------------------------------------------------------------
CODE_RESULT="skipped (--no-code)"
if [[ $RUN_CODE -eq 1 ]]; then
  section "Code checks: verify-changes/check.sh --base $BASE --build"
  CHECK=.claude/skills/verify-changes/check.sh
  if [[ ! -f "$CHECK" ]]; then
    fail "$CHECK not found"
    CODE_RESULT="not run"
  elif bash "$CHECK" --base "$BASE" --build; then
    CODE_RESULT="passed (its own warnings are listed above)"
  else
    FAILED=$((FAILED + 1))
    CODE_RESULT="FAILED (see above)"
  fi
fi

# --- Summary -----------------------------------------------------------------
section "Pre-PR summary"
echo "  Team checks: $FAILED failed, $WARNINGS warning(s)"
echo "  Code checks: $CODE_RESULT"
[[ $FAILED -eq 0 ]]
