---
name: pre-pr
description: Self-review the current task-tracker branch against the team's pre-MR checklist before a merge request is opened - branch name, commit messages and issue links, sync with main, MR scope, docs and env vars, tests that prove the change, code conventions, plus type-check, tests and build. Reports what is missing; doesn't fix it or open the MR. Use when the user is about to open a PR/MR, asks to check their code before a PR, or asks whether anything was missed.
argument-hint: "[base ref, default origin/main]"
---

# Pre-PR check

Base: `$ARGUMENTS`, default `origin/main`. All diffs start at `git merge-base <base> HEAD`.

The goal is a list of what to fix before opening the MR. Don't fix anything, commit, push or open the MR during the check; fix items only when the user asks afterwards.

## 1. Run the automated checklist

From `task-tracker/`:

```bash
git fetch origin main
bash .claude/skills/pre-pr/pre-pr.sh --base origin/main
```

It checks branch name, commit messages, issue links, sync and conflicts with the base, MR scope, README and `.env.example`, then runs `verify-changes/check.sh --build` (diff rules, `tsc`, `jest`, build). Copy the real PASS / WARN / FAIL lines into the report; don't drop or reword any.

## 2. Check the change against its issue

Take the issue from the commits (`Closes #N` / `Refs #N`) or the conversation and read it with `mcp__gitlab__get_issue` (project `huyen.cao/claude-training`). For each expectation or acceptance criterion, say whether the diff meets it and where (`file:line`). If no issue is linked or GitLab is unreachable, say so under "Not checked".

## 3. Check the tests prove the change

- **Bug fix**: run the fail-without-fix step from `.claude/skills/verify-changes/SKILL.md` (step 3) and report both runs. A test that passes without the fix doesn't count.
- **Feature**: list the edge cases and validation errors from the issue and the test that covers each. Name each missing case as input → expected result.
- No test deleted, skipped or loosened to make it pass.

## 4. Review the diff against the team checklist

```bash
git diff $(git merge-base origin/main HEAD)..HEAD -- .
```

| Area | What to check | Rules in |
|---|---|---|
| Structure | Thin controller, logic in the service, file and class names, DTO decorators, entity rules, specs next to the code | `how-we-structure-modules` skill |
| API and data | PATCH only changes sent fields, `NotFoundException`, `ParseUUIDPipe`, 204 on DELETE, `toResponse`, `null` handling, `timestamptz` dates, parameterized queries | `verify-changes/reference.md`, "Manual review rules" |
| Scope | Only what the issue asks; no intentional bug fixed on the side; no drive-by refactor or reformatting; unrelated files left out | `CLAUDE.md` |
| Docs | README API table matches the controllers and query DTOs; new env vars in `.env.example`; comments still true after the change | |
| Frontend | If `public/` changed: `fetch` errors shown to the user, list refreshes after create / update / delete; the MR needs before/after screenshots | |
| Leftovers | `console.log`, `TODO` / `FIXME`, commented-out code, `.only` / `.skip` | |
| Data | Only made-up sample data; no keys, tokens or real customer data | root `CLAUDE.md` |

If the diff touches more than a few files in `src/` or is over about 300 lines, also run the `code-reviewer` agent with the diff and merge its findings into the report, without repeating the same finding twice.

A bug you notice in code the diff didn't touch is **pre-existing**: list it separately. It doesn't block the MR, and this repo has intentional bugs.

## 5. Report

```markdown
## Pre-PR check: <branch>

**Verdict:** Ready for MR | Ready after small fixes | Fix before MR (<N> items)

### Must fix before MR
- [ ] <what is wrong> (`file:line` or commit hash): <why it matters>. Fix: <short suggestion>

### Should fix
- [ ] ...

### Passed
- <one line per area: branch, commits, sync, scope, docs, tsc, jest (N passed), build, tests prove the change, issue criteria, conventions>

### Not checked
- <what was skipped and why, e.g. "GitLab unreachable: issue criteria not checked">

### Pre-existing (not part of this MR)
- <bug outside the diff, `file:line`>
```

- **Must fix**: any script FAIL, an unmet issue criterion, a bug fix without a test that fails first, a scope violation, secrets or `.env`, a Critical or Major finding from `code-reviewer`.
- **Should fix**: script WARNs and Minor findings. If a WARN is fine in this case, say why and move it to Passed.
- **Verdict**: "Fix before MR" if anything is under Must fix; "Ready after small fixes" if only Should fix; otherwise "Ready for MR".

End by asking whether to fix the Must-fix items. When the branch is ready, suggest the `create-pull-request` skill; its "How tested" section can reuse these results.
