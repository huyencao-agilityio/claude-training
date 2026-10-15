## Ticket 1 — Search doesn't find tasks that obviously exist

*Description:*
Several users say the task search is "broken." One user searched for `report` and got nothing back, even though they have a task called "Monthly Report." Another user can't find a task titled "Weekly Report" when they search for `ticket`. Search used to work fine. Please fix it so users can find their tasks.

What it asks:
- Fix the task search so that a search term finds tasks whose title "obviously" matches it.

What's ambiguous:
- What "find" means: case-insensitive only?
- Partial words, multiple words in any order (`report monthly`)
- Which fields are searched: title only, or title + description?

First step:
- Reproduce it before touching code.
- ask BA to know that should search the title + description too?


## Ticket 2 — Add Pagination to the Task List

**Description:**

Some power users have more than 2,000 tasks, and the `GET /tasks` endpoint returns too much data, making it slow to load and difficult to display in the UI.

### What it asks:
- Update the task list API to return tasks in pages instead of returning all tasks at once. This should improve response times for users with 2,000+ tasks and make it easier to display large amounts of data page by page in the UI.

### What's ambiguous:
- Should we update the existing API and change its response format, or keep the existing API unchanged and introduce a new API version (v2) to support pagination?
- Which pagination strategy should we use: offset-based (`page` + `limit`) or cursor-based (`cursor` + `limit`)?
- What should the default and maximum page sizes be? Does the client need the total number of tasks?
- Which field should be used for sorting, such as `createdAt`, and should the sort order be ascending (ASC) or descending (DESC)?
- Should pagination work together with the existing `search` and `status` filters?
- If pagination supports search, do we need to add database indexes to ensure good query performance when searching large datasets?

### First step:
- Evaluate the impact on existing clients and determine whether backward compatibility with the frontend needs to be maintained. Based on this assessment, decide whether to update the existing API or introduce a new API version before implementing pagination.
- Determine which pagination strategy to use: offset-based or cursor-based.
- Define the default page size and decide whether the API needs to return the total number of tasks.
- Determine the default sorting field and sort order.


## Ticket 3 — Due Dates Show Up One Day Early

**Description:**

A user in Vietnam set a task's due date to **20 March**, but the task list shows **19 March**. A colleague of theirs in the UK sees the correct date. Some tasks are now flagged as overdue a day too early. Please fix the date display.

### What it asks:
- Ensure that due dates are displayed correctly and that overdue status is calculated consistently with the calendar day selected by the user, regardless of their timezone. For example, if a user selects 20 March, the task should display 20 March.

### What's ambiguous:
- When should a task become overdue: after the due date ends or at the beginning of the due date?
- Existing data: tasks that have already been saved may contain incorrect values (e.g., a task due on 20 March in Vietnam is stored as `2026-03-19T17:00Z`). How should due dates be stored in the database? Should they be stored with a timezone, and should they be displayed according to the viewer's timezone?
- The description says that the UK colleague sees the correct date. Were both users looking at the same task? The UK is on UTC+0 in March, so the date may only appear correct by coincidence. Would it still display correctly during summer, when the UK uses British Summer Time (BST, UTC+1)?

### First step:
- Reproduce the issue and trace a task end to end. Set the browser timezone to `Asia/Ho_Chi_Minh`, create a task with a due date of 20 March, and compare: (1) the value sent in the request, (2) the value stored in the database, (3) the value returned by the API, and (4) the date displayed in the UI. Repeat the same steps for the seeded `Weekly Report` task. This will help identify which layer is shifting the date.
- Confirm with the BA that a due date represents a calendar day and clarify when a task should become overdue.


## Ticket 4 — Export Tasks to CSV

**Description:**

Team leads want to download their tasks as a CSV file so they can work with the data. Add an "Export" button to the task list page. The export should include the important task information and respect the filters currently applied by the user.

### What it asks:
- Add an "Export" button to the task list page that allows users to download tasks as a CSV file.
- Include only tasks that match the filters currently applied on the page (currently `search` and `status`).

### What's ambiguous:
- Which task fields should be included in the export? What should the column order and headers be? For example, should the file include `title`, `description`, `status`, `due date`, and `created/updated dates`?
- When pagination is enabled, should the export include **all tasks matching the current filters across all pages**, or only the tasks displayed on the current page?
- What format should each field use in the exported file? For example, should dates be formatted as `2026-03-20` or `20/03/2026`?
- Is there a row limit? Is downloading all tasks in a single request sufficient for 2,000+ tasks, or should the export use streaming to improve performance?
- What should the exported file be named?

### First step:
- Ask the BA to provide a sample CSV file or confirm the required columns, column order, headers, and data formats.
- Clarify whether the export should include all tasks matching the current filters across all pages or only the tasks on the current page.
- Evaluate the download approach, such as generating the entire CSV at once or streaming the data, based on the expected dataset size and performance requirements.


## Ticket 5 — Double-Clicking "Save" Creates Duplicate Tasks

**Description:**

QA found that clicking "Save" quickly twice on the New Task form creates two identical tasks. A few users have reported the same issue, mostly on slow connections. Please ensure this cannot happen.

### What it asks:
- Submitting the New Task form must create exactly one task, even if the user clicks "Save" multiple times or the connection is slow.

### What's ambiguous:
- Does this issue only affect task creation, or can duplicate records also occur when updating existing tasks?
- Should the frontend disable the "Save" button immediately after the first click to prevent users from submitting the form multiple times?
- What should happen if the first request succeeds but the response never reaches the client, causing the user to click "Save" again? Should the API return an error indicating a duplicate submission, or should it return a successful response indicating that the task has already been created, while ensuring that only one record exists in the database?
- Are there any existing duplicate task records in the database that need to be identified and removed?

### First step:
- Reproduce the issue by opening the New Task form, enabling network throttling in DevTools (e.g., "Slow 3G"), and double-clicking "Save".
- Debug the request flow and inspect the existing duplicate-validation logic to understand how it works and why it fails to prevent duplicate tasks.
- Ask the BA to clarify whether duplicate prevention is required at both the backend and frontend levels, including whether the frontend should prevent repeated clicks on the "Save" button.
- Ask the BA to define the expected UI/UX behavior when a duplicate submission is detected, including what message should be displayed to the user.

======================================================
My prompt:
Act as a Senior Developer reviewing my ticket analysis before implementation.
Review my analysis — don't redo it from scratch, don't restate it, and don't invent issues to seem thorough.

Ticket:
Title: Search doesn't find tasks that obviously exist
Description: Several users say the task search is "broken." One user searched for `report` and got nothing back, even though they have a task called "Monthly Report." Another user can't find a task titled "Weekly Report" when they search for `ticket`. Search used to work fine. Please fix it so users can find their tasks.

My analyze
What it asks:
- Fix search so a term finds tasks whose title "obviously" matches it.
What's ambiguous:
- What "find" means: case-insensitive only?
- Partial words, multiple words in any order (e.g. `report monthly`)?
- Fields searched: title only, or title + description?
First step:
- Reproduce the issue before touching code.
- Ask the BA whether search should include title + description.

Your Tasks:
1. Review — What's correct, what's missing or wrong, and which assumptions are unsupported. For each significant gap, say briefly why it matters for implementation or testing. Mark each as a genuine gap or an optional enhancement. Check whether each example in the ticket actually demonstrates a bug.
2. Clarifying questions — Split into:
   a. Questions for the BA/PM about expected behaviour: give the exact wording and one line on why. Put questions that could change acceptance criteria first.
   b. Things I should check in the code myself before asking anyone.
   Don't answer the questions.
3. First step — Review my first step and suggest a better one only if needed.

Output: three headed sections, bullets only, under ~400 words. No code or implementation plan.
