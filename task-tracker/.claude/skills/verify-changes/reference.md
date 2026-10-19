# verify-changes reference

Detailed rules behind the checks in `SKILL.md`. `check.sh` automates the mechanical ones; the rest need reading the diff.

## What check.sh does

| Check | Result | Why |
|-------|--------|-----|
| `.env` file in the change (`.env.example` excepted) | FAIL | Secrets and `.env` contents stay out of the repo. `.env.example` is the tracked template and may change. |
| `.only` / `.skip` / `xit` / `fit` in a changed spec | FAIL | Hides other tests; CI looks green while tests don't run. |
| `console.log` / `console.debug` added in `src/` | WARN | Debug output left behind. `src/seed.ts` is not scanned: it prints progress on purpose. |
| `where` / `andWhere` / `orWhere` / `having` / `andHaving` / `orHaving` / `query` called with a template string containing `${` | FAIL | SQL injection; use `:param` placeholders. |
| `select` / `orderBy` / `groupBy` / `*Join` (and `add*` variants) called with a template string containing `${` | WARN | Column names can't be parameters, so a template is only safe if the value is whitelisted (e.g. `@IsIn` on the DTO field). |
| `src/` changed but no `*.spec.ts` changed | WARN | Every bug fix and feature needs tests (see `CLAUDE.md`). Pure refactors can skip, say so in the report. |
| `*.entity.ts` changed | WARN | `synchronize: true` alters the table on the next start. |
| Entity class not in `src/data-source.ts` `entities` | FAIL | Table never created; `seed.ts` can't see it. |
| DTO field possibly without a decorator | WARN | Global `ValidationPipe({ whitelist: true })` silently drops it. A heuristic, so read the file before reporting it. |
| `npx tsc --noEmit` | FAIL on error | No linter yet; this is the static check. |
| `npm test` | FAIL on error | Jest, repository mocked, no DB needed. |
| `npm run build` (`--build`) | FAIL on error | Only when asked or before an MR. |

All diffs start at `git merge-base <base> HEAD`, not at `<base>` itself, so commits added to `main` after the branch was created don't show up as part of the change.

Limits of the grep-based checks:
- **DTO check**: looks for a property line with no `@...` decorator above it. It skips comment lines and follows a decorator's parentheses across lines, but unusual formatting can still give a false positive. That's why it is a WARN.
- **Query checks**: only see one line at a time. A template string that starts on the line after `.where(` is missed, so the manual review must check queries in the diff.

## Manual review rules

Check these by reading the diff (`git diff $(git merge-base main HEAD) -- .`). They match what `.claude/agents/code-reviewer.md` looks for.

**Tests prove the change**
- Bug fix: there is a test that fails on the old code. Verify with the reverse-patch step in `SKILL.md` (step 3) and report both runs.
- Feature: tests cover the edge cases and validation errors from the issue.
- No test was deleted, loosened (`toBeDefined` instead of a value) or changed to match buggy output.

**API behavior**
- `PATCH` only overwrites fields the request sent (`!== undefined`, not truthiness, so `null` and `""` still work where allowed).
- Missing rows throw `NotFoundException`; `update` / `remove` check `result.affected`.
- `:id` params use `ParseUUIDPipe` (`not-a-uuid` → 400).
- `DELETE` returns 204.
- Responses go through `toResponse` so `isOverdue` is present.

**Data**
- Nullable columns (`description`, `dueDate`) are handled as `null`, not `undefined` or `""`.
- Dates are `timestamptz`; compare in UTC. Watch for `new Date()` vs date-only strings.
- Search / filters: parameterized, and case sensitivity matches the requirement (`ILIKE` vs `LIKE`). Check multi-line query builder calls by eye; `check.sh` can't see them.

**Frontend (`public/`)**
- `fetch` errors are shown to the user, not swallowed.
- UI refreshes after create / update / delete; no stale list after an error.

**Scope**
- The diff only touches what the task asked for. This repo has deliberate bugs; fixing an unrelated one is out of scope, so note it instead.
- No real customer data or keys; seed data is made up.

## Smoke test (when the API or UI changed)

```bash
npm run db:up
npm run start:dev        # run in the background, wait for "Nest application successfully started"
```

```bash
curl -s localhost:3000/tasks | head -c 300
curl -s -X POST localhost:3000/tasks -H 'Content-Type: application/json' -d '{"title":"Sample task"}'
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/tasks/not-a-uuid                              # 400
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/tasks/00000000-0000-4000-8000-000000000000    # 404
curl -s -X POST localhost:3000/tasks -H 'Content-Type: application/json' -d '{}'                      # 400
```

Add a request that exercises the actual change (e.g. the search query that was broken). Stop the dev server afterwards.

## Example report

```
## Verify: fix(search) case-insensitive title match

Automated (check.sh)
- PASS  no .env, no focused tests, no string-built queries
- PASS  tsc
- PASS  jest: Tests: 9 passed, 9 total
- WARN  none

Test proves the fix
- Without fix: `matches titles regardless of case` failed (expected 1 result, got 0)
- With fix: passes

Manual review
- OK  query uses ILIKE with :search parameter
- Note (pre-existing, out of scope): PATCH clears dueDate when sent as ""

Smoke test
- GET /tasks?search=SAMPLE → 200, 3 results (before: 0)

Verdict: ready for MR
```
