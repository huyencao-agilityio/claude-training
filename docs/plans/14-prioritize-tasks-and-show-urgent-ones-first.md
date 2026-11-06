# Plan: Prioritize tasks and show urgent ones first

- Ticket: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/14
- Analysis: docs/analyze/14-prioritize-tasks-and-show-urgent-ones-first.md
- Branch: `feat/task-priority-tabs`
- Status: Implemented (2026-11-06; approved 2026-11-06)

## Context

Tasks have no priority, and the list is newest first with an "Overdue" badge. T2 adds a priority (High / Medium / Low, default Medium), orders every list High → Medium → Low and then newest first, and replaces the badge with three tabs (Active / Overdue / Done), plus a priority filter. Due dates become plain UTC calendar days (Q-51), so "overdue" starts at 00:00 UTC on the day after the due date. Decisions from the analysis: existing due dates are rounded once to the nearest 00:00 UTC and the seed writes 00:00 UTC; CSV export stays API only; on a tab switch, unapplied search and status edits are dropped (priority resets per Q-37). T3 (#15, Assignee) is not done, so the table has no Assignee column yet.

## AC → change

| AC | Behaviour change | Files | Unit test |
|---|---|---|---|
| AC2.1 | `priority` column, default `medium`; `create` maps `dto.priority ?? 'medium'`; form "Priority" after Description, Medium preselected | `task.entity.ts`, `dto/create-task.dto.ts`, `tasks.service.ts`, `public/index.html`, `public/app.js` | `tasks.service.spec.ts`: create without priority saves `medium` |
| AC2.2 | `@IsIn(TASK_PRIORITIES)` on create; the form sends the picked value | `dto/create-task.dto.ts`, `public/app.js` | `dto/task-title.dto.spec.ts` (renamed describe or new `create-task.dto.spec.ts`): `high`/`medium`/`low` accepted, `urgent`, `High`, `""` → 400; `auth.http.spec.ts`: admin `POST` with `priority: "urgent"` → 400 |
| AC2.3 | `priority` in `UpdateTaskDto`, **not** in `ADMIN_ONLY_FIELDS`, so a `user` may PATCH it; a Priority dropdown in every row for every user, saved like the status dropdown ("Saved", reload same tab / filters / page) | `dto/update-task.dto.ts`, `tasks.service.ts`, `public/app.js` | `tasks.service.spec.ts`: user PATCH `{ priority }` saves; user PATCH `{ priority, status }` → 403; `auth.http.spec.ts`: `alice` PATCH `{ priority: 'high' }` → 200, `{ priority: 'urgent' }` → 400 |
| AC2.4, AC2.5 | ORDER BY priority rank (high 0, medium 1, low 2), then `createdAt DESC`, `id DESC`, in the one query builder used by list and export | `tasks.service.ts` | `tasks.service.spec.ts`: order calls and their order; `tasks.service.db.spec.ts`: real order High/Medium/Low, newest first inside a level, stable across pages (limit 1) |
| AC2.6 | Row dropdown gets class `priority-<value>`; CSS sets text + background red / amber / green; class follows the picked value | `public/app.js`, `public/styles.css` | Manual (no UI test setup) |
| AC2.7 | `priority` query filter on list and export; "All priorities" / High / Medium / Low select in the filter row, applied on "Search" | `dto/task-filter.query.ts`, `tasks.service.ts`, `public/index.html`, `public/app.js` | `tasks.service.spec.ts`: `task.priority = :priority`; `list-tasks.query.spec.ts`: invalid priority → 400 |
| AC2.8, AC2.9, AC2.16 | `tab` query param: `active` = not done and (no due date or due date ≥ 00:00 UTC today); `overdue` = not done and due date < 00:00 UTC today; `done` = status done. Same rule for `isOverdue`. Due dates saved as 00:00 UTC of their UTC day; the form sends the picked day (`2026-03-20`), not local midnight | `dto/task-filter.query.ts`, `tasks.service.ts`, `public/app.js` | `tasks.service.spec.ts` with fake timers: SQL and `:todayStart` per tab; `isOverdue` false at 23:59:59 UTC on the due day and true at 00:00 UTC next day (TC-64); create/update with `2026-03-20` and `2026-03-20T15:00:00Z` save `2026-03-20T00:00:00.000Z`; `tasks.service.db.spec.ts`: AC2.8 / AC2.9 fixtures relative to today |
| AC2.10 | `tab=done` ignores `status`; UI hides the status filter on Done and doesn't send it | `tasks.service.ts`, `public/app.js` | `tasks.service.spec.ts`: `tab: 'done', status: 'todo'` adds no status condition |
| AC2.11 | `synchronize` adds `priority varchar(10) NOT NULL DEFAULT 'medium'`, filling existing rows; one-off `npm run fix:due-dates` rounds old due dates to the nearest 00:00 UTC | `task.entity.ts`, `tasks.service.ts`, `src/fix-due-dates.ts` (new), `package.json`, `task-tracker/CLAUDE.md` | `tasks.service.db.spec.ts`: rounding (19 Mar 17:00Z → 20 Mar, 20 Mar 05:00Z → 20 Mar, midnight and null unchanged, second run changes 0 rows) |
| AC2.12 | `priority` appended as the last CSV column (lowercase); export takes `tab` and `priority` like the list | `tasks-csv.ts`, `tasks.service.ts` (`RawTaskRow`, `fromRaw`) | `tasks-csv.spec.ts`, `tasks.controller.spec.ts`, `tasks.service.spec.ts`: header ends with `priority`, value `high`; export passes `tab` and `priority` to the same filters |
| AC2.13 | Tab click loads page 1 of that tab with the applied search / status / priority | `public/app.js`, `public/index.html` | Manual (TC-54) |
| AC2.14 | Status stays in the applied filters while on Done (only not sent), so it is back on Active | `public/app.js` | Manual (TC-66) |
| AC2.15 | On a tab click, a priority picked but not searched resets the select to "All priorities" and drops the priority filter; search and status inputs go back to their applied values (decision 3) | `public/app.js` | Manual (TC-67) |

## API contract

**`GET /tasks`** and **`GET /tasks/export`**, new and changed query params:

| Param | Values | Omitted | Invalid |
|---|---|---|---|
| `tab` | `active`, `overdue`, `done` | no tab condition (every task) | 400 `tab must be one of the following values: active, overdue, done` |
| `priority` | `high`, `medium`, `low` | every priority | 400 `priority must be one of the following values: high, medium, low` |
| `status` | unchanged (`todo`, `in_progress`, `done`) | — | unchanged; **ignored when `tab=done`** |
| `overdue` | **removed**, replaced by `tab`. The global pipe drops unknown params, so `?overdue=true` is now ignored | | |

- Order everywhere: `high`, `medium`, `low`; then `createdAt` newest first; then `id`.
- "Today" is the UTC day of the server clock. `overdue` = `status != done`, due date set and earlier than 00:00 UTC today.
- Export: same filters, no paging. Header `id,title,description,status,dueDate,isOverdue,createdAt,priority`.

**`POST /tasks`** (admin): optional `priority` (`high` | `medium` | `low`, default `medium`); other value → 400 `priority must be one of the following values: high, medium, low`. `dueDate`: any ISO date string; saved as 00:00 UTC of its UTC calendar day (`2026-03-20` and `2026-03-20T15:00:00Z` → `2026-03-20T00:00:00.000Z`).

**`PATCH /tasks/:id`**: optional `priority`, allowed for `user` and `admin`. A `user` sending `priority` together with an admin-only field still gets 403. Same `dueDate` rule as POST.

**Responses**: `TaskResponse` gains `priority`. `isOverdue` uses the new rule.

**New command**: `npm run fix:due-dates`: rounds every due date that isn't 00:00 UTC to the nearest 00:00 UTC and prints `Rounded <n> due date(s)`. Safe to run again (0 the second time). Run once after deploying.

## Data

- `Task.priority`: `varchar(10)`, `NOT NULL`, default `'medium'`; `TASK_PRIORITIES = ['high', 'medium', 'low'] as const` in `task.entity.ts` (same pattern as status). `synchronize: true` adds the column on the next start and fills existing rows with `medium`. No rename, drop or type change.
- `due_date` stays `timestamptz`; only the values change (00:00 UTC). Existing values are fixed by `npm run fix:due-dates`, not on start.
- Seed: due dates written as `YYYY-MM-DDT00:00:00Z` (the `VN_OFFSET_HOURS` / local-midnight helper goes); priorities spread with `pick(TASK_PRIORITIES, Math.floor(i / 3))`, so they don't line up with status (`i % 3`); the named tasks get one of each priority.

## Key code

1. **Day boundary and due-day helpers** (`tasks.service.ts`): one rule for SQL, `isOverdue` and saving, or the tab and the flag drift apart.
   ```ts
   const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
   // "2026-03-20" or any ISO timestamp -> 00:00 UTC of that UTC day (Q-51)
   const toDueDay = (value: string) => startOfUtcDay(new Date(value));
   // in toResponse
   const isOverdue = task.status !== 'done' && task.dueDate !== null && task.dueDate < startOfUtcDay(new Date());
   ```

2. **Tab, priority and order in `filteredQuery`** (`tasks.service.ts`): list and export share it, so AC2.12 "same tasks, same order" holds by construction. Rank via `addSelect` alias, so `skip/take` and `stream()` both work.
   ```ts
   const qb = this.tasks.createQueryBuilder('task')
     .addSelect("CASE task.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END", 'priority_rank')
     .orderBy('priority_rank', 'ASC')
     .addOrderBy('task.createdAt', 'DESC')
     .addOrderBy('task.id', 'DESC');
   const todayStart = startOfUtcDay(new Date());
   if (query.tab === 'done') qb.andWhere("task.status = 'done'");
   if (query.tab === 'active') qb.andWhere("task.status != 'done' AND (task.dueDate IS NULL OR task.dueDate >= :todayStart)", { todayStart });
   if (query.tab === 'overdue') qb.andWhere("task.status != 'done' AND task.dueDate < :todayStart", { todayStart });
   if (query.status && query.tab !== 'done') qb.andWhere('task.status = :status', { status: query.status });
   if (query.priority) qb.andWhere('task.priority = :priority', { priority: query.priority });
   ```

3. **Permission stays per field** (`tasks.service.ts`): `ADMIN_ONLY_FIELDS` keeps `title`, `description`, `dueDate`, `status`; `priority` is deliberately not added (comment updated to say so).

4. **Rounding existing due dates** (`TasksService.roundDueDatesToUtcDay()`, called by `src/fix-due-dates.ts`): a data write, so it is idempotent and tested on real PostgreSQL.
   ```sql
   UPDATE tasks
   SET due_date = date_trunc('day', (due_date AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'
   WHERE due_date IS NOT NULL
     AND due_date <> date_trunc('day', due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
   ```

5. **Tab switch in the UI** (`public/app.js`): the rules of AC2.13 to AC2.15 in one place. `appliedFilters` gains `tab`; `status` stays in it on Done and is only left out of the request.
   ```js
   function switchTab(tab) {
     const filters = new URLSearchParams(appliedFilters);
     filters.set('tab', tab);
     // Q-37: a priority picked without "Search" resets to "All priorities"
     if ((filterForm.elements.priority.value || null) !== appliedFilters.get('priority')) {
       filters.delete('priority');
     }
     loadTasks(1, filters); // on success: inputs show appliedFilters, status filter hidden on Done
   }
   // request params: on Done, status is not sent (AC2.10, AC2.14)
   ```

## Tests

- **Unit (`npm test`)**: as in the AC table. Update the tests that pin today's behaviour: overdue SQL and `overdue` param (`tasks.service.spec.ts:43-83`, `:188`; `list-tasks.query.spec.ts:10-25`; `tasks.controller.spec.ts:102-125`), the CSV header (three specs), the single `orderBy`/`addOrderBy` test (`tasks.service.spec.ts:101-112`), and the mocked query builder (add `addSelect`). Fake timers (`jest.useFakeTimers().setSystemTime(...)`) for every day-boundary test.
- **Real SQL (`npm run test:db`)**: order and paging, the three tabs with fixtures relative to the real today, the due-date rounding.
- **Type-check**: `npx tsc --noEmit`.
- **Left for QA / manual**: colors (TC-22), tab switching with filters and pages (TC-54, TC-66, TC-67), row priority change as `alice` and admin (TC-18, TC-19), due date across time zones (TC-78: browser at UTC+7 and UTC-5, e.g. `TZ=Asia/Ho_Chi_Minh` / `TZ=America/New_York` when launching the browser), clock move at 00:00 UTC (TC-64), start on an old database (TC-28), CSV from the API on the Overdue tab with `High` (TC-29).

## Out of scope and risks

- Out of scope: Assignee column and filter (T3, #15), an Export button (decision 2), priority set from the due date, notifications.
- `?overdue=` disappears from the API. Nothing in `public/` uses it, but any outside script that does now gets every task.
- Rounding guesses the creator's day: right for offsets UTC-11 to UTC+12; UTC+13/+14 move one day early, UTC-12 one day late (see Deviations 4). The script is manual: if it is not run, old Vietnam-made due dates stay one day early.
- `addSelect` rank alias with `getManyAndCount` + `skip/take`: TypeORM can mishandle ordering by an alias in some query shapes; the db spec on paging is the proof.
- "Today" is the server clock's UTC day; a wrong server clock moves tasks between Active and Overdue.

## Open questions

None.

## Deviations

1. **`UpdateTaskDto.priority` uses `@ValidateIf(value !== undefined)`, not `@IsOptional()`.** `@IsOptional()` lets `null` through, and the column is `NOT NULL`, so `{ "priority": null }` would be a 500. It is a 400 now (unit + HTTP test). `CreateTaskDto` keeps `@IsOptional()`: there `null` falls back to `medium`.
2. **A due date timestamp with no offset is read as UTC** (`"2026-03-20T03:00:00"` → 20 March). `@IsDateString()` accepts it, and `new Date()` would read it in the server's time zone (19 March on a UTC+7 host). Found by the code review; test added.
3. **`roundDueDatesToUtcDay()` keeps `updated_at`.** TypeORM would set it to now for every rounded row; a data fix is not an edit. Checked in the DB test.
4. **Risk line corrected:** the rounding gives back the picked day for offsets UTC-11 to UTC+12 (not UTC-11 to UTC+11); UTC+13/+14 land one day early, UTC-12 one day late.
5. **Existing DB search test:** its fixtures are saved with priority `high`. It relied on them being the newest tasks, which no longer puts them first when seeded `high` tasks match too ("rep" matches "Prepare …").
6. **`task-tracker/README.md`:** the new command, and the API table updated for `tab`, `priority`, export and the due-date rule (not listed in the plan's files).
