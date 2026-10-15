# Ticket 4 — Export Tasks to CSV

**Source:** [tickets/ticket4.md](../tickets/ticket4.md) · **Prompt:** [v1](../prompt-template.md)

## Step 1 — My initial analysis

### What it asks
- Add an "Export" button to the task list page that allows users to download tasks as a CSV file.
- Include only tasks that match the filters currently applied on the page (currently `search` and `status`).

### What's ambiguous
- Which task fields should be included in the export? What should the column order and headers be? For example, should the file include `title`, `description`, `status`, `due date`, and `created/updated dates`?
- When pagination is enabled, should the export include **all tasks matching the current filters across all pages**, or only the tasks displayed on the current page?
- What format should each field use in the exported file? For example, should dates be formatted as `2026-03-20` or `20/03/2026`?
- Is there a row limit? Is downloading all tasks in a single request sufficient for 2,000+ tasks, or should the export use streaming to improve performance?
- What should the exported file be named?

### First step
- Ask the BA to provide a sample CSV file or confirm the required columns, column order, headers, and data formats.
- Clarify whether the export should include all tasks matching the current filters across all pages or only the tasks on the current page.
- Evaluate the download approach, such as generating the entire CSV at once or streaming the data, based on the expected dataset size and performance requirements.

## Step 2 — AI review

<details>
<summary>Raw AI output</summary>

## 1. Review

**What's correct**
- Columns, cross-page scope and date format are the right open questions. Each one changes what a test asserts.
- Linking the cross-page question to pagination is right, because ticket 2 adds pagination to this same list.

**Gaps**
- **Genuine gap — "their tasks" is unsupported.** `Task` has no owner, assignee or team, and there's no auth. So either the export covers all tasks, or ownership is a prerequisite outside this ticket. This decides scope.
- **Genuine gap — the export inherits tickets 1 and 3.** It reuses the same search (title only, case-sensitive `LIKE`) and the same `dueDate` (one day early for UTC+7). A test that checks "CSV matches the list" would pass on wrong data.
- **Genuine gap — "current filters" is ambiguous in the UI.** Filters apply only when the user clicks "Search". If the search box was edited but not submitted, does Export use the box or the rows shown?
- **Genuine gap — CSV correctness isn't covered.** Titles and descriptions can contain commas, quotes, newlines and non-ASCII text. Excel needs the right encoding, and cells starting with `=`, `+`, `-` or `@` are a formula-injection risk. These are test cases, not BA preferences.
- **Unsupported assumption — streaming may be needed.** The seed has ~2,500 rows, and nothing shows one response is too slow. Optional enhancement at most.
- **Optional enhancement:** file name, and empty-result behaviour.
- The field question should also cover the computed `isOverdue` flag and `id`.

**Examples**
- The ticket has no examples. It's a feature request, not a bug report, so there's nothing to verify.

## 2. Clarifying questions

**a. For the BA/PM**
- "Should the export contain every task, or only tasks belonging to the team lead? If only theirs, how is a task linked to a person?" — sets scope and may block the ticket.
- "Which columns, in what order, with what headers? Should it include Overdue?" — core acceptance criteria.
- "After pagination ships, should Export include all matching tasks or only the visible page?" — changes the query and test data.
- "If the search box was edited but not submitted, should Export use the typed value or the list shown?" — defines "current filters".
- "Will users open the file in Excel, and what date format do they expect?" — encoding and date format.
- "What should happen when no tasks match?" — empty-state test.

**b. Check in the code yourself**
- Whether `Task` has any owner or assignee field, and whether auth exists.
- How `findAll` builds the search and status filters, so the export can reuse them.
- The status of tickets 1, 2 and 3, since they change search, paging and dates.
- How `formatDueDate` renders dates, so the CSV matches the screen.

## 3. First step

- Asking the BA for a sample CSV is good. Keep it.
- Replace "evaluate streaming" with the ownership question. It's the only one that could block the ticket.
- Check the status of tickets 1–3 before agreeing acceptance criteria, so the export doesn't lock in known bugs.

</details>

## Step 4 — Final analysis

### Clarifying questions — BA/PM

- **Every task, or only the team lead's? How is a task linked to a person?** Export the same tasks the list shows today.
  - Tasks have no owner yet, so that means all tasks.
  - Limiting the export to "my tasks" needs ownership first. That's a separate ticket and doesn't block this one.
- **Which columns, in what order, with what headers? Include Overdue?** Yes, include Overdue. The columns, in this order:

  | # | Header | Content |
  |---|---|---|
  | 1 | `ID` | Task id |
  | 2 | `Title` | Full title |
  | 3 | `Description` | Full text, empty if none |
  | 4 | `Status` | Same label as the list |
  | 5 | `Due date` | `YYYY-MM-DD`, empty if none |
  | 6 | `Overdue` | `Yes` / `No` |
  | 7 | `Created at` | `YYYY-MM-DD HH:mm`, viewer's local time |
  | 8 | `Updated at` | `YYYY-MM-DD HH:mm`, viewer's local time |

- **After pagination ships, all matching tasks or only the visible page?** All tasks matching the filters, across every page. Users export to get the full data set.
- **Search box edited but not submitted: typed value or the list shown?** The list shown: export uses the last applied filters. What you see is what you export.
- **Excel, and what date format?** Yes, users will open the file in Excel.
  - Save as UTF-8 with BOM, so Vietnamese and other non-ASCII text displays correctly.
  - Dates use ISO `YYYY-MM-DD`: it's unambiguous and sorts correctly.
  - The due date shows the calendar day the user picked, using the ticket 3 rule.
- **What happens when no tasks match?** The download still works and gives a file with only the header row. No error.
- **File name:** `tasks-YYYY-MM-DD.csv`, using today's date.

**Acceptance criteria**

| Scenario | Expected |
|---|---|
| Filter by status, click Export | CSV has exactly the tasks the list shows, all pages included |
| Search box edited but not submitted | Export uses the last applied filters |
| Title with commas, quotes or a line break | Opens in Excel as one correct cell |
| Vietnamese title, e.g. "Báo cáo tháng" | Shows correctly in Excel |
| Title starting with `=`, `+`, `-` or `@` | Shown as text, never run as a formula |
| Task due 20 March, exported from Vietnam | `Due date` is `2026-03-20` |
| No tasks match | File with the header row only |

- The export reuses the list's search and date logic, so the fixes for tickets 1 and 3 apply to it too. Test against the fixed behaviour, not today's bugs.

### Clarifying questions — check in code myself

Checked [task.entity.ts](../../../task-tracker/src/tasks/task.entity.ts), [tasks.service.ts](../../../task-tracker/src/tasks/tasks.service.ts#L15-L27), [app.js](../../../task-tracker/public/app.js), [index.html](../../../task-tracker/public/index.html#L30-L40). Queried the seeded DB (2,505 tasks).

- **Does `Task` have an owner or assignee, and does auth exist?**
  - **No.** The fields are only `id`, `title`, `description`, `status`, `dueDate`, `createdAt`, `updatedAt`.
  - There's no user entity and no auth guard.
  - This confirms the BA decision: export all tasks the list shows. "Team lead's tasks" needs ownership first.
- **How does `findAll` build the filters, and can Export reuse them?**
  - The query builder is built inline in `findAll` ([tasks.service.ts:16-23](../../../task-tracker/src/tasks/tasks.service.ts#L16-L23)): `ORDER BY created_at DESC` plus optional `title LIKE` and `status =`.
  - To make sure the export and the list never drift apart, **extract that filter logic into one shared method** that both the list and the export call.
  - Generate the CSV **on the server** (e.g. `GET /tasks/export?search=&status=`), not in the browser. After ticket 2 the browser holds only one page, but the BA wants all matching tasks.
- **Status of tickets 1, 2 and 3?**
  - **All unfixed** in the current code: case-sensitive `LIKE`, no pagination, and the UTC-slice due date.
  - Order the work **1 and 3 → 4**, or build the export on the shared filter method and the fixed date rule so it picks up the fixes.
  - Ticket 2 matters less: the export ignores paging either way.
- **How does `formatDueDate` render dates?**
  - `iso.slice(0, 10)`: the UTC date part ([app.js:15-17](../../../task-tracker/public/app.js#L15-L17)). That's the ticket 3 bug: VN 20 March shows `2026-03-19`.
  - **Don't copy it into the CSV.** Use the same fixed calendar-day logic as ticket 3, or the export repeats the bug.
- **Dev notes on the BA answers:**
  - **"Last applied filters" isn't stored anywhere.** `loadTasks` reads the form fields when it runs ([app.js:26-29](../../../task-tracker/public/app.js#L26-L29)), so an unsubmitted edit would leak into Export. The UI must save the filters on each Search and send those to Export.
  - **Status labels live only in the frontend** (`STATUS_LABELS` in [app.js:7](../../../task-tracker/public/app.js#L7)). A server-side CSV needs the same labels, so move them to one shared place.
  - **"Viewer's local time" for Created/Updated at:** the server runs in UTC and doesn't know the viewer's timezone. The client must send it with the export request, e.g. `tz=Asia/Ho_Chi_Minh`.
  - **Empty values are common:** 500 tasks have no due date and 1,668 have no description. Write them as empty cells, not `null` or `—` (`—` is what the UI shows).
  - **The seed has no CSV edge cases:** no titles with commas, quotes or newlines, no Vietnamese text, nothing starting with `=+-@`. Tests must create that data themselves.
  - **No test setup exists** (same as tickets 1–3).
