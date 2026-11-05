---
name: verify-changes
description: Verify the current task-tracker changes before saying the work is done or opening an MR - run type-check, tests and diff rules with check.sh, confirm a bug-fix test fails without the fix, review the diff and smoke-test the API. Use when the user asks to verify, check, validate or double-check changes, or after finishing a fix or feature.
argument-hint: "[base ref, default main] [--build]"
---

# Verify changes

Report real output only, and don't fix anything during verification unless the user asks; list it instead. Rules behind each check, the smoke test and the report format are in [reference.md](reference.md).

Arguments: `$ARGUMENTS`. The first word that isn't a flag is the base branch (default `main`). Diffs start at `git merge-base <base> HEAD`. Run everything from the app folder of the current checkout (works in a worktree too):

```bash
cd "$(git rev-parse --show-toplevel)/task-tracker"
```

## Steps

1. **See the change:** `git status` and `git diff $(git merge-base <base> HEAD) -- .`. Note the areas changed: service/controller, DTOs, entity, specs, `public/`.
2. **Automated checks:** prints PASS / WARN / FAIL per check; copy failures as they are.
   ```bash
   bash ../.claude/skills/verify-changes/check.sh --base <base>   # add --build before an MR
   ```
3. **Bug fix: prove the test fails without the fix.** One Bash call, so the fix is always restored. Reverse only the source file, never the spec; don't use `git stash`.
   ```bash
   P="$(git rev-parse --git-dir)/verify-fix.patch"
   git diff "$(git merge-base <base> HEAD)" -- <fixed source file> > "$P"
   [ -s "$P" ] || { echo "no diff in that file vs base"; exit 1; }
   git apply -R "$P" &&
   { npm test -- <spec file> -t "<test name>"; echo "without fix: exit $?"; }   # must be non-zero
   git apply "$P" && echo "fix restored"
   npm test -- <spec file> -t "<test name>"; echo "with fix: exit $?"           # must be 0
   ```
   If `fix restored` isn't printed, stop and tell the user (the patch is in `$P`). If the fix is in a new file, say the step was skipped. If the test passes without the fix, it doesn't test the bug: say so.
4. **Review the diff** against the manual rules in `reference.md`. For a large diff, use the `code-reviewer` agent.
5. **Smoke-test** only if the API or `public/` changed (commands in `reference.md`).

## Report

Automated results, fail-without-fix evidence, review findings (pre-existing bugs listed apart from the change), smoke-test responses, and a verdict: `ready for MR` or what still needs fixing.
