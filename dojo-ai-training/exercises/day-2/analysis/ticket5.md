# Ticket 5 — Double-Clicking "Save" Creates Duplicate Tasks

**Source:** [tickets/ticket5.md](../tickets/ticket5.md) · **Prompt:** [v1](../../../docs/prompt-template.md)

## Step 1 — My initial analysis

### What it asks
- Submitting the New Task form must create exactly one task, even if the user clicks "Save" multiple times or the connection is slow.

### What's ambiguous
- Does this issue only affect task creation, or can duplicate records also occur when updating existing tasks?
- Should the frontend disable the "Save" button immediately after the first click to prevent users from submitting the form multiple times?
- What should happen if the first request succeeds but the response never reaches the client, causing the user to click "Save" again? Should the API return an error indicating a duplicate submission, or should it return a successful response indicating that the task has already been created, while ensuring that only one record exists in the database?
- Are there any existing duplicate task records in the database that need to be identified and removed?

### First step
- Reproduce the issue by opening the New Task form, enabling network throttling in DevTools (e.g., "Slow 3G"), and double-clicking "Save".
- Debug the request flow and inspect the existing duplicate-validation logic to understand how it works and why it fails to prevent duplicate tasks.
- Ask the BA to clarify whether duplicate prevention is required at both the backend and frontend levels, including whether the frontend should prevent repeated clicks on the "Save" button.
- Ask the BA to define the expected UI/UX behavior when a duplicate submission is detected, including what message should be displayed to the user.

## Step 2 — AI review

<details>
<summary>Raw AI output</summary>

## 1. Review

**What's correct**
- "Exactly one task" is the right acceptance target.
- The lost-response case is the right hard question. Disabling the button doesn't cover it, so it decides whether the fix needs a backend part.

**Gaps**
- **Unsupported assumption — "existing duplicate-validation logic".** There is none. `POST /tasks` saves blindly: no unique constraint, no idempotency key, no check in `create`. The work is building prevention, not debugging a broken check.
- **Genuine gap — what makes two tasks "duplicates"?** Two tasks with the same title can be valid (e.g. "Weekly report" every week). Rejecting on matching content would block real use. This decides the whole approach and its tests.
- **Genuine gap — other ways to resubmit.** Pressing Enter submits the form too, and the form only resets after the response. Tests must cover Enter, double-click and click-after-slow-response, not just double-click.
- **Genuine gap — "can't happen" vs frontend-only.** A disabled button doesn't stop retries, a second tab or direct API calls. Whether the API is used by other clients sets how strong the guarantee must be.
- **Mostly answerable in code — the update question.** `PATCH /tasks/:id` targets one row by id, so it can't create a new row. Check this yourself instead of asking.
- **Optional enhancement:** cleaning up existing duplicates. Useful, but only once "duplicate" is defined.

**Examples**
- QA double-click: real bug, matches the code.
- Slow-connection users: consistent with the code (no "saving" state), but not confirmed. They may have clicked again because nothing showed progress.

## 2. Clarifying questions

**a. For the BA/PM**
- "Can a user deliberately create two tasks with the same title and details?" — decides between blocking same content and blocking only repeated submits.
- "Must duplicates be prevented for API calls and retries too, or only for clicks in the form?" — sets how strong "can't happen" is.
- "If a repeat submit is detected, should the user see success with the existing task, or an error?" — defines the expected result.
- "Should existing duplicate tasks be cleaned up as part of this ticket?" — scope.

**b. Check in the code yourself**
- `TasksService.create` and the `tasks` table for any unique constraint or dedupe check.
- `app.js` submit handler: is the button disabled, is there any in-flight guard, when does `reset()` run?
- Whether anything else calls `POST /tasks` (scripts, other clients).
- Whether the database already has identical rows created seconds apart.

## 3. First step

- Reproducing with Slow 3G is right. Add Enter-key and click-after-slow-response cases.
- Replace "inspect the existing duplicate-validation logic" with "confirm there is none".
- Merge the two BA questions into the "what counts as a duplicate" question. It comes first, because frontend vs backend follows from it.

</details>

## Step 4 — Final analysis

### Clarifying questions — BA/PM

- **Can a user deliberately create two tasks with the same title and details?** Yes. A user may really want two "Weekly report" tasks.
  - So don't block on matching content.
  - Block only a repeat of the **same submission**: one fill-in of the form plus "Save" makes at most one task.
  - Filling in the form again, or saving from a second tab, is a new submission and may create a second task.
- **Must duplicates be prevented for API calls and retries too, or only for clicks in the form?** Both.
  - The form must stop repeat clicks.
  - Also, a retry of the same submission must never create a second task, even if it comes from a network retry or another API client.
  - A frontend-only fix is not enough to close this ticket.
- **If a repeat submit is detected, success with the existing task or an error?** Success. The user sees the normal "task created" result and one task in the list. No error and no duplicate warning, because from their side nothing went wrong.
- **What the user sees while saving:**
  - From the first click, "Save" is disabled and shows "Saving…".
  - On success, the form resets.
  - On failure, the button is re-enabled, the typed values are kept, and an error message is shown so they can try again.
- **Should existing duplicate tasks be cleaned up in this ticket?** No. We can't reliably tell accidental duplicates from deliberate ones.
  - Dev reports how many identical tasks were created within a few seconds of each other.
  - We decide on cleanup in a separate ticket.

**Acceptance criteria** — on a Slow 3G connection:

| Scenario | Expected |
|---|---|
| Double-click "Save" | Exactly one task created |
| Press Enter twice, or Enter then click "Save" | Exactly one task created |
| Click "Save" again after a slow response | Exactly one task created |
| First request saved, response lost, client retries the same submission | One task; retry returns success with that task |
| Save the same title twice as two separate submissions | Two tasks (allowed) |
| While saving | Button disabled, shows "Saving…" |
| Save fails (e.g. offline) | Button re-enabled, input kept, error shown |

### Clarifying questions — check in code myself

Checked [tasks.service.ts](../../../../task-tracker/src/tasks/tasks.service.ts#L37-L45), [tasks.controller.ts](../../../../task-tracker/src/tasks/tasks.controller.ts), [app.js](../../../../task-tracker/public/app.js#L47-L73), [index.html](../../../../task-tracker/public/index.html#L15-L26). Queried the seeded DB and sent two identical `POST /tasks` at the same time.

- **Does `TasksService.create` or the `tasks` table have a unique constraint or dedupe check?**
  - **No.** `create` builds the entity and calls `save` with no check ([tasks.service.ts:37-45](../../../../task-tracker/src/tasks/tasks.service.ts#L37-L45)).
  - The only DB constraint is the primary key on `id`, a random UUID, so every request gets a new row.
  - There's no idempotency key in the DTO, the controller or the headers.
  - **Reproduced at the API level:** two identical POSTs sent together both returned `201` and created **2 rows, 15 ms apart**. Test rows deleted afterwards.
  - This confirms the fix needs a backend part. Per the BA, it shouldn't be a unique constraint on content, because same-title tasks are allowed. Use a **per-submission key** instead: the client generates an ID once per form fill-in, and the server stores it with a unique constraint.
- **`app.js` submit handler: button disabled? in-flight guard? when does `reset()` run?**
  - **The button is never disabled.** `#save-btn` has an id in the HTML, but `app.js` never uses it.
  - **No in-flight guard:** no "saving" flag, and every `submit` event fires a new `fetch`.
  - Enter and click both trigger `submit`, so double Enter duplicates too.
  - `reset()` runs only **after** a successful response ([app.js:63-67](../../../../task-tracker/public/app.js#L63-L67)). Until then the form keeps its values, so every extra click resends the same data.
  - **No "Saving…" feedback** either. On a slow connection the user sees nothing happen, which explains why users click again.
  - On error the values are kept and the message is shown. That already matches the BA, but there's no button to re-enable yet.
- **Does anything else call `POST /tasks`?**
  - In this repo, **only the web form** ([app.js:57](../../../../task-tracker/public/app.js#L57)).
  - The seed script writes straight to the DB through the repository, not the API.
  - The **mobile app isn't in this repo.** It must send the same submission key, or it keeps the bug. Tell the mobile team.
  - Make the key **optional at first** so older app versions keep working, as decided for ticket 2.
- **Does the DB already have identical rows created seconds apart?**
  - **None in the seeded data.** There are 0 groups with the same title, description, status and due date created within 10 s of each other.
  - This is a dev DB, though. Run the same query on production for the cleanup count the BA asked for:

    ```sql
    select title, count(*) from tasks
    group by title, coalesce(description, ''), status, due_date
    having count(*) > 1 and max(created_at) - min(created_at) < interval '10 seconds';
    ```
- **Also:** no tests or test framework exist (same as tickets 1–4).
