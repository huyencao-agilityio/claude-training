# Ticket 5 — Plan: Prevent duplicate tasks on "Save"

**Source:** [tickets/ticket5.md](../../day-2/tickets/ticket5.md) · **Analysis:** [analysis/ticket5.md](../../day-2/analysis/ticket5.md) · **Branch:** `fix/duplicate-task-on-save`

## 1. Root cause

- **Backend saves blindly.** `create` builds the entity and calls `save` with no check ([tasks.service.ts:37-45](../../../task-tracker/src/tasks/tasks.service.ts#L37-L45)). The only constraint is the primary key, a random UUID, so every request becomes a new row.
- **No way to recognise a repeat.** The API has no idempotency key in the DTO, the controller ([tasks.controller.ts:32-35](../../../task-tracker/src/tasks/tasks.controller.ts#L32-L35)) or the headers.
- **Frontend has no in-flight guard.** Every `submit` event (click or Enter) fires a new `fetch`. `#save-btn` is never disabled ([app.js:47-73](../../../task-tracker/public/app.js#L47-L73)).
- **Form keeps its values until the response.** `reset()` runs only after success ([app.js:63-67](../../../task-tracker/public/app.js#L63-L67)), so each extra click resends the same data. There's no "Saving…" feedback, so users on slow connections click again.
- **Side issue:** if `fetch` rejects (offline), the error isn't caught, so the user sees nothing.

## 2. Scope

**In**
- Per-submission idempotency key on `POST /tasks` (backend).
- Web form: generate and send the key, block repeat submits, "Saving…" state, error handling.
- Jest setup, unit tests and one integration test.

**Out**
- Cleaning up existing duplicates. Separate ticket. Run the count query from the analysis on production first.
- Mobile app. It isn't in this repo. Tell the mobile team to send `Idempotency-Key`.
- `PATCH /tasks/:id`. It updates one row by id and can't create rows.
- Blocking tasks with the same content. BA confirmed same-title tasks are allowed.

## 3. Solution design

### API contract

- `POST /tasks` accepts an optional header `Idempotency-Key: <uuid>`.
- **First request with a key:** create the task and return `201` with it.
- **Repeat with the same key:** return `201` with the **existing** task. No new row, no error.
- **No key:** works as today. Old clients keep working.
- **Key that isn't a UUID:** `400`.
- Request body and response shape stay the same. The key isn't returned in the response.

### Backend

- **Entity** ([task.entity.ts](../../../task-tracker/src/tasks/task.entity.ts)): add
  ```ts
  @Column({ name: 'submission_key', type: 'uuid', nullable: true, unique: true })
  submissionKey: string | null;
  ```
  - `synchronize: true` ([data-source.ts:14](../../../task-tracker/src/data-source.ts#L14)) adds the column and the unique index. No migration needed in this project.
  - Postgres allows many `NULL`s under a unique constraint, so tasks without a key are unaffected.
- **Controller:** read the header with `@Headers('idempotency-key', new ParseUUIDPipe({ optional: true }))` and pass it to `create(dto, key)`.
- **Service `create(dto, submissionKey?)`:**
  1. If there's a key, `findOneBy({ submissionKey })`. If found, return it.
  2. Otherwise build and `save` the task with the key.
  3. If `save` throws a `QueryFailedError` with code `23505` (unique violation) and there's a key, another request with the same key won the race. Load that row by key and return it.
  4. Rethrow any other error.
- **`toResponse`:** drop `submissionKey` so the response shape doesn't change.

Why step 3 is needed: two requests that arrive at the same time both pass step 1 (nothing found yet). The unique constraint is what guarantees one row. Step 3 turns the losing request's error into a success.

### Frontend ([app.js](../../../task-tracker/public/app.js))

- `let submissionKey = crypto.randomUUID();` when the page loads.
- `let isSaving = false;` At the start of the submit handler, if `isSaving` is true, return without doing anything. This covers double-click, double Enter, and Enter + click.
- On submit:
  - Set `isSaving = true`, disable `#save-btn`, set its text to "Saving…".
  - Send `Idempotency-Key: submissionKey` with the `fetch`.
  - Wrap it in `try / catch / finally`:
    - **Success:** show "Task saved", `reset()` the form, create a **new** `submissionKey`, `loadTasks()`.
    - **Error response or network error:** keep the input values and show the error ("Could not save, please try again" for network errors). **Keep the same key**, so if the server did save the first time, the retry returns that task.
    - **finally:** `isSaving = false`, re-enable the button, set its text back to "Save".

Changing the input after a failed save and retrying still uses the same key. That's fine: a failed request didn't create a row, so the key is still unused. The one exception is a lost response, where the server already saved with the old values; see Risk R1.

## 4. Scenarios

| ID | Scenario | Layer | Expected |
|---|---|---|---|
| S1 | Double-click "Save" on Slow 3G | FE + BE | Exactly 1 task |
| S2 | Press Enter twice, or Enter then click "Save", on Slow 3G | FE | Exactly 1 task |
| S3 | Click "Save", wait while it's still pending, click again | FE | Exactly 1 task |
| S4 | Same key sent twice, one after the other (lost-response retry) | BE | 1 row; both `201` with the same `id` |
| S5 | Same key sent twice at the same moment (race) | BE | 1 row; both `201` with the same `id` |
| S6 | Same title saved twice as two separate submissions | FE + BE | 2 tasks (allowed) |
| S7 | `POST /tasks` with no key (old client) | BE | `201`, new task every time, as today |
| S8 | Key that isn't a UUID | BE | `400` |
| S9 | Save fails (server down / offline) | FE | Button re-enabled, input kept, error shown |
| S10 | While the request is pending | FE | Button disabled, shows "Saving…" |
| S11 | Response doesn't include `submissionKey` | BE | Response shape unchanged |

## 5. Reproduce (before fix)

**Setup**

```bash
cd task-tracker
npm run db:up && npm run start:dev
# DB helper used below
psql_tt() { docker compose exec -T db psql -U postgres -d task_tracker -c "$1"; }
```

**S5 / S4: API level (proves the backend has no protection)**

```bash
KEY=$(uuidgen)
for i in 1 2; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/tasks \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" \
    -d '{"title":"t5-repro"}' &
done; wait
psql_tt "select count(*) from tasks where title = 't5-repro';"
```

- Actual before fix: `201` twice, **count = 2**. The header is ignored.
- S4: run the same `curl` twice in a row without `&`. Actual: count = 2.
- S8: send `Idempotency-Key: abc`. Actual: `201` (the header is ignored).

**S1 / S2 / S3 / S10: browser**

1. Open http://localhost:3000, DevTools → Network → throttling **Slow 3G**.
2. S1: type title `t5-dblclick`, double-click "Save".
3. S2: type title `t5-enter`, press Enter twice quickly.
4. S3: type title `t5-slow`, click "Save", wait ~2 s, click again.
5. S10: watch the button while the request is pending.
6. Check DevTools Network for the number of `POST /tasks`, and run `psql_tt "select title, count(*) from tasks where title like 't5-%' group by title;"`

- Actual before fix: 2 POSTs and 2 rows for each case. The button stays enabled and still shows "Save".

**S9: offline.** DevTools → Offline, click "Save". Actual: nothing is shown (an uncaught error in the console).

**Cleanup**

```bash
psql_tt "delete from tasks where title like 't5-%';"
```

Record each actual result in section 8's before column.

## 6. Implementation steps

Each step is one commit. Run `npm test` after each.

| # | Step | Files | Commit |
|---|---|---|---|
| 1 | Set up Jest: `jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`, `supertest`, `@types/supertest`. Add `test` and `test:e2e` scripts and the Jest config. | `package.json`, `jest.config.ts`, `test/jest-e2e.json` | `test: set up Jest for unit and e2e tests` |
| 2 | Add `submissionKey` column; service dedupes by key and handles `23505`; `toResponse` drops the key. Unit tests T1–T6. | `task.entity.ts`, `tasks.service.ts`, `tasks.service.spec.ts` | `fix(tasks): dedupe task creation by idempotency key` |
| 3 | Controller reads and validates `Idempotency-Key`. Tests T7–T8, integration test T9. | `tasks.controller.ts`, `tasks.controller.spec.ts`, `test/tasks-idempotency.e2e-spec.ts` | `fix(tasks): accept Idempotency-Key header on create` |
| 4 | Web form: key per submission, in-flight guard, "Saving…", `try/catch/finally`. | `public/app.js` | `fix(tasks): prevent repeat submits of the new task form` |
| 5 | Document the header in the API table. | `task-tracker/README.md` | `docs(tasks): document Idempotency-Key on POST /tasks` |

All commit bodies: `Closes #<ticket 5 issue>`.

## 7. Tests

### Unit: `TasksService` (mocked repository)

Mock `Repository<Task>` with `create`, `save` and `findOneBy` as `jest.fn()`.

| ID | Test | Covers |
|---|---|---|
| T1 | No key → `save` called once, `findOneBy` not called, key saved as `null` | S7 |
| T2 | New key → `findOneBy` returns `null`, `save` called with `submissionKey = key` | S4 |
| T3 | Existing key → `findOneBy` returns a task, `save` **not** called, that task returned | S4, S6 |
| T4 | Race: `findOneBy` → `null`, `save` throws `QueryFailedError` with `driverError.code = '23505'`, second `findOneBy` → task. Returns that task, no throw. | S5 |
| T5 | `save` throws a non-`23505` error → error is rethrown | Error handling |
| T6 | Response doesn't contain `submissionKey`; `isOverdue` is still computed | S11 |

### Unit: `TasksController`

| ID | Test | Covers |
|---|---|---|
| T7 | Valid UUID header → `service.create(dto, key)`; no header → `service.create(dto, undefined)` | S4, S7 |
| T8 | `ParseUUIDPipe({ optional: true })`: `'abc'` throws `BadRequestException`, `undefined` passes | S8 |

### Integration: real Postgres (`npm run db:up` first)

| ID | Test | Covers |
|---|---|---|
| T9 | Boot `AppModule` with supertest. `Promise.all` of 2 POSTs with the same key → both `201`, same `id`, 1 row with that key. Delete the rows afterwards. | S5 (the race a mock can't prove) |
| T10 | Two POSTs with the same title and **different** keys → 2 rows | S6 |

### Frontend

`app.js` is plain DOM code with no build step, so the frontend is checked manually with the checklist in section 8 (S1–S3, S9, S10). A jsdom test would mean pulling the submit handler out into a module; not worth it for this ticket.

## 8. Verify (after fix)

**Automated**

```bash
npm test          # T1–T8
npm run test:e2e  # T9–T10, needs the DB
npm run build     # type check
```

Paste the real output into the MR.

**Rerun section 5 and fill in**

| ID | Before | After |
|---|---|---|
| S1 | 2 POSTs, 2 rows | 1 POST, 1 row |
| S2 | 2 POSTs, 2 rows | 1 POST, 1 row |
| S3 | 2 POSTs, 2 rows | 1 POST, 1 row |
| S4 | 2 rows | 1 row, same `id` both times |
| S5 | 2 rows | 1 row, same `id` both times |
| S8 | `201` | `400` |
| S9 | Nothing shown | Error shown, input kept, button enabled |
| S10 | Button enabled, "Save" | Button disabled, "Saving…" |

**Manual checklist** (Slow 3G)

- [ ] S1 Double-click → 1 task
- [ ] S2 Double Enter / Enter + click → 1 task
- [ ] S3 Click again while pending → 1 task
- [ ] S6 Save "Weekly report", then save "Weekly report" again → 2 tasks
- [ ] S9 Offline → error, input kept, button re-enabled; go online, click "Save" → 1 task
- [ ] S10 "Saving…" and disabled button while pending; back to "Save" afterwards
- [ ] After a successful save, the next save creates a new task (the key was regenerated)
- [ ] DevTools: every `POST /tasks` carries an `Idempotency-Key` header

## 9. Risks & open questions

| ID | Item | Plan |
|---|---|---|
| R1 | Same key re-sent with a **different body** (user edited the form after a lost response) | Return the original task and don't apply the new values. Rare; confirm with BA. Alternative: `422` when the body differs. |
| R2 | Keys are kept forever (no TTL) | Fine at this size: one nullable UUID per task. |
| R3 | Mobile app doesn't send the key | Still has the bug until it does. Notify the mobile team; the key is optional so nothing breaks. |
| R4 | `synchronize: true` adds the unique index automatically | Fine in dev. A real deployment needs a migration; note it in the MR. |
| R5 | Second tab with the same form | Different key, so it creates a second task. This matches the BA ("a new submission"). |

## 10. Definition of done

- [ ] S1–S11 pass (automated or manual), with before/after recorded
- [ ] `npm test`, `npm run test:e2e` and `npm run build` are green
- [ ] README API table documents `Idempotency-Key`
- [ ] Mobile team notified (R3); R1 confirmed with BA
- [ ] MR description drafted per the root `CLAUDE.md` and approved before pushing
