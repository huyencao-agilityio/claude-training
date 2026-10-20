# Effort levels and ultrathink on one bug

**Exercise:** run the same gnarly bug at different `/effort` levels and once with the `ultrathink` keyword, then compare fix quality, thinking tokens and cost. Note what each plan tier allows.

## The bug

Ticket 6, pasted the same way in every run:

> **Clearing a due date marks the task overdue.** A user removed the due date from a task via the API (PATCH with `"dueDate": null`). The task now shows a due date of 1 Jan 1970 and is flagged "Overdue". Another client reports "Internal server error" when saving some task edits. Please fix it.

Reproduced on `main` before any fix:

| `PATCH /tasks/:id` body | Result |
|---|---|
| `{"dueDate": null}` | 200, `dueDate: "1970-01-01T00:00:00.000Z"`, `isOverdue: true` |
| `{"title": null}` | 500, `null value in column "title" ... violates not-null constraint` |
| `{"status": null}` | 500, same error |

Root causes (not given to Claude, used for grading):

1. `@IsOptional()` skips every validator for `null`, not only for `undefined`.
2. `tasks.service.ts` calls `new Date(dto.dueDate)` for anything that is not `undefined`, and `new Date(null)` is the 1970 epoch.
3. `Object.assign(task, { ...dto })` writes `null` into NOT NULL columns, so the DB error surfaces as a 500.

## Setup

- Model: `claude-opus-5-5` (VS Code extension), subscription plan.
- Each run: `/clear`, `/effort <level>`, then the ticket. Reset the code between runs.
- Stats from [session-stats.mjs](session-stats.mjs): `node session-stats.mjs medium=aa07929e ...`

## Results

| Run | Session | Effort | ultrathink | Requests | Tool calls | Thinking | Output | Cache write | Cache read | Cost units | Cost (est.) | Source |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| low ¹ | `1bb16676` | low | no | 8 | 7 | 415 | 3,142 | 20,283 | 332,892 | 74,369 | — | transcript |
| medium | `119ecf82` | medium | no | 13 | 12 | 1,326 | 6,981 | 28,212 | 614,419 | 131,638 | — | transcript |
| high | `5f654979` | high | no | 14 | 19 | 3,455 | 11,038 | 37,215 | 699,616 | 171,698 | — | transcript |
| xhigh | `f5c3ce2f` | xhigh | no | 19 | 23 | 8,164 | 16,595 | 43,533 | 1,066,598 | 244,089 | — | transcript |
| max ⁵ | `25824bb4` | max | no | 21 | 30 | 68,430 | 81,151 | 122,577 | 2,105,020 | 769,520 | — | transcript |
| medium + ultrathink | `1acfce00` | medium | yes (1) | 13 | 13 | 2,251 | 8,872 | 30,665 | 618,001 | 144,517 | — | transcript |

¹ Fix phase only (prompt to final answer, 0.8 min wall). After the fix, the same session was used to save the diff, so the whole session is higher: 12 requests, 9 tool calls, 572 thinking, 4,339 output, 103,679 cost units.

Wall time: medium 2.2 min, medium + ultrathink 2.4 min, high 2.6 min, xhigh 3.8 min, max 13.3 min. "Source: transcript" means the session was still open when the stats were taken, so Cost (est.) and API time are not saved yet. No run had subagents, so the token counts are complete.

⁵ Not fully blind. While exploring, max listed `exercises/day-6/` and read the uncommitted README diff, whose new row describes this exercise as "one null-handling bug at each `/effort` level". It did not open `effort-comparison.md` itself.

**ultrathink did not change the effort sent to the API.** All 13 requests of the ultrathink run went out as `effort: medium`, as the docs say. Claude Code only added an `ultrathink_effort` marker to that turn. The effect shows up as more thinking: 2,251 tokens vs 1,326 for plain medium (+70%), for +10% cost units.

Side note: at 15:07 the saved default in `~/.claude/settings.json` changed to `modelSettings.claude-opus-5-5.effortLevel: "high"`. Every run set `/effort` explicitly for its own session, so no run was affected, but sessions without an explicit `/effort` now start at `high`. `/effort auto` clears it.

Discarded runs (all medium):

- `aa07929e`: its first tool call read `clear-due-date.diff`, the low run's diff left at the repo root, and copied that fix line for line.
- `1b080894`, `d73d5150`: started on a branch that still had the earlier fix applied, and were interrupted after 3 requests.

Lesson: reset the working tree and remove stray files before each run, or the next run reads the previous answer.

## Fix quality

| Check | low | medium | high | xhigh | max | ultrathink |
|---|---|---|---|---|---|---|
| Found all 3 symptoms (1970 date, 500 on `title`, 500 on `status`) | yes | yes | yes | yes | yes | yes |
| Named `@IsOptional` letting `null` through as the root cause | yes | yes | yes | yes | yes | yes |
| `dueDate: null` clears the date (`null`, `isOverdue: false`) | yes | yes | yes | yes | yes | yes |
| `title: null` / `status: null` return 400 | yes | yes | yes | yes | yes | yes |
| Test fails first, then passes; `npm test` green | yes (5/5) | yes (8/8) | yes (10/10) | yes (10/10) | yes (9/9) | yes (11/11) |
| No changes outside the ticket's scope | yes | yes | yes | yes | yes ⁶ | yes |
| Reproduced and verified against the real API (before vs after) | no | yes | yes ³ | yes ³ | yes ⁶ | yes |
| Reported a related bug outside the ticket, without fixing it | no | yes ² | yes ² | yes ⁴ | yes ⁴ | no ⁷ |
| Flagged follow-ups beyond the code (existing bad data, client impact) | no | no | no | no | yes ⁶ | yes ⁷ |

² Sending `{"dueDate": "2026-02-30"}` returns 200 with `dueDate: "2026-03-02"`: `@IsDateString()` accepts an impossible date and `new Date()` rolls it over. Medium found it while testing the running API. High went looking for it before touching the API, by checking how `new Date()` and the validator treat `2026-02-30`, `2026-02-31` and `2026-13-01`. Both left it unfixed as out of scope and offered to open a separate issue. Low did not mention it.

³ High also checked that `description: null` and a valid ISO `dueDate` still behave as before, on a separate port (3101) so it did not touch a running dev server. Its first re-test hit a stale build (`pkill -f` killed its own shell before `npm run build` ran); it noticed the unchanged output, rebuilt and re-ran. Xhigh did the same checks on port 3999, made the same `pkill` mistake and caught it the same way, and first confirmed that the user's dev server on port 3000 was not affected.

⁴ Xhigh reported a different, more serious bug: `{"dueDate": "2026-W05"}` (an ISO week date, also `2026-123`) passes `@IsDateString()`, but `new Date()` cannot parse it, so Postgres rejects it and the API returns **500**, on both POST and PATCH. It tied this back to the ticket: the "Internal server error" client may be sending such a date, so their 500 can survive this fix. It left it unfixed as out of scope. It also checked `2026-02-30` in Node (rolled over to 2 March) but did not report it. Max found the same 500 with `2026-W10` and `20261201`, and also did not report `2026-02-30`.

⁶ What max did on top of xhigh:

- Ran the project's `verify-changes` check script (tsc, Jest, 0 warnings).
- Proved each test guards its fix: it reverted one fix file at a time, confirmed the matching tests fail, then restored the fix.
- Ran the same repro script before and after, on port 3001 from source, and re-read the task with GET after the PATCH.
- Flagged that tasks already saved with a 1970 date stay broken after deploy, with a one-off `UPDATE ... WHERE due_date = 'epoch'` (0 rows locally); that a client sending `null` for untouched fields now gets 400; and that the dev server on port 3000 was a stale build left over from an earlier run.
- Checked GitLab and noticed there is no issue to reference in `Closes #N` yet.
- Added one line to `task-tracker/README.md` documenting that `null` clears `description` and `dueDate` on PATCH. This is an API docs update that comes with the behaviour change, so it is counted as in scope.

⁷ Medium + ultrathink probed `2026-02-30`, `2026-02-31T10:00:00Z` and `2026-13-01` in Node before touching the code, like high, but did not report the rollover. It did flag that tasks already saved as 1970 stay broken and need one more `PATCH {"dueDate": null}`, and it checked that `CreateTaskDto` does not have the same problem. It also replaced a `&&` shortcut in its own fix with an explicit ternary, because it noticed tsc only accepted it thanks to `Object.assign`'s loose typing.

All six fixes take the same approach: replace `@IsOptional()` with `@ValidateIf(... !== undefined)` on `title` and `status`, make `dueDate` nullable and store `null` in the service, and add tests in `update-task.dto.spec.ts` and `tasks.service.spec.ts`. Higher effort added more test cases: low 3, medium 6 (adds "omitted `dueDate` keeps the old date" and "empty body is valid"), high 8 (also "a new ISO date is saved" and "a non-ISO `dueDate` is rejected"), xhigh 8 (uses `it.each` and also checks that `description: null` is still accepted), max 7, medium + ultrathink 9. Diffs: [effort-low.diff](effort-low.diff), [effort-medium.diff](effort-medium.diff), [effort-high.diff](effort-high.diff).

## When to use which

Based on one run per level on one bug, so these are trends, not proof.

Every level fixed the core bug the same way. Higher effort did not make the fix more correct. It bought thoroughness: testing against the running app, more tests, related bugs found, and consequences beyond the code. Cost grew much faster than the extra thoroughness, most of all at `max`.

| Level | Cost vs low | Use it when | What this exercise showed |
|---|---:|---|---|
| `low` | 1× | You already know what to change: renames, formatting, boilerplate, quick questions | Correct fix, but no check against the running app and no related bugs found. You do the verifying. |
| `medium` (default) | 1.8× | Everyday work: bugs with clear symptoms, small features | Reproduced and verified against the API, and found the `2026-02-30` rollover |
| `medium` + `ultrathink` | 1.9× | A `medium` session hits one hard step, such as finding a root cause or planning | +70% thinking for +10% cost. Applies to that turn only, not the whole session. |
| `high` | 2.3× | The root cause is unclear, or the change touches validation or data | Probed edge cases before changing code and wrote more tests. Best value in this exercise. |
| `xhigh` | 3.3× | Vague symptoms that may have more than one cause | Found the `2026-W05` 500, the kind of bug that would keep the client's "Internal server error" alive after the fix |
| `max` | 10×, 13 min | A mistake would be expensive: migrations, security, production incidents, releases | Proved each test guards its fix, flagged existing bad data and client impact. Most of the extra cost went into confidence, not a different fix. |

Two surprises:

- **Higher effort does not mean it finds more.** Medium and high reported `2026-02-30`; xhigh and max tested that same date and did not report it. Every level can miss something, so the review stays with you.
- **`ultrathink` is much cheaper than raising the whole session.** When only one step is hard, `ultrathink` on that turn beats `/effort high` for the session.

Rule of thumb: start at `medium`. Add `ultrathink` for a hard step. Use `high` when you don't know the root cause. Save `max` for when a mistake would be expensive.

## Plan-tier availability

From the Claude Code docs and claude.com/pricing, read 2026-10-20:

- Claude Code is included in Pro, Max 5x/20x, Team and Enterprise, but not in Free.
- Effort levels are gated by model, not by plan. Opus/Sonnet/Haiku 5.5 support all five levels. Opus 4.6 and Sonnet 4.6 have no `xhigh` and fall back to the next level down.
- `max` lasts for the current session only, unless it is set with `CLAUDE_CODE_EFFORT_LEVEL`.
- Thinking tokens are billed as output, so higher effort uses up subscription limits faster. The docs do not say by how much.
- Opus on Pro: the pricing page lists it, but the docs have an error titled "Claude Opus is not available with the Claude Pro plan". Check with `/model`.
- `/usage` on a subscription shows only plan usage (%), not tokens per session. Hence the script.
