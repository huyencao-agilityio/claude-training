# Plan: Login required + task ownership in task-tracker

- **Source:** [intent.md](intent.md), [spec.md](spec.md)
- **Status:** Draft for review. Nothing is implemented yet.
- Paths below are relative to [task-tracker](../../../task-tracker) unless noted.

## Context

The intent (all questions answered by the product owner) and the spec ask for:

- email + password login, 10 seeded users, and an `add-user` script
- a global guard that returns `401` without a login, with a 4 hour session
- a per-email block: 5 failed logins block that email for 10 minutes
- task ownership: the owner is set on create, only the owner can update or delete (`403` otherwise), and existing tasks get made-up owners

Local use only; no HTTPS work. This plan turns the spec into file changes, an order of work, tests and risks.

## What I verified in the code (affects the plan)

- [tasks.service.ts](../../../task-tracker/src/tasks/tasks.service.ts) `fromRaw()` builds a `Task` by hand from `RawTaskRow` (the CSV stream). Adding `ownerId` to `Task` means `RawTaskRow`, `fromRaw` and the typed `Task` literal must change too, or `tsc` fails.
- `TaskResponse = Task & { isOverdue }` is spread (`...task`). A new `ownerId` column would leak into every API response and into `toCsvLine(TaskResponse)` unless `toResponse` strips it.
- [tasks.service.spec.ts](../../../task-tracker/src/tasks/tasks.service.spec.ts) has **no** tests for `create`, `update` or `remove` today. The ownership tests are all new, not edits.
- [tasks.controller.spec.ts](../../../task-tracker/src/tasks/tasks.controller.spec.ts) builds a module from only `TasksController` + `TasksService` and calls it over real HTTP (`fetch`). A global guard registered in `AuthModule` does not affect it, and `export()` does not take the user, so it keeps passing unchanged. It is the pattern to copy for the new auth HTTP spec.
- [tasks.service.db.spec.ts](../../../task-tracker/src/tasks/tasks.service.db.spec.ts) calls `repository.create({ title })` with no owner and `new TasksService(repository)`. Both still work if `owner_id` is nullable and the `findAll` / `findOne` signatures do not change.
- The UI ([app.js](../../../task-tracker/public/app.js)) has no edit or delete. It has two `fetch` call sites (`GET /tasks`, `POST /tasks`) and ends with `loadTasks(1)` on load.
- The working tree has unrelated uncommitted changes: `package.json` (a `dev:preview` script) and untracked `src/sg-export-test.ts` (an intentionally unsafe sample). Neither is part of this work.

## Approach

### Files to change

| File | Change |
|---|---|
| `package.json` | add `@nestjs/jwt`, `cookie-parser`, `@types/cookie-parser`; script `user:add` next to `seed` |
| `.env.example` | add `JWT_SECRET`, `SESSION_TTL_HOURS`, `SEED_USER_PASSWORD` (made-up values) |
| [src/data-source.ts](../../../task-tracker/src/data-source.ts) | add `User` to `entities` |
| [src/main.ts](../../../task-tracker/src/main.ts) | `app.use(cookieParser())` before the pipes |
| [src/app.module.ts](../../../task-tracker/src/app.module.ts) | import `AuthModule` |
| [src/tasks/task.entity.ts](../../../task-tracker/src/tasks/task.entity.ts) | `ownerId` (`owner_id`, uuid, **nullable**), `owner?` ManyToOne `User` (`onDelete: RESTRICT`), index on `owner_id` |
| [src/tasks/tasks.service.ts](../../../task-tracker/src/tasks/tasks.service.ts) | see below |
| [src/tasks/tasks.controller.ts](../../../task-tracker/src/tasks/tasks.controller.ts) | `create`, `update`, `remove` pass `@CurrentUser()` to the service |
| [src/seed.ts](../../../task-tracker/src/seed.ts) | upsert 10 users first, round-robin `ownerId` on every task, refuse when `NODE_ENV=production`, print counts only |
| `public/index.html`, `public/app.js`, `public/styles.css` | login section, `#app` wrapper, logout button, session check, 401 handling (CSS only if a tiny rule is needed) |
| `README.md` (task-tracker) | auth endpoints, curl cookie-jar flow, ownership rule, `user:add` |
| `CLAUDE.md` (task-tracker) | seed now creates users and owners; new env vars; `user:add` |
| [dojo-ai-training/README.md](../../README.md) | index row for this file |

New files, all in `src/auth/` unless noted:

- `user.entity.ts`
- `password.service.ts`: scrypt hash and verify. **No constructor dependencies**, so `seed.ts` and `add-user.ts` can `new PasswordService()` outside Nest.
- `login-throttle.service.ts`: in memory, per normalized email, uses `Date.now()` so Jest fake timers work.
- `auth.service.ts`: `login(email, password)` returns a token; the unknown-email path runs a dummy hash.
- `auth.controller.ts`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`.
- `auth.guard.ts`, `public.decorator.ts`, `current-user.decorator.ts`
- `dto/login.dto.ts`
- `auth.module.ts`: `JwtModule`, `APP_GUARD`, exports `PasswordService`.
- `src/add-user.ts` (top level, next to `seed.ts`)
- a spec next to each file (see Tests)

`tasks.service.ts` details:

- `RawTaskRow` and `fromRaw`: add `task_owner_id` → `ownerId`.
- `toResponse`: destructure out `ownerId` and `owner`; change `TaskResponse` to `Omit<Task, 'ownerId' | 'owner'> & { isOverdue }`. `tasks-csv.ts` only reads named fields, so it should need no edit (confirm with `tsc`).
- `create(dto, userId)`: sets `ownerId`.
- `update(id, dto, userId)` and `remove(id, userId)`: `findOneBy`, then `404` if missing, then `403` if `task.ownerId !== userId` (a null owner included), then proceed. `remove` changes from `delete(id)` + `affected` to find, check, delete.

### Order of implementation

Each step is one reviewable commit (Conventional Commits; scopes `auth`, `tasks`, `seed`, `ui`, `docs`) and ends with tests green. Branch: `feat/login-required-task-owner` off `main`. Commit footer `Refs #<issue>`; the MR uses `Closes #<issue>`.

0. **Baseline.** Create the branch, `npm install`, run `npm test` and `npx tsc --noEmit`, record the real pass counts so "before vs after" in the MR is real. Do not stage `sg-export-test.ts` or the unrelated `package.json` change; add only my own lines to `package.json`.
1. **User + hashing.** `User` entity, add it to `data-source.ts`, `PasswordService` + spec. Nothing else depends on anything outside this step, so it goes first.
2. **Seed + add-user.** The seed upserts the 10 users (before tasks, never clearing `users`), `add-user.ts` + the `user:add` script, `.env.example`. Tasks get no owners yet. Accounts must exist before anyone can log in.
3. **Auth API + guard.** `LoginDto`, `LoginThrottleService`, `AuthService`, `AuthController`, guard and decorators, `AuthModule` with the global `APP_GUARD`, `main.ts`, `app.module.ts`, new dependencies. From this commit `/tasks` returns `401` without a cookie and the old UI cannot load tasks until step 5 (state this in the commit body).
4. **Ownership.** `Task.ownerId`, service and controller changes, `toResponse` strip, round-robin owners in the seed, service specs.
5. **UI.** Login, logout, session check and expired-session handling in `public/`.
6. **Docs.** task-tracker `README.md` and `CLAUDE.md`, and the index row in [dojo-ai-training/README.md](../../README.md).
7. **Verify end to end** (below), then draft the MR description for approval. Per the repo `CLAUDE.md`, nothing is pushed and no MR is created before the user approves.

## Tests

All Jest, repository mocked, each new test written to fail first. Existing specs keep passing.

- **`password.service.spec.ts`:** round trip; wrong password; two hashes of one password differ; a malformed stored hash fails safely.
- **`login-throttle.service.spec.ts`** (fake timers): 4 failures still `401`; the 5th is the block; the correct password while blocked is still blocked; allowed again after 10 minutes; success resets the count; stale failures expire; emails are independent and case-insensitive; **an unknown email behaves identically**; the map cap drops the oldest entry.
- **`auth.service.spec.ts`:** token on valid login; unknown email and wrong password give the same error; email trimmed and lower-cased; the dummy hash runs for an unknown email.
- **`login.dto.spec.ts`:** missing, empty, non-email and over-long email and password; unknown fields dropped.
- **`auth.guard.spec.ts`:** no cookie, tampered token, expired token, deleted user → `401`; valid token → pass; `@Public()` route → pass.
- **`auth.controller.spec.ts`** (HTTP, same style as `tasks.controller.spec.ts`): cookie flags (`HttpOnly`, `SameSite=Strict`, `Max-Age=14400`); logout clears the cookie; `GET /tasks` and `GET /tasks/export` give `401` without a cookie and `200` with one; `429` + `Retry-After` on the 5th failure; a failed login logs no credentials (spy on `Logger`).
- **`tasks.service.spec.ts`** (new `create`, `update`, `remove` blocks): the owner is set from the user id and ignored if present in the body; the owner can update and delete; another user gets `ForbiddenException`; a null owner gets `ForbiddenException`; a missing task gets `NotFoundException` (checked before the owner); responses contain no `ownerId` or `owner`.
- **Existing CSV tests:** add `task_owner_id` to the raw-row fixtures; assert the CSV header and rows are unchanged.
- **Seed and add-user:** unit-test the pure parts (round-robin owner assignment, password and email validation, duplicate rejection). The database parts are checked manually.
- **UI:** no test harness exists; checked manually.

## Verification (end to end)

Run these and record the real output for the MR "How tested" section:

1. `npx tsc --noEmit` and `npm test`, compared with the step 0 baseline.
2. `npm run db:up`. Start the **old** build first on a database that already has tasks, then the new one: the app must boot with `owner_id` nullable and not fail on `synchronize`. Then `npm run seed`.
3. curl: `/tasks` and `/tasks/export` → `401`. Log in as `user01@example.com` with a cookie jar → `200` on `/tasks`.
4. Wrong password vs unknown email: same status and body. Five failures → `429`; the correct password right after → `429`; same for an unknown email. Confirm the unblock after 10 minutes (wait, or fake the clock in the unit test).
5. User A creates a task; user B `PATCH` and `DELETE` → `403`; A succeeds. A task with no owner (created before the seed) → `403`.
6. Database check: every task has an owner, spread across the 10 users; `password_hash` is not a plain password.
7. Browser (Playwright MCP or manual): login form first with no task flash; wrong-password message; `429` message; logout; delete the cookie then Search shows the expired message; cookie flags in dev tools.
8. `npm run user:add -- someone@example.com`, then log in with it.

## Risks and what could break

1. **Every anonymous API caller breaks** (curl in earlier exercises, `/tasks/export`). Mitigation is documentation: the README gets the cookie-jar flow.
2. **`synchronize` + new column.** `owner_id` must stay nullable or the app fails to boot on an existing database. A null owner means "nobody can edit" until the seed runs. That is weaker than a database guarantee; the real fix needs migrations (out of scope).
3. **Entity edits change the live schema** (the repo `CLAUDE.md` warns about this): the `users` table and `owner_id` appear on first start. There is no destructive change to `tasks`.
4. **`Task` type ripple.** `fromRaw`, `RawTaskRow`, `TaskResponse` and the CSV fixtures all depend on the shape of `Task`. `tsc` plus the CSV tests are the safety net.
5. **The global guard fails closed.** New endpoints are protected by default, but a mistake in `@Public()` placement would lock out login itself (covered by the controller spec).
6. **Lockout abuse.** Anyone who knows an address can keep it blocked (the PO chose per-email). There is no unlock path.
7. **In-memory throttle** resets on restart and does not work across instances.
8. **Stateless token.** Logout does not revoke it. A deleted user is caught by the guard's per-request lookup, at the cost of one primary-key query per request.
9. **Seed side effects.** Upserting users rehashes passwords on each run (fine); a re-seed must never truncate `users`. The seed password is shared and public in `.env.example`; the seed refuses to run in production.
10. **Unrelated working-tree changes** (`package.json` `dev:preview`, `sg-export-test.ts`) can end up in my commits if I use `git add -A`. I will stage by path. `sg-export-test.ts` also makes `tsc` and the build include an intentionally unsafe file; that is pre-existing and not touched.
11. **UI regression surface.** Both `fetch` sites need 401 handling, and the page must not render tasks before the session check answers.
12. **Not covered by this change:** HTTPS and `Secure` cookies outside production, CSRF beyond `SameSite=Strict`, deployment. All explicitly out of scope per the PO.

## Reasoning and alternatives not chosen

- **Own guard + JWT in an HttpOnly cookie** (chosen) over **Passport** (`@nestjs/passport`, `passport-local`, `passport-jwt`). Passport adds three packages and strategy boilerplate for a single strategy; the guard is about 30 lines and easy to test.
- **Stateless JWT cookie** over **server-side sessions** (`express-session` + a `sessions` table). Sessions give a real logout and revocation but add a table, a dependency and cleanup, against "keep it simple". The cost (a stolen token lives 4 hours) is accepted; the upgrade path is in the spec.
- **HttpOnly cookie** over **`Authorization: Bearer` + `localStorage`**. JS-readable tokens are exposed to XSS, and a cookie makes a future "Download CSV" link work without extra code.
- **Node `crypto.scrypt`** over **bcrypt / argon2**. No native build step in a training repo. It is wrapped in `PasswordService`, so switching to argon2id is a one-file change.
- **Custom `LoginThrottleService`** over **`@nestjs/throttler`**. Throttler counts all requests per IP by default; the PO wants failures only, per email, reset on success, and the same answer for unknown emails.
- **In-memory throttle** over **a `login_attempts` table**. Simpler, and it does not store attempted (PII) emails. The cost is a reset on restart, acceptable for one local instance.
- **Global `APP_GUARD` + `@Public()`** over **`@UseGuards` on `TasksController`**. New endpoints are protected without anyone remembering to add the guard.
- **Owner check inside `TasksService`** over **a Nest guard**. The repo `CLAUDE.md` puts logic in the service, and the task has to be loaded anyway. The user id is an explicit method argument (not `@Req()`), so service specs stay simple.
- **Load, check, then delete** over **one atomic `DELETE ... WHERE id AND owner_id`**. The atomic version cannot tell `404` from `403` without a second query, and there is no ownership-transfer feature, so there is no race to protect.
- **Nullable `owner_id`** over **`NOT NULL` + migrations**. The repo has no migrations, and introducing them is a separate change.
- **Strip `ownerId` in `toResponse`** over **returning it or adding `isOwner`**. The UI shows no owner and has no edit or delete, so neither would be used.
- **Register `APP_GUARD` in step 3** over **delaying it to the end**. It keeps `/auth/session` protected by default and avoids a one-off explicit guard. The price is a UI that cannot load tasks between steps 3 and 5 on the same branch.

## Open items for review

1. GitLab issue number for `Refs` / `Closes` (the repo `CLAUDE.md` requires it in commits and the MR).
2. Is the branch name `feat/login-required-task-owner` OK?
3. Is it fine that between step 3 and step 5 the old UI cannot load tasks (same branch, merged together)?
4. Keep the unrelated `package.json` change (`dev:preview`) and `sg-export-test.ts` out of these commits?
