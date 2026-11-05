# Analysis: Login

- Issue: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/13
- Verdict: Ready

## Gaps

No blocking gaps. The ask is clear, AC1.1 to AC1.7, AC1.13 and AC1.18 are Given/When/Then with exact messages and values, there are no open questions or `[A-xx]` markers, and all dev questions on the issue (Q-46, Q-47) are answered in the description. After the split into T1 and T4 (#16) the scope fits one MR.

Two non-blocking items to handle during planning:

| # | Gap | Type (ask / AC / question / dependency / size) | Affects |
|---|---|---|---|
| 1 | AC1.2 lists "a missing email, name or password" and "its position in the file when the email is missing", but none of the listed test cases (TC-02, TC-03, TC-40, TC-57 to TC-59) covers a missing field or the position-based error. The AC is testable as written; the plan should add unit tests for it. | AC | AC1.2 (non-blocking) |
| 2 | The issue cites the ticket pack `v0.9` for section 7 (test cases). `v0.9` exists only as an uncommitted change on branch `chore/claude-workflow-skills`; `HEAD` and `origin/main` have `v0.8`, where T1 still holds the T4 content. A ticket worktree branched from `origin/main` will see the old pack. The issue text is complete on its own and is the source of truth. | dependency | Reading TC-xx from a worktree (non-blocking) |

## Dependencies

None. The ticket's Dependencies section says "None", and the issue has no linked issues. T2 (#14), T3 (#15) and T4 (#16) depend on this ticket, not the other way round.

## Facts from the repo

**Today's behaviour (no users, no login)**

- No user, auth, session, guard or password code exists in `src/` or `public/` (search for `auth|jwt|bcrypt|passport|cookie|guard|user` found only DB credentials, comments and a test error string).
- The only entity is `Task` (`task-tracker/src/data-source.ts:12`); the schema comes from `synchronize: true` (`task-tracker/src/data-source.ts:14`), so a new `User` entity creates its table on next start.
- `AppModule` imports only `ConfigModule`, `TypeOrmModule` and `TasksModule` (`task-tracker/src/app.module.ts:7-11`).
- The global `ValidationPipe({ whitelist: true, transform: true })` applies to every request (`task-tracker/src/main.ts:9`); a login DTO needs class-validator decorators on every field.
- The web UI is static files from `public/`, served with no checks (`task-tracker/src/main.ts:10`). The login screen must live in this static UI; AC1.6 is enforced by the API returning `401`.
- No password-hashing, JWT or session library is in `dependencies` (`task-tracker/package.json:16-30`). Node's built-in `crypto` (`scrypt`, HMAC) is available without a new dependency.

**Endpoints AC1.6 must protect** (all in `task-tracker/src/tasks/tasks.controller.ts`)

- `GET /tasks` (`:30`), `GET /tasks/export` (`:36`), `GET /tasks/:id` (`:52`), `POST /tasks` (`:57`), `PATCH /tasks/:id` (`:62`), `DELETE /tasks/:id` (`:67`). These are the six calls in TC-09.
- `GET /tasks/export` streams the CSV through `StreamableFile` (`task-tracker/src/tasks/tasks.controller.ts:36-50`); the `401` must be returned before the stream starts so no task data is sent.

**Seed (AC1.1, AC1.2, Q-46)**

- `npm run seed` runs `src/seed.ts` (`task-tracker/package.json:9`), which calls `repo.clear()` on tasks before inserting (`task-tracker/src/seed.ts:30`). Q-46 requires a second, separate command for users that never touches tasks.

**Web UI (AC1.3 to AC1.7, AC1.13, AC1.18)**

- The header is a static `<h1>Task Tracker</h1>` (`task-tracker/public/index.html:11`); AC1.13 adds the name and role next to it.
- The UI makes two API calls: `GET /tasks` (`task-tracker/public/app.js:54`) and `POST /tasks` (`task-tracker/public/app.js:134`). There is no export button in the UI.
- A non-OK response today is shown as a generic error from `body.message` (`task-tracker/public/app.js:66-68`); nothing handles `401` or switches to a login screen.

**Tests**

- `tasks.controller.spec.ts` boots a Nest app from `TasksController` and `TasksService` only (`task-tracker/src/tasks/tasks.controller.spec.ts:30-37`) and calls `GET /tasks/export` over HTTP (`:10`). How the auth check is wired (global guard vs `@UseGuards` on the controller) decides whether this spec must provide or override it.
- Specs mock the repository with no DB; real SQL goes in `*.service.db.spec.ts` (`task-tracker/CLAUDE.md`, Conventions).

**Cross-ticket constraint for the plan**

- T3 AC3.15 (ticket pack, T3 section): after the users file is reloaded without user B, B's tasks still show B's name, and B cannot log in. If T1's users seed hard-deletes user rows, T3 cannot show B's name without reworking T1. The T1 rule ("deletes all current users ... cannot log in") is met either way, so the plan should pick a users table design that T3 can build on.

**Past work on the same area**

- No earlier commit or MR added auth to task-tracker. MR !1 ("Reject expired session tokens") is labelled `fastapi-practice`, not task-tracker.
- MR !2 ("Prevent duplicate tasks when Save is clicked repeatedly") is still open and changes `public/app.js`, `src/tasks/tasks.controller.ts`, `src/tasks/tasks.controller.spec.ts` and `package.json`, the same files this ticket touches. Expect a merge conflict with whichever merges second.

## Decisions

None needed. All product questions are answered on the issue. Technical choices (session format, where the token is stored for AC1.18, hashing algorithm, users seed command name, users table design for AC3.15) belong to `/build-plan`.

| Question | Recommendation | Answer |
|---|---|---|

## Runs

| Date | Verdict | Change |
|---|---|---|
| 2026-11-05 | Ready | First analysis |
