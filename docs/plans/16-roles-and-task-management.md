# Plan: Roles and task management

- Ticket: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/16
- Analysis: docs/analyze/16-roles-and-task-management.md
- Branch: `feat/roles-task-management`
- Status: Implemented (2026-11-05)

Since T1 (#13), only logged-in users can use task-tracker, but every logged-in user can still create, edit and delete every task. Roles (`admin` / `user`) are loaded and shown, and nothing checks them. This ticket makes create, edit, delete and status changes admin-only, in the API (`403`) and in the UI (controls hidden from a `user`). It also adds saving the status from the row, a "Saved" or error line above the table, Edit (in the new task form) and Delete (with a confirm dialog).

Choices made:
- **Where the role check lives.** `POST /tasks` and `DELETE /tasks/:id` are admin-only endpoints. A `@Roles('admin')` check in the existing `AuthGuard` covers them, so a `user` gets `403` before body validation. TC-13 sends `POST /tasks` and could otherwise get `400`. `PATCH /tasks/:id` is checked per field in `TasksService.update`, because T2 and T3 let a `user` PATCH priority and assignee, and T3 makes status depend on the task's assignee (needs the row).
- **Delete and Edit reload the list like a row change** (decision in the analysis): keep the tab, filters and page; go to page 1 if the page is empty.

## AC → change

| AC | Behaviour change | Files | Unit test |
|---|---|---|---|
| AC4.1 | An admin can still `POST`, `PATCH` (title, description, due date, status) and `DELETE`. | `src/auth/auth.guard.ts`, `src/tasks/tasks.controller.ts`, `src/tasks/tasks.service.ts` | `auth.http.spec.ts` (admin: 201 / 200 / 204) |
| AC4.2 | API: a `user` gets `403` on `POST /tasks` (even with an invalid body), on `DELETE /tasks/:id`, and on `PATCH /tasks/:id` with `title`, `description`, `dueDate` or `status`. Nothing is read or saved. UI: a `user` sees no new task form, no "Actions" column, and status as text. | `src/auth/auth.guard.ts`, `src/tasks/tasks.controller.ts`, `src/tasks/tasks.service.ts`, `public/index.html`, `public/app.js` | `auth.http.spec.ts` (TC-13: each endpoint/field → 403, no save/delete; `POST {}` → 403 not 400), `tasks.service.spec.ts` (update by `user` with each field → `ForbiddenException`, `findOneBy` not called) |
| AC4.3 | No change: `GET /tasks` has no per-user filter. | none | `auth.http.spec.ts` (`user` gets 200 on `GET /tasks`; already covered) |
| AC4.4 | For an admin, Status in the row is a dropdown. Picking a value sends `PATCH {status}`. On success: "Saved" above the table for 5 s and the list data reloads, keeping tab, filters and page. | `public/app.js`, `public/index.html` | Manual / QA (TC-49) |
| AC4.5 | When a row save returns `404`, the dropdown goes back to its old value and "Task not found." shows for 5 s. | `public/app.js` | Manual / QA (TC-50) |
| AC4.6 | "Edit" fills the form (heading "Edit task", buttons "Save changes" and "Cancel"). "Save changes" sends `PATCH` with the changed fields only. The form stays filled with the saved task and the list reloads. "Cancel" empties the form and goes back to "New task". `404` → "Task not found." in the form. API: `dueDate: null` and `description: null` clear the field. Today `dueDate: null` saves 1970-01-01. | `public/app.js`, `public/index.html`, `src/tasks/tasks.service.ts`, `src/tasks/dto/update-task.dto.ts` | `tasks.service.spec.ts` (`dueDate: null` → `null`, fails first; `description: null` → `null`; omitted `dueDate` kept); `dto/update-task.dto.spec.ts` (`null` accepted, `""` → 400) |
| AC4.7 | "Delete" opens a `<dialog>`: `Delete task "<title>"? This cannot be undone.` with "Delete" and "Cancel". "Delete" sends `DELETE` and reloads the list. An error shows above the table. | `public/app.js`, `public/index.html`, `public/styles.css` | Manual / QA (TC-53) |
| AC4.8 | One mapping from status code to message, used by the row and the form: `404` → "Task not found.", `403` → "You do not have permission to change this task.", anything else → "Internal server error.". The row's value goes back; the message clears after 5 s. | `public/app.js` | `auth.http.spec.ts` (admin demoted to `user` in the users table → next `PATCH` is 403: the role is read per request); UI manual / QA (TC-61) |
| AC4.9 | No change: the API defaults to `todo` and the form's status select starts at "To do". After "Cancel" or a create, the form resets to "To do". | none | `tasks.service.spec.ts` (create without status → `todo`) |
| AC4.10 | After a change (row, Edit, Delete), if the reloaded page is past the end the list goes to page 1, not the last page. When `total` is 0 the table shows one row "No tasks match these filters.". Prev/Next keep today's "last page" fallback. | `public/app.js` | Manual / QA (TC-75, TC-76) |

## API contract

No new endpoint, no new field. Changes:

**`POST /tasks`**, **`DELETE /tasks/:id`**: admin only.
- `user` → `403` `{ "statusCode": 403, "message": "Forbidden" }`, checked before body validation and before any DB call. No login → `401` as today.

**`PATCH /tasks/:id`**
- A `user` sending any of `title`, `description`, `dueDate`, `status` (even `null`) → `403` `{ "statusCode": 403, "message": "Forbidden" }`, before the task is loaded. So a `user` gets `403`, not `404`, for a missing task.
- A `user` sending none of them (e.g. `{}`, or only unknown fields, which `whitelist` strips) → `200` with the task unchanged. T2 and T3 add `priority` and assignee, which a `user` may send.
- An invalid value (e.g. `status: "urgent"`) → `400` before the role check, as today, for both roles.
- `description: null` → saved as no description; `dueDate: null` → saved as no due date. `dueDate: ""` stays `400`.
- Missing task (admin) → `404` `Task <id> not found` as today.

**UI messages** (fixed texts, not the server's message): `404` "Task not found.", `403` "You do not have permission to change this task.", any other failure "Internal server error.". If the request never reaches the server, the existing "Could not reach the server" is shown.

## Data

None. No entity or column change, no seed change. `synchronize: true` changes nothing.

## Key code

1. **Role check in `AuthGuard`** (`src/auth/auth.guard.ts`). It's the security boundary for create and delete, and it has to run after the user is loaded and before validation. Reusing the guard keeps the order fixed (one global guard, no second `APP_GUARD` ordering to depend on).
   ```ts
   const ROLES = 'roles';
   export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

   // in canActivate, after req.user = user:
   const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [
     context.getHandler(), context.getClass(),
   ]);
   if (roles && !roles.includes(user.role)) throw new ForbiddenException();
   ```
   Controller: `@Roles('admin')` on `create` and `remove`. `update` gets `@Req() req: AuthenticatedRequest` and passes `req.user`, still one line.

2. **Per-field check and clearing in `TasksService.update`** (`src/tasks/tasks.service.ts`). This is the rule T2 and T3 extend, and the 1970 bug.
   ```ts
   // Only an admin may change these; T2/T3 add fields a user may change (AC4.2)
   const ADMIN_ONLY_FIELDS = ['title', 'description', 'dueDate', 'status'] as const;

   async update(id: string, dto: UpdateTaskDto, user: Pick<User, 'role'>) {
     if (user.role !== 'admin' && ADMIN_ONLY_FIELDS.some((f) => dto[f] !== undefined)) {
       throw new ForbiddenException();
     }
     const task = await this.tasks.findOneBy({ id });
     if (!task) throw new NotFoundException(`Task ${id} not found`);
     Object.assign(task, {
       ...dto,
       // null clears the due date (AC4.6); new Date(null) would be 1970-01-01
       dueDate: dto.dueDate === undefined ? task.dueDate : dto.dueDate === null ? null : new Date(dto.dueDate),
     });
     return this.toResponse(await this.tasks.save(task));
   }
   ```
   `UpdateTaskDto`: `description?: string | null`, `dueDate?: string | null` (decorators unchanged; `@IsOptional()` already lets `null` through).

3. **Edit sends only changed fields** (`public/app.js`). A due date is saved as local midnight and shown as its UTC day (fixed by T2, AC2.16). In UTC+ zones, re-sending an untouched date would move it back one day on every save. So Edit compares each field with the task it opened and sends only what changed. A cleared description or due date is sent as `null`.

4. **Shared save helpers** (`public/app.js`). T2 and T3 reuse these for priority and assignee.
   - `saveErrorMessage(status)`: the 404 / 403 / other mapping.
   - `showListMessage(text, kind)`: the line above the table, one 5 s timer, restarted on each message.
   - `reloadAfterChange()`: `loadTasks(currentPage, appliedFilters, { pastEnd: 'first' })`.

   Row dropdowns are built with `data-id` and the current value. A delegated `change` listener on `#task-rows` disables the select while it saves, then reverts it on failure.

## Tests

Unit (`npm test`):
- `src/auth/auth.http.spec.ts`: add an `admin` fixture. Change the three "Until T4" tests (`alice` POST / PATCH / DELETE) to expect `403` with no `save` or `delete` call. Add:
  - `POST {}` as `user` → 403, not 400
  - `PATCH` with each of `title`, `description`, `dueDate`, `status` as `user` → 403
  - `PATCH {}` as `user` → 200
  - admin `POST` / `PATCH` / `DELETE` → 201 / 200 / 204
  - admin demoted (users repo returns `role: 'user'` for the admin's id) → `PATCH` 403
- `src/tasks/tasks.service.spec.ts`, new `describe('update')`:
  - `user` + each admin-only field → `ForbiddenException`, no `findOneBy`
  - `user` + `{}` → saved unchanged
  - admin `dueDate: null` → saved `null` (write it first and see it fail with 1970)
  - admin `description: null` → `null`
  - omitted `dueDate` → kept
  - missing task → `NotFoundException`

  `describe('create')`: no status → `todo`.
- `src/tasks/dto/update-task.dto.spec.ts` (new): `{ description: null, dueDate: null }` passes; `{ dueDate: "" }` → 400; `{ status: "urgent" }` → 400.

Then `/verify-changes` (type-check, tests, diff rules, API smoke test as admin and as `alice`).

Left for QA / manual (no frontend test setup in `public/`):
- TC-11, TC-12, TC-14, TC-49, TC-50, TC-52, TC-53, TC-61 (make the server fail, e.g. stop the DB), TC-62, TC-63, TC-75, TC-76, TC-77.
- Log in as `admin@example.com` and as `alice@example.com` (`Passw0rd`) with `npm run seed:users`.

## Out of scope and risks

- Out of scope: user management in the UI, other roles, T2 (priority) and T3 (assignee). T3 will add "the assignee can change status" to `ADMIN_ONLY_FIELDS` / the `update` check.
- Due dates in UTC+ zones still show the previous day in the list and in the Edit form. This is today's behaviour, fixed by T2 (AC2.16). Key code 3 keeps Edit from making it worse.
- `PATCH` with `title: null` or `status: null` from an admin passes validation and fails on the NOT NULL column with `500`. That's today's behaviour, outside this ticket, and the UI never sends it. Noted, not fixed.
- Breaking for API clients that create or delete as a `user`. Only the training UI and tests call it.
- A demoted admin keeps seeing admin controls until reload. Each save returns `403` and shows the permission message (AC4.8).

## Open questions

None.

## Deviations

No change in behaviour from the plan. Details the plan left open:
- A successful Delete shows no message; the row just leaves the list. Only a failed Delete shows its error above the table.
- After a failed row change the row stays on screen (no reload), with its old value back.
- The create form also uses the 404 / 403 / other message mapping for non-400 errors (it used to show the server's text, e.g. "Forbidden").
- "Save changes" is disabled while its request runs.
- Extra HTTP tests beyond the plan: a `user`'s `PATCH` with `description: null` / `dueDate: null` → 403, and `status: "urgent"` → 400 before the role check.
