# Ticket 2 — Add Pagination to the Task List

**Source:** [tickets/ticket2.md](../tickets/ticket2.md) · **Prompt:** [v1](../../../docs/prompt-template.md)

## Step 1 — My initial analysis

### What it asks
- Update the task list API to return tasks in pages instead of returning all tasks at once. This should improve response times for users with 2,000+ tasks and make it easier to display large amounts of data page by page in the UI.

### What's ambiguous
- Should we update the existing API and change its response format, or keep the existing API unchanged and introduce a new API version (v2) to support pagination?
- Which pagination strategy should we use: offset-based (`page` + `limit`) or cursor-based (`cursor` + `limit`)?
- What should the default and maximum page sizes be? Does the client need the total number of tasks?
- Which field should be used for sorting, such as `createdAt`, and should the sort order be ascending (ASC) or descending (DESC)?
- Should pagination work together with the existing `search` and `status` filters?
- If pagination supports search, do we need to add database indexes to ensure good query performance when searching large datasets?

### First step
- Evaluate the impact on existing clients and determine whether backward compatibility with the frontend needs to be maintained. Based on this assessment, decide whether to update the existing API or introduce a new API version before implementing pagination.
- Determine which pagination strategy to use: offset-based or cursor-based.
- Define the default page size and decide whether the API needs to return the total number of tasks.
- Determine the default sorting field and sort order.

## Step 2 — AI review

<details>
<summary>Raw AI output</summary>

## 1. Review

**What's correct**
- "What it asks" is accurate. Strategy, page size, sort order and filter interaction are the right open decisions, and putting backward compatibility first is right.

**Gaps**
- **Genuine gap — no definition of "loads quickly".** There's no latency target and no baseline measurement, so nothing tells you when the work is done or what a performance test should assert.
- **Genuine gap — the analysis assumes pagination fixes the slowness.** The ticket gives symptoms (slow, mobile timeouts), not a cause. Your analysis doesn't check where the time goes (query, missing index, payload size, network). If the cause is elsewhere, pagination ships and mobile still times out.
- **Genuine gap — the sort needs a tiebreaker, not just a field.** Tasks with the same `createdAt` can be duplicated or skipped across pages. Tests need data with tied timestamps.
- **Genuine gap — data changing while paging.** If tasks are added or deleted between requests, offset pages shift. That's a key input to the offset vs cursor decision.
- **Genuine gap — compatibility is wider than "the frontend".** The ticket mentions a mobile app. Old app versions can't be updated instantly, so a breaking response change hits them too.
- **Genuine gap — invalid input isn't covered.** Limit above the max, zero or negative values, an invalid cursor. Each one needs a defined response and a test.
- **Unsupported assumption:** "display page by page in the UI". The ticket asks for speed, not a particular UI. Numbered pages vs "load more" is a product decision.
- **Partly misframed:** indexes matter for the sort and the status filter whether or not search is used, not only "if pagination supports search".
- **Examples:** the ticket has none. "2,000+ tasks" and "mobile times out" are symptoms. Neither shows that row count causes the timeout.

## 2. Clarifying questions

**a. For the BA/PM** (questions that could change acceptance criteria come first)
- "What response time counts as 'loads quickly', and on what network?" — this defines done.
- "Must mobile app versions already released keep working with `GET /tasks`?" — decides whether the response change can be breaking.
- "Should users see numbered pages, a 'Load more' button, or infinite scroll?" — drives the strategy choice.
- "Does the UI need the total number of tasks, or of matching tasks?" — a count adds cost.
- "Should the list order stay the same as today?" — avoids a silent UX change.
- "Is it OK for a task to repeat or be skipped if tasks change while someone is paging?" — sets the consistency requirement.

**b. Check in the code yourself first**
- The current query: ordering, filters, how search matches, and existing indexes.
- Time `GET /tasks` against a 2,000+ task dataset and see where the time goes.
- Whether tasks are scoped per user at all, since the ticket talks about "users with 2,000 tasks".
- Every consumer of `GET /tasks` and what it relies on (for example a task count built from the array length).
- Any existing pagination or API-versioning convention, plus existing list tests.

## 3. First step

- Measure before deciding. Reproduce with 2,000+ tasks, time the endpoint, and confirm the bottleneck.
- Then list every consumer to settle compatibility.
- Strategy, page size and sort follow from the BA's answers, so they're decisions to make next, not first steps.

</details>

## Step 4 — Final analysis

### Clarifying questions — BA/PM

- **What counts as "loads quickly", and on what network?** For a user with 5,000 tasks:
  - First page: server response p95 < 500 ms.
  - Mobile: first tasks visible within 2 s on a normal 4G connection.
  - No timeouts.
  - _(PM target; adjust after the baseline measurement)_
- **Must already-released mobile versions keep working with `GET /tasks`?** Yes, so the change must be non-breaking.
  - A request without pagination params returns the same response as today.
  - Pagination is opt-in for new clients.
  - Old versions stay slow until users update. That's accepted.
- **Numbered pages, "Load more", or infinite scroll?** Infinite scroll on mobile: load the next page as the user nears the bottom. No page numbers anywhere, so there's no jumping to page N.
- **Does the UI need the total number of tasks, or of matching tasks?** No, not for this ticket. The UI only needs to know if there are more tasks. A count can be its own ticket if needed later.
- **Should the list order stay the same as today?** Yes, keep the current order. Dev confirms what it is and adds a unique tiebreaker (e.g. `id`) so ties are stable.
- **Is it OK for a task to repeat or be skipped if tasks change while someone is paging?**
  - Never: a task that existed when scrolling started must not repeat or be skipped.
  - OK: a task created mid-scroll may not show until the list is refreshed.
  - OK: a deleted task simply disappears.

**Acceptance criteria**

| Scenario | Expected |
|---|---|
| User with 5,000 tasks opens the list on mobile | First page shown within 2 s, no timeout |
| Scroll to the end of the list | Every task appears exactly once, in today's order |
| Tasks with the same `createdAt` | No duplicates or gaps across pages |
| New task created while scrolling | No duplicate or skipped task; new task shows after refresh |
| Old app version calls `GET /tasks` without params | Same response as today |
| Paging combined with `search` / `status` filters | Filters apply across all pages |
| `limit` over the max | Clamped to the max |
| `limit` zero or negative, or an invalid cursor | 400 with a clear message, never a 500 |

### Clarifying questions — check in code myself

Checked [tasks.service.ts](../../../../task-tracker/src/tasks/tasks.service.ts#L15-L27), [task.entity.ts](../../../../task-tracker/src/tasks/task.entity.ts), [app.js](../../../../task-tracker/public/app.js#L25-L45), [main.ts](../../../../task-tracker/src/main.ts). Ran the query and timed the API against the seeded DB (2,505 tasks, Postgres 17).

- **Current query: ordering, filters, search, indexes?**
  - `ORDER BY created_at DESC`, with no tiebreaker.
  - Optional `status =` filter.
  - Optional `title LIKE '%term%'` (case-sensitive, see ticket 1).
  - No `LIMIT`: every matching row is returned.
  - **The only index is the primary key on `id`.** There's none on `created_at` or `status`.
  - **Tie risk is real, not theoretical.** The seed has only **6 distinct `created_at` values across 2,505 rows**, because rows are bulk-inserted. Paging on `created_at` alone would duplicate or skip tasks, so a tiebreaker such as `id` is required.
- **Where does the time go?** Not the database: the **payload** is the problem.

  | Measure (localhost) | Result |
  |---|---|
  | DB query (`EXPLAIN ANALYZE`, seq scan + sort) | ~0.9 ms |
  | `GET /tasks`, all 2,505 tasks | ~35–45 ms server time |
  | Response size | **~615 KB** JSON, uncompressed |
  | `GET /tasks?status=done` | ~17 ms, ~196 KB |

  - There's **no gzip/compression**: `Content-Length` is the same with `Accept-Encoding: gzip`.
  - Estimate: 615 KB on a slow mobile connection (~50 KB/s) is **~12 s** just to download, before parsing and rendering 2,500 rows. That matches the mobile timeouts.
  - Pagination fixes this by sending fewer rows. Indexes alone won't, because the query is already fast.
  - Compression is a cheap extra win: it cuts the size but still sends every row.
  - _Caveat: measured on localhost only. Confirm the 12 s estimate on a real device or with DevTools throttling._
- **Are tasks scoped per user?**
  - **No.** `Task` has no owner/user field and there's no auth.
  - Every caller gets every task, so "a user with 2,000+ tasks" really means "the whole table".
  - Per-user scoping is out of scope for this ticket.
- **Every consumer of `GET /tasks`, and what it relies on?**
  - In this repo: only the web UI, [app.js](../../../../task-tracker/public/app.js#L31-L34).
    - It expects a **plain JSON array** and builds the count as `tasks.length` ("2505 task(s)").
    - Once paged, that count would show the page size, not the total. The BA decided not to show a total, so the UI text has to change.
  - The **mobile app isn't in this repo**, so I can't see what it relies on. Ask the mobile team.
  - Changing the response from an array to `{ items, nextCursor }` would break both, which supports the BA's opt-in decision.
- **Existing pagination/versioning convention and list tests?**
  - **None.** There's no `setGlobalPrefix`, no API versioning, and no pagination anywhere.
  - There are **no tests**: no spec files and no test framework.
  - The convention has to be chosen in this ticket, and a test setup is needed first.
