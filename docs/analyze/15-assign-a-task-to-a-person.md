# Analysis: Assign a task to a person

- Issue: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/15
- Verdict: Ready

## Gaps
| # | Gap | Type (ask / AC / question / dependency / size) | Affects |
|---|---|---|---|
| G1 | ~~The logged-in user's option text was not defined ("(me)" marker vs AC3.18).~~ Closed: Q-54 answered. Every user, the logged-in user included, is shown as "Name (email)", with no "(me)" marker (issue v0.11, UI and AC3.18; ticket pack TC-55, TC-79). | AC | AC3.4, AC3.18, TC-55, TC-79 |
| G2 | ~~What a closed row dropdown shows ("names only" vs "Name (email)").~~ Closed: Q-55 answered. A closed row dropdown shows the name only; the email shows only when the dropdown is opened (issue v0.11, business rules, UI and AC3.7; ticket pack TC-72). | question | AC3.7, TC-37, TC-72 |

## Dependencies
- T1 / #13 Login: closed (2026-11-05).
- T4 / #16 Roles and task management: closed (2026-11-05).
- T2 / #14 Prioritize tasks: closed (2026-11-06). T3 needs T2's priority column and CSV `priority` column, though #14 is not listed under Dependencies. Its code is now on GitLab `origin/main`: MR !11 was squash-merged as `81cfc7b` (merge `bfd1b5a`). `git diff 3ad4a6e origin/main` is empty, so the code is the same as the T2 commit on GitHub. The history differs, though: local `main` (`1ec0cb7`) and `origin/main` don't share the T2 commit.

## Facts from the repo
Line references are on `origin/main` (`bfd1b5a`). Its tree equals `3ad4a6e`, and `task-tracker/` is the same in the working tree.

- No assignee today: `Task` has id, title, description, status, priority, dueDate, createdAt, updatedAt (`task-tracker/src/tasks/task.entity.ts:16-42`).
- The schema comes from `synchronize: true` (`task-tracker/src/data-source.ts:15`), and there are no migrations (`task-tracker/CLAUDE.md`, "Never do"). A new nullable assignee column is `NULL` on every existing row at the next start, which is "Unassigned" (AC3.9). TC-39's "Run migration" step means "start the app".
- Users are never deleted. A reload upserts by email, so a user keeps the same id, and users missing from the file get `removed_at` (`task-tracker/src/users/users.service.ts:23-39`, `task-tracker/src/users/user.entity.ts:30-32`). The comment at `users.service.ts:25` already expects T3's assignee link to survive a reload (AC3.15). A foreign key from tasks to users never breaks on reload.
- A removed user can't log in or call the API: `findActiveById` filters on `removedAt IS NULL` (`task-tracker/src/users/users.service.ts:17-19`), and the guard uses it on every request (`task-tracker/src/auth/auth.guard.ts:69-71`).
- `npm run seed` truncates only `tasks` (`task-tracker/src/seed.ts:24`), so an FK from tasks to users doesn't block it.
- Sample users are Admin, Alice and Bob, as in AC3.18 (`task-tracker/data/users.json:2-4`).
- No endpoint lists users. The API has only `POST /auth/login` and `GET /auth/me` (`task-tracker/src/auth/auth.controller.ts:11-21`). The assignee dropdown needs one that returns active users' id, name and email, sorted by name (AC3.18).
- `/auth/me` and the login response return only `{ name, role }`, and the comment says the email never leaves the server (`task-tracker/src/auth/auth.service.ts:45-48`). The UI has no id for the logged-in user, which it needs to hide "Assign to me" (AC3.4) and show the status dropdown to the assignee (AC3.10). No "(me)" marker is needed any more (Q-54).
- `UsersModule` exports `UsersService` (`task-tracker/src/users/users.module.ts:9`). `TasksModule` doesn't import it (`task-tracker/src/tasks/tasks.module.ts:8`). Per `.claude/rules/code-structure.md`, tasks must import that module and call its service, never the `User` repository.
- Status permission today: `status` is in `ADMIN_ONLY_FIELDS` (`task-tracker/src/tasks/tasks.service.ts:34`). It is checked before the task is read (`tasks.service.ts:160-164`). AC3.10 and AC3.11 depend on the task's assignee, so for `status` the check has to move after the read. Title, description and due date stay admin-only.
- `PATCH /tasks/:id` already passes `req.user`, loaded fresh from the users table (`task-tracker/src/tasks/tasks.controller.ts:65-72`, `task-tracker/src/auth/auth.guard.ts:73`). A reassignment takes away the old assignee's right to change status on their next request (AC3.11, TC-46).
- `update` copies the DTO onto the row and saves it, with no version check (`task-tracker/src/tasks/tasks.service.ts:169-174`), so the last change wins with no warning (AC3.17).
- `create` maps fields one by one (`task-tracker/src/tasks/tasks.service.ts:149-158`), and `POST /tasks` is admin-only (`task-tracker/src/tasks/tasks.controller.ts:59-63`). AC3.1 and AC3.2 add one field there.
- In `UpdateTaskDto`, `priority` rejects `null` on purpose (`task-tracker/src/tasks/dto/update-task.dto.ts:22-26`). Assignee must accept `null` to unassign (AC3.3), like `description` and `dueDate` (`update-task.dto.ts:13-16`, `28-31`).
- The list and the CSV export share `TaskFilterQuery` (`task-tracker/src/tasks/dto/task-filter.query.ts:8-27`) and `filteredQuery` (`task-tracker/src/tasks/tasks.service.ts:104-139`). An assignee filter added there applies to both (AC3.8, AC3.16). `findAll` and `exportCsv` take only the query, not the logged-in user (`tasks.service.ts:57`, `72`; `tasks.controller.ts:32-35`, `41`). "Assigned to me" needs the user passed in.
- The CSV is streamed from raw rows (`task-tracker/src/tasks/tasks.service.ts:17-27`, `76-102`). The assignee's name needs a join, plus a new raw column in `RawTaskRow` and `fromRaw`. `CSV_COLUMNS` ends with `priority` (`task-tracker/src/tasks/tasks-csv.ts:3-13`), and `assignee` goes just before it (AC3.14).
- The UI has no CSV export control (no "export" or "csv" in `task-tracker/public/index.html` or `task-tracker/public/app.js`). AC3.14 is tested through `GET /tasks/export`.
- UI today: every row dropdown is a native `<select>` whose options are built from a label map (`task-tracker/public/app.js:146-152`). A closed native `<select>` shows the full text of the selected option. To show "Alice" when closed and "Alice (alice@example.com)" when open (Q-55), the option text has to change when the dropdown opens and closes, or the dropdown has to be custom-built.
- UI today: the status dropdown is shown to the admin only (`task-tracker/public/app.js:165`). The row dropdown's label covers only Status and Priority (`app.js:150`). The table header and the empty-row colspan list the current columns (`task-tracker/public/index.html:107`, `app.js:268`). The filter form handles search, status and priority (`index.html:86-101`, `app.js:57`, `65`). The new task form puts Priority before Due date (`index.html:51-62`).
- A failed row change restores the old value and shows the error, but doesn't reload the list (`task-tracker/public/app.js:363-367`). AC3.12 needs a reload, so the row shows the status as text after a 403.
- The Edit form fills and diffs every field (`task-tracker/public/app.js:274-281`, `308-321`). T4 (#16, UI > Edit) says Edit shows Assignee once T3 adds it. No T3 AC covers Edit.
- The header shows the logged-in user's own role, "Alice (user)" (`task-tracker/public/app.js:490`). That's allowed: the rule only stops a role being shown to other users.
- Past work on this area: T1 `2124bbb` (users file, login), T4 `3d17831` (admin-only fields, row change behaviour), T2 `3ad4a6e` / `81cfc7b` (priority, tabs, CSV `priority` column). T2 and T4 each shipped as one MR at a similar size (entity, DTOs, service, CSV, UI). T3's 18 ACs fit in one MR.
- The ticket pack (`dojo-ai-training/exercises/day-12/ticket-pack.md`, v0.11, uncommitted) matches issue #15 (v0.11) for T3's business rules, UI and ACs.

## Decisions
| Question | Recommendation | Answer |
|---|---|---|
| D1: T2's code is not on GitLab `origin/main`. Where does T3's branch start? | Get T2 onto GitLab `main` first, then branch from the updated `origin/main`. This follows the branch rule, and T3's MR holds only T3's changes. | Get T2 onto GitLab `main` first. Done: MR !11 merged; T3 branches from `origin/main` (`bfd1b5a`). |
| D2: `PATCH /tasks/:id` with the id of a user removed from the users file: accept or reject? | `400`, same as an unknown id (AC3.6). It matches the dropdown, which leaves removed users out. A task already assigned to them keeps its assignee (AC3.15). | `400` |
| D3: How does a row show an assignee who was removed from the users file (AC3.15)? | In that row only, a selected, disabled option with the name alone ("Bob"). The user can still switch to "Unassigned" or another user. No other dropdown lists Bob. | Selected, disabled option with the name only |

## Runs
| Date | Verdict | Change |
|---|---|---|
| 2026-11-06 | Not ready | First analysis. 2 gaps (G1, G2), T2 code missing on GitLab `main`, decisions D1 to D3 answered. |
| 2026-11-06 | Ready | Q-54 and Q-55 answered, issue and ticket pack updated to v0.11 (G1, G2 closed). T2 merged to GitLab `main` via MR !11 (D1 done). |
