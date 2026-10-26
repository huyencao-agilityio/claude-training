# `/code-review` vs `/code-review ultra` on one diff

**Exercise:** run `/code-review` and `/code-review ultra` on the same diff in two fresh sessions, then compare the signal: which findings both caught, which only one caught, and whether those extra findings are real.

## The diff

Uncommitted working-tree changes on branch `feat/export-tasks-csv`, on top of commit `80bfed5` (`feat(tasks): export filtered tasks as CSV`). 9 files, +89 / −30:

- [task-tracker](../../../task-tracker): `tasks.service.ts`, `tasks.controller.ts`, `tasks-csv.ts`, their three specs, `seed.ts`
- Claude setup: `.claude/settings.json` (PostToolUse prettier hook) and `.claude/hooks/block-dangerous-bash.sh`

Line numbers below refer to that working tree, not to `main`.

## Setup

- Model: `claude-opus-5-5` (VS Code extension), subscription plan.
- Each run: `/clear`, then the command with no other prompt. Same working tree for both runs.
- Results taken from the local Claude Code session transcripts.

| Run | Session | Wall time | Findings | Ran code to verify | Summary up front |
|---|---|---:|---:|---|---|
| `/code-review` | `6e3e049b` | ~36 s | 10 | no, reasoned from the code | no |
| `/code-review ultra` | `ec05d9cb` | ~69 s | 13 | yes: `setHeader` with a Vietnamese filename, `escapeCsvCell('-1, 2')`, `Number(null) < Date.now()` | yes: "80bfed5 was mostly sound; tests pass 98/98 only because the cases that catch these bugs were deleted or weakened" |

Wall time is from submitting the command to the output, read from the transcript timestamps.

## Findings both runs caught

| Finding | Plain # | Ultra # |
|---|---:|---:|
| `exportCsv` computes `isOverdue` as `Number(task.dueDate) < Date.now()`: `null` due dates and `done` tasks are exported as overdue | 1 | 1 |
| Formula-guard apostrophe is added outside the quotes, so the field is no longer RFC 4180 and columns shift | 2 | 3 |
| Raw `search` goes into `Content-Disposition`: 500 on `?search=Tiếng`, filename parameter injection | 3 | 2 |
| `NEEDS_QUOTES` lost `\r`, so a lone carriage return splits the row | 4 | 4 |
| Export silently capped at `EXPORT_MAX_ROWS = 1000`, comment still says "every task" | 5 | 5 |
| `.orderBy('task.updatedAt')` replaces the createdAt / id order and its tie-break | 6 | 6 |
| Filename logic in the controller breaks the task-tracker CLAUDE.md rule "controllers only call the service" | 7 | 9 |
| PostToolUse hook runs unpinned `npx prettier` on every edit; `xargs` splits paths with spaces | 9 | 8 |
| DROP TABLE guard greps the whole command line, so it blocks harmless commands | 10 | 12 |

9 of the plain run's 10 findings are also in the ultra run, with nearly the same failure scenarios.

Ranking differs: ultra puts the header injection (#2) above the CSV quoting bug (#3). That order makes more sense, because the header bug gives a 500 and lets an outsider pick the download filename.

## Findings only one run reported

Each one was checked against the working tree.

| Finding | Run | Checked | Signal |
|---|---|---|---|
| `seed.ts` adds an unrelated "Team retro" task and a full reformat, outside the export scope | ultra #11 | ✅ the diff adds `title: 'Team retro'` | High: the MR would carry unrelated changes |
| The spec `keeps the list order` still passes although the order is wrong | ultra #6 (extra detail) | ✅ [tasks.service.spec.ts](../../../task-tracker/src/tasks/tasks.service.spec.ts#L178-L183) only asserts `toHaveBeenCalledWith('task.createdAt')`, which `filteredQuery` calls before `exportCsv` overrides it | High: a green test that guards nothing |
| The `seed.ts` reflow comes from the prettier hook | ultra #8 (extra detail) | plausible | Medium: links a cause to its effect |
| The DROP guard misses `TRUNCATE` and `DROP SCHEMA` | ultra #12 (extra detail) | ✅ | Medium |
| `exportCsv` skips `this.toResponse`, which breaks the CLAUDE.md rule "Services return `TaskResponse`" | ultra #10 | ✅ | Low: same root cause as #1 |
| `FORMULA_PREFIX` leaves out tab and CR | ultra #13 | ✅ but [tasks-csv.ts](../../../task-tracker/src/tasks/tasks-csv.ts#L19) is unchanged from `80bfed5`; ultra itself says so | Low for this diff: not introduced by it |
| Edge-case tests were deleted instead of fixed, which breaks the CLAUDE.md test rule | plain #8 | ✅ | Ultra did not lose this: it mentions the deleted test in each finding and in its summary |

## Takeaways

Based on one run each on one diff, so these are trends, not proof.

- **The core signal was nearly the same.** The plain run caught every real bug the diff introduced.
- **Ultra was more trustworthy and went deeper.** It ran code to confirm its main claims, found a test that passes without protecting anything, and caught the out-of-scope `seed.ts` change. These are the things to know before opening an MR.
- **Ultra was also slightly noisier.** 2 of its 13 findings are not new bugs in this diff: #10 restates #1 and #13 existed before.
- **Cost:** about 2× the wall time for that extra depth.

| Command | Use it when |
|---|---|
| `/code-review` | Quick check during development, small diffs |
| `/code-review ultra` | Last review before opening an MR, or a diff that touches security (headers, CSV injection) like this one |
