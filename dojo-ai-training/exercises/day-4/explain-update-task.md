# Exercise: Use AI to explain a feature, then verify it yourself

## 1. Exercise

"Explore this codebase and explain how feature X works", then verify two of its claims by reading the code yourself.

## 2. Prompt used

```text
Act as a Senior Developer, please help me explore this codebase of the task-tracker folder and explain how the "update task" feature works end-to-end.

Please cover:
1. Where the request enters (route/endpoint, HTTP method)
2. Which files and functions it passes through, in order
3. How input is validated
4. What happens if the task ID doesn't exist
5. How the data is saved (database/file/memory)
6. What response is returned

For each step, cite the file path and line number.
```

## 3. Summary of the AI's response

### Request flow

```
PATCH /tasks/:id  (JSON body)
  └─ main.ts                    global ValidationPipe (whitelist + transform)
     └─ TasksController.update  ParseUUIDPipe on :id, UpdateTaskDto on body
        └─ TasksService.update  findOneBy → 404, or Object.assign → save
           └─ TypeORM Repository<Task> → PostgreSQL table "tasks"
        └─ toResponse()         adds isOverdue → 200 JSON
```

### Answers to the 6 questions

| # | Question | Answer | Code |
|---|---|---|---|
| 1 | Entry point | `PATCH /tasks/:id`. Only reachable through the API; the web UI has no edit button | [tasks.controller.ts:18](../../../task-tracker/src/tasks/tasks.controller.ts#L18), [tasks.controller.ts:37](../../../task-tracker/src/tasks/tasks.controller.ts#L37) |
| 2 | Path through the code | Global `ValidationPipe` → `TasksController.update` → `TasksService.update` → `toResponse` | [main.ts:9](../../../task-tracker/src/main.ts#L9), [tasks.controller.ts:38-39](../../../task-tracker/src/tasks/tasks.controller.ts#L38-L39), [tasks.service.ts:47-57](../../../task-tracker/src/tasks/tasks.service.ts#L47-L57), [tasks.service.ts:66-70](../../../task-tracker/src/tasks/tasks.service.ts#L66-L70) |
| 3 | Validation | `id` must be a UUID (`ParseUUIDPipe`, else 400). Body is checked by `UpdateTaskDto`, all fields optional. Unknown fields are silently stripped (`whitelist: true`) | [tasks.controller.ts:38](../../../task-tracker/src/tasks/tasks.controller.ts#L38), [update-task.dto.ts](../../../task-tracker/src/tasks/dto/update-task.dto.ts), [main.ts:9](../../../task-tracker/src/main.ts#L9) |
| 4 | Task ID doesn't exist | `findOneBy` returns `null`, service throws `NotFoundException` → HTTP 404 | [tasks.service.ts:48-51](../../../task-tracker/src/tasks/tasks.service.ts#L48-L51) |
| 5 | How data is saved | PostgreSQL through TypeORM. Read → `Object.assign` → `save`, which runs an `UPDATE` on changed columns. `updated_at` is set automatically. No locking: last write wins | [tasks.service.ts:48-56](../../../task-tracker/src/tasks/tasks.service.ts#L48-L56), [task.entity.ts:32-33](../../../task-tracker/src/tasks/task.entity.ts#L32-L33), [data-source.ts:4-15](../../../task-tracker/src/data-source.ts#L4-L15) |
| 6 | Response | `200 OK` with the task plus a computed `isOverdue` flag (not stored in the DB). Errors: 400 (bad UUID or body), 404 (not found) | [tasks.service.ts:9](../../../task-tracker/src/tasks/tasks.service.ts#L9), [tasks.service.ts:67-68](../../../task-tracker/src/tasks/tasks.service.ts#L67-L68) |

### Validation rules for the body

| Field | Rule | Code |
|---|---|---|
| `title` | string, not empty, ≤ 200 chars | [update-task.dto.ts:5-9](../../../task-tracker/src/tasks/dto/update-task.dto.ts#L5-L9) |
| `description` | string | [update-task.dto.ts:11-13](../../../task-tracker/src/tasks/dto/update-task.dto.ts#L11-L13) |
| `status` | `todo` / `in_progress` / `done` | [update-task.dto.ts:15-17](../../../task-tracker/src/tasks/dto/update-task.dto.ts#L15-L17) |
| `dueDate` | ISO 8601 date string | [update-task.dto.ts:19-21](../../../task-tracker/src/tasks/dto/update-task.dto.ts#L19-L21) |

### Bugs the AI flagged

`@IsOptional()` skips validation for both `undefined` **and** `null`, so `null` gets through the DTO.

| Input | Expected | Actual | Code |
|---|---|---|---|
| `"dueDate": null` | Clear the due date | Due date becomes `1970-01-01` and `isOverdue: true` | [tasks.service.ts:54](../../../task-tracker/src/tasks/tasks.service.ts#L54) |
| `"title": null` | 400 Bad Request | 500, because the `title` column is NOT NULL | [task.entity.ts:17-18](../../../task-tracker/src/tasks/task.entity.ts#L17-L18) |

The AI also noted that [tasks.service.spec.ts](../../../task-tracker/src/tasks/tasks.service.spec.ts) has no tests for `update`.

## 4. Verifying 2 claims

### Claim 1: "If the task ID doesn't exist, the API returns 404"

| Step | Result |
|---|---|
| Location the AI pointed to | [tasks.service.ts:48-51](../../../task-tracker/src/tasks/tasks.service.ts#L48-L51) |
| Reading the code | Line 48 calls `findOneBy({ id })`. Lines 49-51 throw `NotFoundException` when no task is found |
| Running it | `PATCH /tasks/<valid but non-existent UUID>` → HTTP 404, message `"Task ... not found"` |
| **Verdict** | ✅ **Correct** |

### Claim 2: "Sending `dueDate: null` changes the due date to 1970-01-01" (bug)

| Step | Result |
|---|---|
| Location the AI pointed to | [tasks.service.ts:54](../../../task-tracker/src/tasks/tasks.service.ts#L54) and [update-task.dto.ts:19-21](../../../task-tracker/src/tasks/dto/update-task.dto.ts#L19-L21) |
| Reading the code | `update-task.dto.ts:19-21`: `dueDate` uses `@IsOptional()`, which skips validation for `null` too, so `null` gets through.<br>`tasks.service.ts:54`: only checks `dto.dueDate !== undefined`. `null !== undefined` is `true`, so the code runs `new Date(null)` |
| Running it | `PATCH /tasks/<id>` with body `{"dueDate": null}` → `"dueDate": "1970-01-01T00:00:00.000Z"`, `"isOverdue": true` |
| **Verdict** | ✅ **Correct**. The AI found a real bug |

## 5. Takeaways

- **Accuracy:** the AI got both claims right, with exact files and line numbers.
- **Two ways to check:** each claim was verified by reading the code (to understand the cause) and by calling the API (to confirm the real behavior). Reading code only gives a hypothesis; running it is what confirms it, because middleware, transforms or the database can change the outcome.
- **Lesson:** AI makes it much faster to understand a codebase and can even find bugs. But every important claim, especially "there is a bug", still needs to be verified before you trust it or change code.
- **Next steps:**
  - [ ] Fix the `dueDate: null` and `title: null` bugs
  - [ ] Add unit tests for `TasksService.update` ([tasks.service.spec.ts](../../../task-tracker/src/tasks/tasks.service.spec.ts) has none yet)
