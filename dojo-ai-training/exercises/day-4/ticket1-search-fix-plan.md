# Plan: Ticket 1 — Search doesn't find tasks that obviously exist

## Context

Users search `report` and get nothing back, although "Monthly Report" and "Weekly Report" exist. Goal: search finds tasks by title regardless of letter case, and other input problems found in the same code path are fixed at the same time.

## 1. Where search lives

| Layer | File | What it does |
|---|---|---|
| Frontend | `task-tracker/public/app.js:26-31` | Sends `search` and `status` as query params to `GET /tasks?…`; skips empty search box |
| Endpoint | `task-tracker/src/tasks/tasks.controller.ts:22-25` | `GET /tasks` → `tasksService.findAll(query)` |
| Validation | `task-tracker/src/tasks/dto/list-tasks.query.ts:5-7` | `search` is `@IsOptional() @IsString()`, no trimming |
| DB query | `task-tracker/src/tasks/tasks.service.ts:18-20` | `qb.andWhere('task.title LIKE :search', { search: '%' + search + '%' })` |

## 2. Root cause

- `task-tracker/src/tasks/tasks.service.ts:19` uses `LIKE`. In PostgreSQL `LIKE` is **always case-sensitive** (independent of collation).
- `report` ≠ `Report`, so "Monthly Report" / "Weekly Report" are not matched; only "Quarterly report draft" (lower-case) is.
- Not a prefix issue: the pattern is `%term%`, so it already matches anywhere in the title.

## 3. Other cases where search misses or misbehaves

| # | Case | Cause | Effect |
|---|---|---|---|
| A | Case mismatch (`report`, `REPORT`) | `LIKE` (line 19) | **Ticket bug** — task not found |
| B | Spaces around term (`"  report "`) | No trim in DTO or service | Pattern `%  report %` → not found |
| C | `%` or `_` in the term | Not escaped before building the pattern | Act as wildcards: `%` or `_` returns every task |
| D | `\` in the term | Postgres default LIKE escape char | Term silently changes meaning |
| E | Whitespace-only term (`"   "`) | Not trimmed → filter applied | Odd results instead of "no filter" |
| F | Status filter selected | `status` param (line 21-22) | Task hidden by design — **not a bug**, out of scope |

Out of scope (backlog): searching `description`, multi-word any-order search, accent-insensitive search.

## 4. Fix

**File: `task-tracker/src/tasks/tasks.service.ts`** (only file with logic changes)

```ts
const search = query.search?.trim();
if (search) {
  qb.andWhere("task.title ILIKE :search ESCAPE '\\'", { search: `%${escapeLike(search)}%` });
}
```

- `LIKE` → `ILIKE` (fixes A).
- `trim()` and skip the filter when empty (fixes B, E).
- Add a small module-level helper in the same file:
  `const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');` (fixes C, D).
- Value stays a bound parameter (no SQL injection change).
- No change to DTO, controller, entity or frontend.

**File: `task-tracker/package.json`** (test wiring only, see §5)

- `jest.testPathIgnorePatterns: ["/node_modules/", "\\.db\\.spec\\.ts$"]` so `npm test` stays DB-free.
- New script: `"test:db": "jest --testPathIgnorePatterns=/node_modules/ --testRegex '\\.db\\.spec\\.ts$'"`.

## 5. Tests

Per `task-tracker/CLAUDE.md`: write the failing test first, then fix.

### 5a. Unit tests — `task-tracker/src/tasks/tasks.service.spec.ts` (mocked, no DB)

- Extend the existing `repository` mock with `createQueryBuilder` returning a chainable mock QB (`orderBy`, `andWhere` return `this`; `getMany` resolves `[]`).
- New `describe('findAll')`:
  - uses `ILIKE` with `%report%` for `search: 'report'` (fails before fix: SQL is `LIKE`).
  - trims: `'  report  '` → param `%report%`.
  - skips search filter for `''` and `'   '` (no `andWhere` with `:search`).
  - escapes wildcards: `'%'` → `%\%%`, `'_'` → `%\_%`, `'a\\b'` → `%a\\\\b%`.
  - still applies `status` filter together with search.

### 5b. DB test — new `task-tracker/src/tasks/tasks.service.db.spec.ts` (real Postgres)

- Connect with `dataSourceOptions()` from `task-tracker/src/data-source.ts` (Postgres on 5433 via `npm run db:up`).
- Per test: open a `queryRunner`, `startTransaction()`, build `new TasksService(queryRunner.manager.getRepository(Task))`, insert fixtures, `rollbackTransaction()` in `afterEach` → dev data untouched.
- Fixtures: "Monthly Report", "Weekly Report", "Quarterly report draft", "Weekly sync notes", "100% done", "file_name check".
- Assertions (compare by inserted ids, since seeded rows may also match):
  - **Ticket case:** `search: 'report'` returns "Monthly Report" **and** "Weekly Report" (and "Quarterly report draft").
  - `'REPORT'`, `'Report'`, `'rep'`, `'  report  '` → same three.
  - `'monthly'` → "Monthly Report" only among fixtures.
  - `'%'` → only "100% done"; `'_'` → only "file_name check".
  - `'weekly'` → "Weekly Report" + "Weekly sync notes", not "Monthly Report".

## 6. Steps

1. Create branch `fix/search-case-sensitive`.
2. Add unit tests (5a) + DB test (5b) + `package.json` wiring → run, confirm they **fail** on `LIKE`.
3. Apply the fix in `tasks.service.ts` (§4).
4. Run `npm test`, `npm run test:db`, `npx tsc --noEmit` → all green.
5. Manual check (§7). Commit `fix(search): match task titles case-insensitively` with a `Closes #<issue>` line (ask for the issue number).

## 7. Verification

```bash
cd task-tracker
npm run db:up && npm run seed && npm run start:dev

npm test                 # unit tests, no DB
npm run test:db          # DB-backed search tests

# Ticket case: expect Monthly Report, Weekly Report, Quarterly report draft
curl -s 'http://localhost:3000/tasks?search=report' | jq -r '.[].title'
# Case variants: same 3 titles
curl -s 'http://localhost:3000/tasks?search=REPORT' | jq -r '.[].title'
# Trimmed input (URL-encoded spaces): same 3 titles
curl -s 'http://localhost:3000/tasks?search=%20%20report%20%20' | jq -r '.[].title'
# Wildcards are literal: expect 0 (before fix: 2505)
curl -s 'http://localhost:3000/tasks?search=%25' | jq length
curl -s 'http://localhost:3000/tasks?search=_' | jq length
# Whitespace-only = no filter: expect 2505
curl -s 'http://localhost:3000/tasks?search=%20%20%20' | jq length
# Combined with status: expect Monthly Report, Weekly Report only
curl -s 'http://localhost:3000/tasks?search=report&status=todo' | jq -r '.[].title'
```

- [ ] Web UI at http://localhost:3000: type `report` in the search box → both tasks visible.
