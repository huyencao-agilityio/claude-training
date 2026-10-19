---
name: verify-changes
description: Verify the current task-tracker changes before saying the work is done or opening an MR - run type-check, tests and diff rules with check.sh, confirm a bug-fix test fails without the fix, review the diff and smoke-test the API. Use when the user asks to verify, check, validate or double-check changes, or after finishing a fix or feature.
argument-hint: "[base ref, default main] [--build]"
---

# Verify changes

Arguments: `$ARGUMENTS`. The first word that isn't a flag is the base branch (default `main`); pass `--build` through to `check.sh`. All diffs start at the merge-base with the base branch (`git merge-base <base> HEAD`), so commits added to the base after branching aren't part of the change. Detailed rules, the meaning of each check and an example report are in [reference.md](reference.md). Read it when a check fails or before the manual review.

## Steps

1. **See the change.** `git status` and `git diff $(git merge-base <base> HEAD) -- .` (from `task-tracker/`). Note which areas changed: `src/` service/controller, DTOs, entity, specs, `public/`.

2. **Run the automated checks.**

   ```bash
   bash .claude/skills/verify-changes/check.sh --base <base>          # add --build before an MR
   ```

   It prints PASS / WARN / FAIL per check and exits non-zero if anything failed. Don't hide or re-word failures; copy the real output into the report.

3. **Prove the test covers the change** (bug fixes). Reverse the fix in the source file only, run the new test, and confirm it fails; then re-apply the fix. Run it as **one** Bash call so the fix is always restored, even when the test fails:

   ```bash
   P="$(git rev-parse --git-dir)/verify-fix.patch"
   git diff "$(git merge-base <base> HEAD)" -- <fixed source file> > "$P"
   [ -s "$P" ] || { echo "no diff in that file vs base"; exit 1; }
   git apply -R "$P" &&
   { npm test -- <spec file> -t "<test name>"; echo "without fix: exit $?"; }   # must be non-zero
   git apply "$P" && echo "fix restored"
   npm test -- <spec file> -t "<test name>"; echo "with fix: exit $?"           # must be 0
   ```

   - The patch covers both committed and uncommitted changes to that file, and re-applying it restores both. Don't use `git stash`: with a committed fix it saves nothing and `pop` applies an older, unrelated stash.
   - Only reverse the source file, never the spec.
   - Check `fix restored` was printed. If `git apply` failed, stop and tell the user; the patch is still in `.git/verify-fix.patch`.
   - If the fix lives in a new file, there is nothing to reverse; say the step was skipped and why.
   - If the test passes without the fix, it doesn't test the bug: say so.

4. **Review the diff** against the manual rules in `reference.md` (PATCH semantics, NotFound, nullable fields, dates, parameterized queries, frontend errors, scope). For a large diff, delegate to the `code-reviewer` agent with the list of changed files.

5. **Smoke-test** only if the API or `public/` changed: `npm run db:up`, start `npm run start:dev` in the background, run the curl commands from `reference.md` plus one request that exercises the change, then stop the server.

## Report

Use the format in `reference.md`: automated results, fail-without-fix evidence, review findings (separate pre-existing bugs from the change), smoke-test responses, and a verdict (`ready for MR` or what still needs fixing). Don't fix anything during verification unless the user asks; list it instead.
