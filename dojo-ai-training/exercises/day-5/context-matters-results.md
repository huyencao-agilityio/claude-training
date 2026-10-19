# Context matters: results

**Exercise:** prove context matters. Run the same task in a fresh session and in a session that has already read the codebase, then compare quality and token use.

## Setup

| | T3-A fresh | T3-B primed |
|---|---|---|
| Session | `53fef350-d011-4347-b808-05731882efe2` | `55d970a4-3c57-4497-bbf8-49b88732f722` |
| Branch | `fix/due-date-timezone` | `fix/due-date-calendar-day` |
| Prompt 1 | Ticket 3 (pasted) | "Read the task-tracker codebase … explain the architecture … don't change any code" |
| Prompt 2 | none | Ticket 3 (pasted, same text) |
| Result diff | [t3-a.diff](t3-a.diff) | [t3-b.diff](t3-b.diff) |

Task, identical in both sessions:

> **Ticket 3 — Due dates show up one day early.** A user in Vietnam set a task's due date to 20 March, but the task list shows 19 March. A colleague in the UK sees the correct date. Some tasks are flagged as overdue a day too early. Please fix the date display.

## Token use

| | A fresh | B phase 1 (read code) | B phase 2 (fix) | B total |
|---|---:|---:|---:|---:|
| Total tokens | 1,229,880 | 145,791 | 1,717,445 | 1,863,236 |
| of which cache read | 1,169,040 (95%) | 117,276 | 1,654,691 | 1,771,967 (95%) |
| Cache write | 45,960 | 24,573 | 43,811 | 68,384 |
| Output | 14,840 | 3,936 | 18,901 | 22,837 |
| Context at end | 73,089 | 53,479 | 97,290 | |
| Tool calls | 20 | 2 | 21 | 23 |
| Minutes | 4.9 | 0.7 | 6.2 | 6.9 |
| **Cost units** ¹ | **~249k** | ~62k | ~315k | **~377k (1.5× A)** |

¹ Input-token equivalents at Anthropic's relative prices: input ×1, cache write ×1.25, cache read ×0.1, output ×5. "Total tokens" overstates cost because 95% is cheap cache reads.

What the numbers say:

- **Priming did not save tokens.** B's fix phase alone cost more than all of A (~315k vs ~249k units), and B overall cost 1.5× A.
- **Priming did not save exploration.** B phase 2 still made 21 tool calls (A: 20) and re-read the entity, service, DTOs and tests. Phase 1 was a broad architecture tour; the fix needed exact lines, so Claude read them again.
- **The larger starting context made every later turn more expensive.** B started the fix with ~53k tokens already in context and ended at 97k (A: 73k). Each tool call re-sends that context as cache reads.
- **B wrote more** (18.9k vs 14.8k output tokens in the fix phase), which matches its larger test suite below.

## Quality

Both sessions found the same root cause and the same core fix:

- Root cause: the frontend turns the picked date into local midnight (`toIsoDate`), so 20 March in UTC+7 is stored as `2026-03-19T17:00:00Z` in a `timestamptz` column, then displayed with `iso.slice(0, 10)`.
- Fix: store `due_date` as a Postgres `date` (`string` in the entity), send and display `YYYY-MM-DD` unchanged, validate it with `@Matches` + `@IsISO8601({ strict: true })`, compare dates as strings for `isOverdue`, and drop the timezone simulation from `seed.ts`.
- `public/app.js`, `seed.ts`, both DTOs, `task.entity.ts` and the create/update lines in `tasks.service.ts` are identical in the two diffs.

Where they differ:

| | A fresh | B primed |
|---|---|---|
| When a due date becomes overdue | End of the day in UTC (hard-coded) | End of the day in `DUE_DATE_TIMEZONE` (default UTC), new entry in `.env.example` |
| DTO tests | 3 cases in `create-task.dto.spec.ts` (file name says "create" but it also tests `UpdateTaskDto`) | 6 cases in `task-dto.spec.ts`: also rejects a `+07:00` timestamp and the formats `20-03-2026`, `2026-3-20` |
| Service tests | 4: create, overdue on/after the due date, done task | 8: create, **update**, **update keeps the date when not sent**, overdue boundaries (23:59 / 00:00 / day before), timezone setting, done task |
| Code style | Fits the codebase | Reads `process.env` directly in the service; the app has no config module, so this matches how `data-source.ts` reads env |

Gaps in both:

- **No data migration.** `synchronize: true` changes the column from `timestamptz` to `date` on startup. TypeORM may drop and recreate the column (losing existing due dates), and any value it keeps that was saved from UTC+7 stays one day early. Neither diff mentions this, which is acceptable for a dev seed but should be in the MR's Risk section.

**Verdict on quality:** B is clearly better. The core fix is the same, but B proves it more thoroughly:

- A has no test for `update()`, although the diff changes its `dueDate` line. A bug there, such as clearing the due date on an update that doesn't send one, would pass A's tests.
- A doesn't test the overdue boundary. The ticket is an off-by-one-day bug, so the 23:59 / 00:00 cases in B are the tests that show it is gone.
- A hard-codes UTC, so a task due 20 March only becomes overdue at 07:00 on 21 March in Vietnam. B can set `DUE_DATE_TIMEZONE`.

## Conclusion

- **Context improved quality and cost more.** Priming gave a clearly more thorough result (+4 service tests, update path covered, overdue boundary tested, configurable overdue timezone) for ~1.5× the cost and +2 minutes.
- **The A session was not really context-free.** Both sessions loaded the same `CLAUDE.md` files, skills and GitLab issue (both called `AskUserQuestion`, `Skill` and `mcp__gitlab__list_issues` once). That shared project context is probably why A already got the root cause right, and why the gap is small.
- **Broad priming is the wrong kind of context for a focused bug.** An architecture tour fills the context window but doesn't replace reading the exact lines. More useful: a short pointer in the prompt ("due date is stored in `task.entity.ts`, sent from `public/app.js`"), or `CLAUDE.md` notes that persist across sessions.
- **Lesson:** context that matters is *relevant* context. The project's `CLAUDE.md` gives it to every session at low cost; a broad "read the whole codebase" pass costs tokens on every later turn and pays off only when the follow-up task really spans the whole app.

## Limits of this comparison

- One run per variant. Claude's output varies between runs, so a difference of a few tool calls or tests could be noise.
- "Files edited (Edit/Write): none" in the raw stats is wrong in practice: both sessions changed files through `Bash` (auto mode), which the script doesn't count as edits.
- "Files read" comes from a regex on tool arguments, so files read via globs (e.g. `cat src/tasks/*`) are missed. B phase 1 likely read more than the 6 files listed.
- The script records the branch that is checked out when it runs, not the session's branch.

## Appendix: raw session stats

Generated by `session-stats.py`.

### T3-A fresh

| Phase | Total tokens | Output | Context at end | Tool calls | Files referenced | Minutes |
|---|---|---|---|---|---|---|
| 1 | 1,229,880 | 14,840 | 73,089 | 20 | 10 | 4.9 |
| **Sum** | **1,229,880** | **14,840** |  | **20** |  | **4.9** |

Phase 1 (ticket 3):

- Tokens: input 40, cache write 45,960, cache read 1,169,040, output 14,840
- Tool calls: AskUserQuestion 1, Bash 16, Skill 1, ToolSearch 1, mcp__gitlab__list_issues 1
- Files read: public/app.js, src/data-source.ts, src/main.ts, src/seed.ts, src/tasks/dto/create-task.dto.spec.ts, src/tasks/dto/create-task.dto.ts, src/tasks/dto/update-task.dto.ts, src/tasks/task.entity.ts, src/tasks/tasks.service.spec.ts, src/tasks/tasks.service.ts
- Files edited (Edit/Write): none

### T3-B primed

| Phase | Total tokens | Output | Context at end | Tool calls | Files referenced | Minutes |
|---|---|---|---|---|---|---|
| 1 | 145,791 | 3,936 | 53,479 | 2 | 6 | 0.7 |
| 2 | 1,717,445 | 18,901 | 97,290 | 21 | 8 | 6.2 |
| **Sum** | **1,863,236** | **22,837** |  | **23** |  | **6.9** |

Phase 1 (read the codebase):

- Tokens: input 6, cache write 24,573, cache read 117,276, output 3,936
- Tool calls: Bash 2
- Files read: public/app.js, public/index.html, src/app.module.ts, src/data-source.ts, src/main.ts, src/seed.ts
- Files edited (Edit/Write): none

Phase 2 (ticket 3):

- Tokens: input 42, cache write 43,811, cache read 1,654,691, output 18,901
- Tool calls: AskUserQuestion 1, Bash 17, Skill 1, ToolSearch 1, mcp__gitlab__list_issues 1
- Files read: public/app.js, src/seed.ts, src/tasks/dto/create-task.dto.ts, src/tasks/dto/task-dto.spec.ts, src/tasks/dto/update-task.dto.ts, src/tasks/task.entity.ts, src/tasks/tasks.service.spec.ts, src/tasks/tasks.service.ts
- Files edited (Edit/Write): none
