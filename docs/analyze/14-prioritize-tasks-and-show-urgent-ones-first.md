# Analysis: Prioritize tasks and show urgent ones first

- Issue: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/14
- Verdict: Ready

## Gaps

No blocking gaps. The ask is clear, AC2.1 to AC2.16 are Given/When/Then with exact values, there are no open questions or `[A-xx]` markers, and the Definition of Ready is fully checked. The one comment thread (Q-51) is answered and folded into the description as a business rule and AC2.16. Both dependencies are closed.

Non-blocking items for planning:

| # | Gap | Type (ask / AC / question / dependency / size) | Affects |
|---|---|---|---|
| 1 | Q-51 asked "what happens to existing tasks?" and the answer covers only new due dates. Answered in Decisions: round existing due dates to the nearest 00:00 UTC. | question | AC2.11, AC2.16 (answered) |
| 2 | AC2.12 says a user "on any tab with any filters" exports CSV, but the web UI has no Export button and the ticket's UI section adds none. Answered in Decisions: API only. | question | AC2.12 (answered) |
| 3 | Q-37 covers an unapplied priority change on a tab switch, not an unapplied search text or status. Answered in Decisions: the new tab uses the applied values. | question | AC2.13, AC2.14, AC2.15 (answered) |
| 4 | TC-24 expects "Task due tomorrow and task with no due date only" on the Active tab, but AC2.8 (and the rule "a task due today stays here until the day ends") also shows the task due today. Same text in v0.8 and v0.9 of the pack. AC2.8 applies. Noted on the issue (comment 2026-11-06); fixed in pack `v0.10`. | AC | TC-24 only (fixed) |
| 5 | TC-28 says "Run migration", but the app has no migrations: the schema comes from `synchronize: true`. The test step is "start the app on a database from before the change". Noted on the issue; fixed in pack `v0.10`. | AC | TC-28 wording (fixed) |
| 6 | The issue points to ticket pack `v0.9`. `HEAD` has `v0.8`, where the T2 text still says AC1.11 / AC1.12 instead of AC4.4 / AC4.5 and lists only T1 as a dependency. `v0.9` existed only in `stash@{0}` ("backup before merging github main"); it is now restored in the main checkout as `v0.10` (with the TC-24 / TC-28 fixes), uncommitted. The issue text is complete on its own and the T2 TC IDs are the same in every version. | dependency | Reading section 7 from a worktree until the pack is committed (non-blocking) |

## Dependencies

- #13 Login (T1): **closed** on 2026-11-05. Logged-in users and the session check.
- #16 Roles and task management (T4): **closed** on 2026-11-05. Who can create a task and change a field; the row save behaviour of AC4.4 and AC4.5.
- Not a dependency: #15 Assign a task to a person (T3) is **open**. The column order `Title | Priority | Status | Assignee | Due date | Actions` is the order after T2 and T3; without T3 there is no Assignee column.

## Facts from the repo

**Data and schema (AC2.1, AC2.2, AC2.11)**

- A task has no priority today: id, title, description, status, dueDate, createdAt, updatedAt (`task-tracker/src/tasks/task.entity.ts:13-34`). Status is a `varchar(20)` with a `TASK_STATUSES` `as const` list (`task-tracker/src/tasks/task.entity.ts:9-10`, `task-tracker/src/tasks/task.entity.ts:23-24`); a priority list follows the same pattern (`.claude/rules/code-structure.md`, "Enums").
- The schema comes from `synchronize: true` (`task-tracker/src/data-source.ts:15`); there are no migrations (`task-tracker/CLAUDE.md`). A new non-null column with a default is added on the next start and filled for existing rows, which is how AC2.11 is met.
- Stored as text, `high` / `low` / `medium` sort alphabetically, not High → Medium → Low, so AC2.4 needs an explicit rank in the ORDER BY.
- `CreateTaskDto` and `UpdateTaskDto` validate status with `@IsIn(TASK_STATUSES)` (`task-tracker/src/tasks/dto/create-task.dto.ts:16-18`, `task-tracker/src/tasks/dto/update-task.dto.ts:18-20`). The global pipe drops undecorated fields (`task-tracker/CLAUDE.md`), so `priority` needs `@IsIn` on both to reach the service and to give the `400` of AC2.2.
- `create` maps fields one by one and defaults status to `todo` (`task-tracker/src/tasks/tasks.service.ts:121-129`).

**Who may change it (AC2.3)**

- `POST /tasks` is admin only (`task-tracker/src/tasks/tasks.controller.ts:59-63`); `PATCH` is open to every logged-in user (`task-tracker/src/tasks/tasks.controller.ts:65-72`).
- The service rejects a `user` PATCH only when it sends a field in `ADMIN_ONLY_FIELDS` (`task-tracker/src/tasks/tasks.service.ts:32`, `task-tracker/src/tasks/tasks.service.ts:133-135`); the comment there already says T2 and T3 add fields a user may change. Leaving `priority` out of that list lets a `user` change it.
- In the UI only the admin gets a row dropdown (status); a user sees status as text (`task-tracker/public/app.js:133-135`). The row `change` listener only handles `select.row-status` (`task-tracker/public/app.js:310-327`); it shows "Saved" and reloads the same page with the same filters (`task-tracker/public/app.js:98-102`, `task-tracker/public/app.js:319-322`). A priority dropdown for every user can reuse that path.

**Order (AC2.4, AC2.5)**

- One query builder serves the list and the CSV, ordered `createdAt DESC, id DESC` (`task-tracker/src/tasks/tasks.service.ts:84-90`). Putting the priority rank first there gives the same order on every tab and in the export.

**Tabs and the overdue rule (AC2.8, AC2.9, AC2.10, AC2.16)**

- The list has no tabs; filtering takes `search`, `status` and `overdue` (`task-tracker/src/tasks/dto/task-filter.query.ts:6-21`). `overdue=false` keeps done tasks (`task-tracker/src/tasks/tasks.service.ts:104-108`), so the Active tab ("not done and not overdue") is not today's `overdue=false`.
- Overdue today is `status != 'done' AND dueDate < now` in SQL (`task-tracker/src/tasks/tasks.service.ts:100-103`) and the same rule in `toResponse` for `isOverdue` (`task-tracker/src/tasks/tasks.service.ts:155-159`). With a due date stored as 00:00 UTC, a task due today is overdue from the start of today, which contradicts AC2.8 ("due today" stays on Active) and AC2.9 (overdue from 00:00 UTC the next day). Both places change.
- Existing tests pin today's overdue SQL (`task-tracker/src/tasks/tasks.service.spec.ts:49-66`) and the `overdue` query param (`task-tracker/src/tasks/dto/list-tasks.query.spec.ts:10-25`, `task-tracker/src/tasks/tasks.controller.spec.ts:102-125`).
- The web app saves a due date as the creator's local midnight (`task-tracker/public/app.js:56-60`, used at `task-tracker/public/app.js:279` and `task-tracker/public/app.js:370`) and shows the UTC day of the stored value (`task-tracker/public/app.js:62-64`, `task-tracker/public/app.js:242`). A task due 20 March picked at UTC+7 is stored as 19 March 17:00 UTC and shown as 19 March. AC2.16 changes the save to 00:00 UTC of the picked day.
- The seed writes local-midnight due dates on purpose, half of them at UTC+7 (`task-tracker/src/seed.ts:12-19`, `task-tracker/src/seed.ts:33-47`).

**Filters and tabs in the UI (AC2.7, AC2.13 to AC2.15)**

- The filter row has search and a status filter that still lists "Done" (`task-tracker/public/index.html:71-80`). The ticket removes "Done" from it.
- Filters are read from the form only on "Search" and kept in `appliedFilters`; Prev / Next page through the applied filters, not the form (`task-tracker/public/app.js:44-54`, `task-tracker/public/app.js:395-398`). A tab switch can load page 1 with `appliedFilters` plus the tab.
- On logout or session expiry the filters and page reset (`task-tracker/public/app.js:406-425`); a tab state belongs in that reset too.

**Table and colours (AC2.6)**

- Header today: `Title | Status | Due date | (badge) | Actions` (`task-tracker/public/index.html:86`). The "Overdue" badge cell (`task-tracker/public/app.js:146`) is removed by the ticket. The empty-list colspan is hard-coded to 5 / 4 (`task-tracker/public/app.js:232-235`) and follows the column count.
- The empty-list text is already "No tasks match these filters." (`task-tracker/public/app.js:235`).
- `styles.css` is 38 lines with no priority colours yet.

**CSV export (AC2.12)**

- `GET /tasks/export` takes `TaskFilterQuery` and streams rows from the same query builder as the list (`task-tracker/src/tasks/tasks.controller.ts:37-52`, `task-tracker/src/tasks/tasks.service.ts:53-70`). New filters on `TaskFilterQuery` reach both.
- The stream reads raw rows, so a new column must be added to `RawTaskRow` and `fromRaw` (`task-tracker/src/tasks/tasks.service.ts:18-26`, `task-tracker/src/tasks/tasks.service.ts:72-82`) as well as `CSV_COLUMNS` and `toRow` (`task-tracker/src/tasks/tasks-csv.ts:3-11`, `task-tracker/src/tasks/tasks-csv.ts:31-41`).
- The CSV header `id,title,description,status,dueDate,isOverdue,createdAt` is pinned in three specs (`task-tracker/src/tasks/tasks-csv.spec.ts:5`, `task-tracker/src/tasks/tasks.controller.spec.ts:11`, `task-tracker/src/tasks/tasks.service.spec.ts:153`).
- The web UI has no export button (no `export` or `csv` in `task-tracker/public/`).

**Past work on the same area**

- `dab6d27` CSV export (#2), `0ee0d2e` pagination, `2124bbb` login (#13), `3d17831` roles (#16, analysis in `docs/analyze/16-roles-and-task-management.md`).

## Decisions

| Question | Recommendation | Answer |
|---|---|---|
| Existing due dates that aren't 00:00 UTC (stored as the creator's local midnight): what happens to them? | Round each to the nearest 00:00 UTC once, and make the seed write 00:00 UTC: it gives back the day the creator picked for any offset from UTC-11 to UTC+11. | Round to the nearest 00:00 UTC (one-off fix); the seed writes 00:00 UTC |
| AC2.12: add an Export CSV button to the UI? | No: the UI section lists no button, and `GET /tasks/export` with the same tab and filters as the list meets the AC and TC-29. | API only, no button |
| On a tab switch, which search text and status apply when they were changed without "Search"? | The applied ones, and the fields go back to the applied values: keeps "filters apply only on Search", with priority as the one exception (Q-37). | Use the applied values |

## Runs

| Date | Verdict | Change |
|---|---|---|
| 2026-11-06 | Ready | First analysis; three decisions answered (existing due dates, export button, unapplied search / status on tab switch) |
| 2026-11-06 | Ready | Gaps 4 and 5 noted on the issue and fixed in ticket pack `v0.10`; gap 6: `v0.9` restored from the stash as `v0.10` |
