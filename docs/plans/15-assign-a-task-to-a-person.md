# Plan: Assign a task to a person

- Ticket: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/15
- Analysis: docs/analyze/15-assign-a-task-to-a-person.md
- Branch: `feat/task-assignee` (from `origin/main`, `bfd1b5a`)
- Status: Implemented (2026-11-09; approved 2026-11-06)

## Context

Tasks have no assignee, so nobody can tell who works on what. T3 adds one optional assignee per task. Any logged-in user can assign, reassign or unassign a task. The assignee becomes the second person, after the admin, who can change the task's status. The list gets an Assignee column with an "Assign to me" link and an Assignee filter ("Anyone", "Assigned to me", "Unassigned"). The CSV export gets an `assignee` column.

Answers that shape the plan:
- Q-54: every user, the logged-in one included, shows as "Name (email)" in the opened dropdown, with no "(me)" marker.
- Q-55: a closed row dropdown shows the name only.
- D2: an id of a removed user → `400`.
- D3: a removed assignee shows in their row as a selected, disabled option with the name only.

## AC → change

| AC | Behaviour change | Files | Unit test |
|---|---|---|---|
| AC3.1, AC3.2 | `assigneeId` (uuid or null) on create. The service checks it's an active user and saves it; omitted → `null`. New task form: "Assignee" select after Priority, "Unassigned" first, default "Unassigned". Edit form fills and sends it too (T4 UI > Edit) | `dto/create-task.dto.ts`, `tasks.service.ts`, `public/index.html`, `public/app.js` | `tasks.service.spec.ts`: create with an active user's id saves it; without → `assigneeId: null`; `create-task.dto.spec.ts`: uuid and null accepted, `"abc"` and `""` → 400 |
| AC3.3, AC3.4, AC3.5 | `assigneeId` on `PATCH /tasks/:id` for any logged-in user (not admin-only), `null` unassigns. Row: Assignee dropdown saved like status ("Saved", list reload). "Assign to me" button-link sends `{ assigneeId: <me> }`, shown when the task's assignee is not the logged-in user | `dto/update-task.dto.ts`, `tasks.service.ts`, `public/app.js`, `public/styles.css` | `tasks.service.spec.ts`: user reassigns A → B, A → null, null → self, null → C; `auth.http.spec.ts`: `alice` PATCH `{ assigneeId: admin.id }` → 200 with `assignee: { id, name: 'Admin' }` |
| AC3.6, D2 | Unknown id or removed user → `400 "assigneeId must be an existing user"`, nothing saved | `tasks.service.ts` | `tasks.service.spec.ts`: `findActiveById` → null gives `BadRequestException`, `save` not called (create and update); `auth.http.spec.ts`: admin PATCH random uuid → 400 |
| AC3.7, Q-55 | Responses carry `assignee: { id, name } \| null`, never email or role. Row dropdown options show the name; on open (mousedown, focus) they switch to "Name (email)"; on blur or change they go back to the name | `tasks.service.ts` (`toResponse`), `public/app.js` | `tasks.service.spec.ts`: the response's `assignee` equals `{ id, name }` and has no `email`, `role` or `passwordHash`. Closed/open text: manual (TC-37, TC-72) |
| AC3.8, AC3.16 | `assignee=me\|unassigned` query on list and export. `me` → `task.assigneeId = :userId` (from `req.user`), `unassigned` → `IS NULL`. Combined with tab, priority, status and search. Filter row: "Assignee" select before Search, applied on Search | `dto/task-filter.query.ts`, `tasks.controller.ts`, `tasks.service.ts`, `public/index.html`, `public/app.js` | `tasks.service.spec.ts`: SQL and params for each value, combined with tab and priority; `list-tasks.query.spec.ts`: `assignee=bob` → 400; `tasks.service.db.spec.ts`: real filter results |
| AC3.9 | New nullable `assignee_id` column. `synchronize` adds it as `NULL` on every existing row = "Unassigned" | `task.entity.ts` | `tasks.service.db.spec.ts`: a task saved with no assignee comes back with `assignee: null` |
| AC3.10, AC3.11 | `status` leaves `ADMIN_ONLY_FIELDS`. After the task is read, a non-admin sending `status` must be the task's current assignee, else 403. UI: status dropdown for the admin and the task's assignee, text otherwise | `tasks.service.ts`, `public/app.js` | `tasks.service.spec.ts`: assignee saves status; user on a task assigned to someone else → 403; on an unassigned task → 403; old assignee after reassign → 403 (TC-46); none of these call `save`; `auth.http.spec.ts`: `alice` PATCH `status` on her task → 200, on admin's → 403 |
| AC3.12 | A row change that fails with 403 restores the old value, shows the message and reloads the list, so the row shows status as text. Other failures keep today's behaviour (AC4.5) | `public/app.js` | Manual (TC-47) |
| AC3.13 | No new code: success → "Saved" + reload with the applied filters, so a task unassigned under "Assigned to me" leaves the list (AC4.10 handles an emptied page) | `public/app.js` | Manual (TC-48) |
| AC3.14 | CSV column `assignee` just before `priority`: name or `Unassigned` | `tasks-csv.ts`, `tasks.service.ts` (`RawTaskRow`, `fromRaw`, join) | `tasks-csv.spec.ts`: header `…,createdAt,assignee,priority`; `Alice` and `Unassigned`; `tasks.service.spec.ts`: export row from a raw row with `assignee_name` |
| AC3.15, D3 | The list join has no `removed_at` filter, so a removed assignee's name still shows. `GET /users` lists active users only. Row of a removed assignee: an extra `<option selected disabled>` with the name only | `users.service.ts`, `tasks.service.ts`, `public/app.js` | `users.service.spec.ts` and `users.service.db.spec.ts`: removed user not listed; `tasks.service.db.spec.ts`: task assigned to a removed user returns their name |
| AC3.17 | No new code: `update` saves without a version check, so the last change wins | — | `tasks.service.spec.ts`: two updates in a row, the second assignee is saved |
| AC3.18, Q-54 | `GET /users` ordered by `LOWER(name)`, then `email`. Dropdown: "Unassigned", then "Name (email)" in that order, no "(me)" | `users.service.ts`, `users.controller.ts` (new), `users.module.ts`, `public/app.js` | `users.service.db.spec.ts`: Bob, alice, Admin saved → Admin, alice, Bob; same name ordered by email |

## API contract

**`GET /users`** (new, any logged-in user; 401 without a login)
- 200: `[{ "id": "uuid", "name": "Admin", "email": "admin@example.com" }, …]`: active users only, by name A to Z (case-insensitive), then email. Never `role`, `passwordHash`, `removedAt`.

**`GET /auth/me`, `POST /auth/login`**: response becomes `{ "id", "name", "role" }`. The `id` is needed for "Assign to me" and the assignee's status dropdown. Still no email or hash.

**`POST /tasks`** (admin): new optional `assigneeId`: uuid or `null`.
**`PATCH /tasks/:id`**: new `assigneeId`: uuid or `null` (any logged-in user). Order of checks:
1. Validation (400): `assigneeId must be a UUID`, from the DTO.
2. `title`, `description` or `dueDate` from a non-admin → 403, before the task is read (as today).
3. Task missing → 404 `Task <id> not found`.
4. `status` from a non-admin who is not the task's current assignee → 403 `Forbidden`. The check uses the assignee before this request's change.
5. `assigneeId` not an active user → 400 `assigneeId must be an existing user`.

**Task response** (list items, create, update, get): `isOverdue` stays, `assigneeId` is not returned, and a new `assignee` field is added:
```json
{ "id": "…", "title": "…", "description": null, "status": "todo", "priority": "medium",
  "dueDate": null, "createdAt": "…", "updatedAt": "…",
  "assignee": { "id": "…", "name": "Alice" }, "isOverdue": false }
```

**`GET /tasks`, `GET /tasks/export`**: new query `assignee`: `me` | `unassigned`; omitted = anyone. Invalid → 400 `assignee must be one of the following values: me, unassigned`.

**CSV columns:** `id,title,description,status,dueDate,isOverdue,createdAt,assignee,priority`.

## Data

- `tasks.assignee_id uuid NULL`, FK → `users.id` (no cascade; users are never deleted, only marked `removed_at`), indexed for the "me" filter. `synchronize: true` adds the column and FK on the next start. Existing rows are `NULL` (AC3.9). No column is renamed or dropped.
- `npm run seed` (truncates tasks) and `npm run seed:users` (upserts users by email, same ids) both still work with the FK. Seed tasks stay unassigned.

## Key code

1. **Task ↔ User relation** (`task.entity.ts`). Other tickets build on it, and a loaded relation object wins over the FK column on `save`.
   ```ts
   @Index()
   @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
   assigneeId: string | null;

   // Not eager: a User row holds the password hash; load it only where needed
   @ManyToOne(() => User, { nullable: true })
   @JoinColumn({ name: 'assignee_id' })
   assignee?: User | null;
   ```

2. **Status and assignee rules in `update`** (`tasks.service.ts`). This is the permission change of the ticket.
   ```ts
   const ADMIN_ONLY_FIELDS = ['title', 'description', 'dueDate'] as const;

   if (user.role !== 'admin' && ADMIN_ONLY_FIELDS.some((f) => dto[f] !== undefined)) throw new ForbiddenException();
   const task = await this.tasks.findOne({ where: { id }, relations: { assignee: true } });
   if (!task) throw new NotFoundException(`Task ${id} not found`);
   // Admin or the task's assignee before this change (AC3.10, AC3.11)
   if (dto.status !== undefined && user.role !== 'admin' && task.assigneeId !== user.id) throw new ForbiddenException();
   const { assigneeId, ...fields } = dto;
   if (assigneeId !== undefined) {
     // Set both: TypeORM saves the relation object over the column when both are present
     task.assignee = await this.findAssignee(assigneeId);
     task.assigneeId = task.assignee?.id ?? null;
   }
   Object.assign(task, { ...fields, dueDate: /* unchanged logic */ });
   ```
   `findAssignee(null)` → `null`. Otherwise `UsersService.findActiveById` (`users.service.ts:17-19`), with `BadRequestException('assigneeId must be an existing user')` when it returns null. `TasksModule` imports `UsersModule` and injects `UsersService`, never the `User` repository.

3. **No email or hash in task responses** (`toResponse`). The relation is a full `User` row.
   ```ts
   const { assignee, assigneeId: _id, ...fields } = task;
   return { ...fields, assignee: assignee ? { id: assignee.id, name: assignee.name } : null, isOverdue };
   ```

4. **List query with the join** (`filteredQuery`). With `skip`/`take` and a join, TypeORM switches to a DISTINCT-ids subquery that breaks the `priority_rank` ordering. A many-to-one join can't repeat rows, so use `offset`/`limit`.
   ```ts
   .leftJoin('task.assignee', 'assignee')
   .addSelect(['assignee.id', 'assignee.name'])   // no removed_at filter: removed users keep their name (AC3.15)
   …
   if (query.assignee === 'me') qb.andWhere('task.assigneeId = :userId', { userId: user.id });
   else if (query.assignee === 'unassigned') qb.andWhere('task.assigneeId IS NULL');
   // findAll: .offset((page - 1) * limit).limit(limit).getManyAndCount()
   ```
   Raw stream rows gain `task_assignee_id`, `assignee_id` and `assignee_name`, mapped in `fromRaw`.

5. **Users list** (`users.service.ts`, new `users.controller.ts`). It exposes emails to every user, so the selected columns are fixed.
   ```ts
   listActive(): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
     return this.users.createQueryBuilder('user')
       .select(['user.id', 'user.name', 'user.email'])
       .where('user.removedAt IS NULL')
       .orderBy('LOWER(user.name)', 'ASC').addOrderBy('user.email', 'ASC')
       .getMany();
   }
   ```

6. **Row click handler** (`public/app.js:370-384`). It treats any `data-action` that isn't `edit` as Delete, so `assign-me` must be handled first, or it opens the delete dialog.

## Tests

- **Unit** (`npm test`): the per-AC tests listed above, plus:
  - `auth.service.spec.ts` / `auth.http.spec.ts`: `me` and login return `{ id, name, role }`.
  - `auth.http.spec.ts`: `GET /users` 401 without a login, 200 for a user with no `role` or hash.
  - `auth.http.spec.ts`: the existing "PATCH with status returns 403 and changes nothing" row now reads the task (`findOne` called, `save` not).
  - Mocks in `tasks.service.spec.ts` / `auth.http.spec.ts`: `findOne`, `leftJoin`, `offset`, `limit` added; `UsersService` provided.
- **DB** (`npm run test:db`):
  - `tasks.service.db.spec.ts`: `new TasksService(repo, new UsersService(userRepo))`; assignee filter, removed assignee's name, CSV row, order and paging still stable with the join.
  - `users.service.db.spec.ts`: `listActive` order and removed users.
- **Left for QA / manual:** TC-30 to TC-39, TC-42 to TC-48, TC-55, TC-68 to TC-72, TC-79 in the browser, especially:
  - closed vs open dropdown text in Chrome and Firefox (TC-37, TC-72);
  - "Assign to me" visibility (TC-55);
  - 403 reload (TC-47);
  - removed user's row after `npm run seed:users` with Bob removed and a page refresh (TC-69).

## Out of scope and risks

- **Out of scope:** notifications, assignment history, several assignees, search by assignee name (Q-43), a CSV export button, assigning seed tasks.
- **Native `<select>` text swap:** the browser draws the closed dropdown from the selected option's text, so the plan swaps option text on mousedown/focus and restores it on blur/change. While focused by keyboard but not open, the closed dropdown shows "Name (email)". A custom dropdown would avoid that, but needs much more code and accessibility work.
- **`GET /users` exposes every active user's email to every logged-in user.** Required by Q-52; roles and hashes are never selected.
- **The users list is fetched once at login.** After a users-file reload, the dropdown updates on the next page load.
- **Status order of checks:** a non-admin sending `status` for a missing task now gets 404 instead of 403, because the task is read first.
- **`offset`/`limit` instead of `skip`/`take`:** a mistake would show as wrong order or paging. The existing DB tests on order and stable paging guard it.

## Open questions

None.

## Deviations

- `src/fix-due-dates.ts` (not listed in the plan) builds `TasksService` itself, so it now passes a `UsersService` too. It's a constructor change only; the script's behaviour is the same.
- `tasks.service.db.spec.ts` checks the CSV raw columns by streaming `filteredQuery` on the test transaction's connection, not through `exportCsv`. `exportCsv` streams on its own connection, which can't see the rolled-back test rows. The CSV text itself is covered by `tasks-csv.spec.ts`, `tasks.service.spec.ts` and `tasks.controller.spec.ts`.
