# Analysis: Roles and task management

- Issue: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/16
- Verdict: Ready

## Gaps

No blocking gaps. The ask is clear, AC4.1 to AC4.10 are Given/When/Then with exact messages and values, there are no open questions or `[A-xx]` markers, the Definition of Ready is fully checked, and the issue has no comments. The only dependency (#13) is closed. The BA split T4 out of T1 so it fits one MR.

Non-blocking items for planning:

| # | Gap | Type (ask / AC / question / dependency / size) | Affects |
|---|---|---|---|
| 1 | AC4.7 (Delete) and AC4.6 ("Save changes") don't say how the list reloads afterwards. AC4.4 and AC4.10 only cover a change in a row. Answered in Decisions: same as a row change. | question | AC4.6, AC4.7 (answered) |
| 2 | AC4.8 says "a logged-in user who changes a value in a task's row", but in this ticket only the admin has a row control (status). The "no longer has the right" case is reachable only when a users-file reload changes the admin's role to `user` while their list is open. No TC for T4 covers it (TC-47 is T3's AC3.12). The AC is testable as written; the plan should add a test for it. | AC | AC4.8 (non-blocking) |
| 3 | AC4.2 makes `PATCH /tasks/:id` return `403` for a `user` "with any of those fields" (title, description, due date, status). T2 and T3 will let a `user` PATCH priority and assignee, so the check must be per field, not per endpoint. The issue doesn't say what a `user`'s PATCH with none of those fields (e.g. `{}`) returns. It's a design choice for the plan, not a product question. | AC | AC4.2 (non-blocking) |
| 4 | The issue points to "section 2.2" and "section 7" of the ticket pack `v0.9`. `v0.9`, which has the T4 section, is still an uncommitted change in the main checkout. `HEAD` and `origin/main` have `v0.8`, where these ACs are still AC1.8 to AC1.19 under T1. A worktree branched from `origin/main` will see the old pack. The issue text is complete on its own, and the TC IDs are the same in both versions. | dependency | Reading TC-xx from a worktree (non-blocking) |

## Dependencies

- #13 Login (T1): **closed** on 2026-11-05. It provides logged-in users, their role and the session check that T4 builds on.

## Facts from the repo

**Roles and permissions today**

- Roles exist on users as `admin` / `user` (`task-tracker/src/users/user.entity.ts:9`, `task-tracker/src/users/user.entity.ts:24`), but nothing checks them: no `ForbiddenException`, `403` or role check in `src/` outside the users file loader.
- `AuthGuard` is a global `APP_GUARD` (`task-tracker/src/auth/auth.module.ts:13`). It loads the user from the database on every request and sets `req.user` (`task-tracker/src/auth/auth.guard.ts:65-68`). A role change from a users-file reload therefore applies to the next request with no new login, which is what AC4.8's permission case needs. A user removed from the file gets `401`, not `403` (`task-tracker/src/auth/auth.guard.ts:66`).
- `GET /auth/me` returns `{ name, role }` (`task-tracker/src/auth/auth.service.ts:41-47`). The UI can hide admin-only controls from `role`.
- `TasksController` handlers for `POST`, `PATCH` and `DELETE` take no user and call the service directly (`task-tracker/src/tasks/tasks.controller.ts:57-71`). The controller must stay one line per handler (`.claude/rules/code-structure.md`), so the role check has to live in a guard/decorator or in the service.
- The HTTP tests assert that `alice` (role `user`) can `POST`, `PATCH` and `DELETE` tasks, with the comment "Until T4" (`task-tracker/src/auth/auth.http.spec.ts:157-178`; `alice` has role `user` at `task-tracker/src/auth/auth.http.spec.ts:70`). They must change to `403` with this ticket.

**AC4.3 (everyone sees all tasks)**

- `findAll` has no per-user filter (`task-tracker/src/tasks/tasks.service.ts:34`). Every logged-in user already sees every task.

**AC4.9 (default status)**

- The API defaults status to `todo` (`task-tracker/src/tasks/tasks.service.ts:121`; column default `task-tracker/src/tasks/task.entity.ts:23`). The new task form's status select lists "To do" first (`task-tracker/public/index.html:55-59`). Today's behaviour already matches AC4.9.

**AC4.5, AC4.6, AC4.8 (errors)**

- A missing task gives `404` with the message `Task <id> not found` from `update` and `remove` (`task-tracker/src/tasks/tasks.service.ts:130`, `task-tracker/src/tasks/tasks.service.ts:142`). The UI must map status codes to the fixed texts "Task not found.", "You do not have permission to change this task." and "Internal server error." instead of showing the server's message.

**AC4.6 (clear description and due date)**

- `UpdateTaskDto` accepts `null` for `description` and `dueDate` (`@IsOptional()`), and rejects `dueDate: ""` with `400` (`task-tracker/src/tasks/dto/update-task.dto.ts:13-23`). Checked in this session with the app's `ValidationPipe`: `{"description":null,"dueDate":null}` passes; `{"dueDate":""}` gives `400 ["dueDate must be a valid ISO 8601 date string"]`.
- `update` turns any sent `dueDate` into `new Date(dto.dueDate)` (`task-tracker/src/tasks/tasks.service.ts:134`). `new Date(null)` is `1970-01-01T00:00:00.000Z` (checked with `node`), so clearing the due date today would save 1 January 1970, not "no due date". AC4.6 needs a change here.
- The new task form sends `description` and `dueDate` only when they are not empty (`task-tracker/public/app.js:149-150`). An Edit form must send `null` for a cleared field.

**AC4.4, AC4.10 (list reload)**

- The table shows status as plain text and has no actions column (`task-tracker/public/app.js:130-139`, header `task-tracker/public/index.html:80`).
- When the requested page is past the last page, the list shows the last page (`task-tracker/public/app.js:115-117`). AC4.10 asks for page 1 instead.
- There is no "No tasks match these filters." text in `public/` today.
- After creating a task the form shows "Task saved" and the list jumps to page 1 (`task-tracker/public/app.js:161-165`). The issue doesn't change create.

**History**

- T1 shipped in `2124bbb` (`feat(auth): log in with email and password from a users file`) and `2498c57`, merged in `5634ed8` (`feat/login`). That's the auth code this ticket extends.

## Decisions

| Question | Recommendation | Answer |
|---|---|---|
| After Delete (AC4.7) and "Save changes" (AC4.6), how does the list reload? | Same as a change in a row: reload only the list data, keep the tab, filters and page; go to page 1 if the page is empty. The business rule says "after a change", and one reload path covers all three. | Same as a row change |

## Runs

| Date | Verdict | Change |
|---|---|---|
| 2026-11-05 | Ready | First analysis |
