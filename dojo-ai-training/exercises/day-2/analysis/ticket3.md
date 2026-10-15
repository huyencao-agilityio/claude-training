# Ticket 3 — Due Dates Show Up One Day Early

**Source:** [tickets/ticket3.md](../tickets/ticket3.md) · **Prompt:** [v1](../../../docs/prompt-template.md)

## Step 1 — My initial analysis

### What it asks
- Ensure that due dates are displayed correctly and that overdue status is calculated consistently with the calendar day selected by the user, regardless of their timezone. For example, if a user selects 20 March, the task should display 20 March.

### What's ambiguous
- When should a task become overdue: after the due date ends or at the beginning of the due date?
- Existing data: tasks that have already been saved may contain incorrect values (e.g., a task due on 20 March in Vietnam is stored as `2026-03-19T17:00Z`). How should due dates be stored in the database? Should they be stored with a timezone, and should they be displayed according to the viewer's timezone?
- The description says that the UK colleague sees the correct date. Were both users looking at the same task? The UK is on UTC+0 in March, so the date may only appear correct by coincidence. Would it still display correctly during summer, when the UK uses British Summer Time (BST, UTC+1)?

### First step
- Reproduce the issue and trace a task end to end. Set the browser timezone to `Asia/Ho_Chi_Minh`, create a task with a due date of 20 March, and compare: (1) the value sent in the request, (2) the value stored in the database, (3) the value returned by the API, and (4) the date displayed in the UI. Repeat the same steps for the seeded `Weekly Report` task. This will help identify which layer is shifting the date.
- Confirm with the BA that a due date represents a calendar day and clarify when a task should become overdue.

## Step 2 — AI review

<details>
<summary>Raw AI output</summary>

## 1. Review

**What's correct**
- "What it asks" frames this as a calendar-day problem, not a display tweak. That's the right framing.
- Questioning the UK example is right. UTC+0 in March makes it weak evidence.
- The existing-data concern and the end-to-end trace are both needed.

**Gaps**
- **Genuine gap — overdue is treated as the same bug as the display.** It may not be. If overdue compares the stored timestamp with "now", a task due 20 March becomes overdue at the *start* of 20 March in any timezone. Fixing the display wouldn't fix that, so tests need separate cases for each.
- **Genuine gap — the reminder email isn't mentioned.** It runs with no viewer, so "whose midnight?" has no browser answer. There's no email code in `task-tracker`, so it may live elsewhere with its own date logic.
- **Genuine gap — scope.** The ticket says "fix the date display", but the symptoms include overdue and email. Unclear scope means unclear acceptance criteria.
- **Genuine gap — existing data may not be correctable.** `2026-03-19T17:00Z` is 20 March in Vietnam but 19 March in the UK. Without the creator's timezone, a migration can only guess.
- **Unsupported assumption — the shift depends on the viewer's timezone.** Your BST point assumes this. It may come from the creator's timezone at save time instead. That changes who is affected and what to test.
- **Misplaced:** "should they be stored with a timezone" is a design decision for the team, not a BA question.
- **Optional enhancement:** test across UTC+, UTC−, UTC+0 and a DST change, on both create and edit.

**Examples**
- VN 20 → 19 March: real bug.
- UK sees the correct date: doesn't show the code is correct.
- Overdue a day early: real, possibly a separate cause.
- Early email: reported, but can't be traced in this repo.

## 2. Clarifying questions

**a. For the BA/PM**
- "Is this ticket only about the date shown, or also the overdue flag and reminder email?" — sets scope and acceptance criteria.
- "Is a task due 20 March overdue from the start of 20 March or from the start of 21 March?" — defines the overdue rule.
- "Whose timezone decides when the due day ends: the creator's, the assignee's, or a company-wide one?" — overdue and email have no viewer.
- "Should already-saved tasks be corrected, and is it acceptable if some can't be fixed automatically?" — migration scope.
- "Was the UK colleague looking at the same task as the Vietnam user?" — decides whether that example is evidence.

**b. Check in the code yourself**
- How the date-picker value is converted before sending, and how the list formats it.
- The `due_date` column type and how `isOverdue` is computed.
- Where the reminder email is sent and its date logic.
- Whether the creator's timezone is stored anywhere.
- Whether other clients send due dates in a different format.

## 3. First step

- The trace is the right first step. Extend it:
  - Add the overdue flag and the reminder email as steps (5) and (6).
  - Use the UK-created `Weekly sync notes` as a control next to `Weekly Report`, viewed from both a UK and a VN browser.
- Send the BA questions in parallel, not after. The overdue rule and scope don't depend on the trace.

</details>

## Step 4 — Final analysis

### Clarifying questions — BA/PM

- **Only the date shown, or also the overdue flag and reminder email?** All three. The user picks a calendar day, and the list, overdue flag and email must all agree with it.
  - If the email code lives outside `task-tracker`, open a linked ticket for it that uses the same rule.
- **Is a task due 20 March overdue from the start of 20 March or of 21 March?** From the start of 21 March. The due date is the last day to finish the task.
- **Whose timezone decides when the due day ends?**
  - The due date has no timezone. Everyone sees "20 March", wherever they are.
  - The day ends at midnight in the **assignee's** timezone, since they do the work.
  - No assignee → use the creator's timezone.
  - No timezone stored for that user → use the company default.
  - _(Dev to check what timezone data exists; if none, this needs a separate ticket)_
- **When is the reminder email sent?** Only after the due day has ended for the assignee, e.g. the morning of 21 March their local time. Never on or before the due date.
- **Should already-saved tasks be corrected, and is it OK if some can't be fixed automatically?**
  - Yes, correct them where the intended day can be worked out (e.g. the creator's timezone is known).
  - Leave tasks that can't be worked out unchanged; don't guess.
  - Report how many there are. If it's a large number, we decide on notifying those users.
- **Was the UK colleague looking at the same task as the Vietnam user?** _(assumed, confirm with support)_ No, it was their own task. That's not evidence the code works: UK is UTC+0 in March, so test UK in summer (BST) too.

**Acceptance criteria** — task due 20 March:

| Viewer / situation | Expected |
|---|---|
| Created and viewed in Vietnam (UTC+7) | Shows 20 March |
| Created in Vietnam, viewed in the UK (GMT and BST) | Shows 20 March |
| Created in a UTC− timezone (e.g. New York) | Shows 20 March |
| Edited later from another timezone without changing the date | Still 20 March |
| Assignee's local time is 20 March 23:59 | Not overdue, no email |
| Assignee's local time is 21 March 00:00 or later | Overdue; reminder email can be sent |
| Existing task whose intended day can be worked out | Corrected to the intended day |
| Existing task whose intended day can't be worked out | Unchanged, included in the report |

### Clarifying questions — check in code myself

Checked [app.js](../../../../task-tracker/public/app.js#L9-L17), [tasks.service.ts](../../../../task-tracker/src/tasks/tasks.service.ts#L37-L70), [task.entity.ts](../../../../task-tracker/src/tasks/task.entity.ts), the DTOs and [seed.ts](../../../../task-tracker/src/seed.ts#L12-L19). Ran the `app.js` date functions in three timezones and queried the seeded DB.

- **How is the date-picker value converted, and how does the list format it?**
  - Sending: `toIsoDate` builds **local midnight** of the picked day, then `toISOString()` converts it to UTC ([app.js:10-13](../../../../task-tracker/public/app.js#L10-L13)). VN 20 March → `2026-03-19T17:00:00Z`.
  - Display: `formatDueDate` takes `iso.slice(0, 10)`, the **UTC** date part ([app.js:15-17](../../../../task-tracker/public/app.js#L15-L17)).
  - **Root cause:** the date is saved as local midnight but shown as the UTC date. Any creator east of UTC sees the day before.
  - The shift depends on the **creator's** timezone at save time, not the viewer's. `slice` ignores the browser, so everyone sees the same wrong date.

  | Creator's timezone | Picks | Stored (UTC) | List shows |
  |---|---|---|---|
  | Vietnam (UTC+7) | 20 Mar | `03-19T17:00Z` | **19 Mar** ❌ |
  | UK, winter (GMT) | 20 Mar | `03-20T00:00Z` | 20 Mar ✅ |
  | UK, summer (BST) | 20 Jul | `07-19T23:00Z` | **19 Jul** ❌ |
  | New York (UTC−4) | 20 Mar | `03-20T04:00Z` | 20 Mar ✅ |

  - The UK example is only correct by coincidence: **UK users will hit the same bug from 29 March, when BST starts.**
- **`due_date` column type, and how `isOverdue` is computed?**
  - The column is `timestamptz` ([task.entity.ts:26](../../../../task-tracker/src/tasks/task.entity.ts#L26)). It stores an instant, not a calendar day. The DB and server run in UTC.
  - `isOverdue = status !== 'done' && dueDate < now` ([tasks.service.ts:66-69](../../../../task-tracker/src/tasks/tasks.service.ts#L66-L69)).
  - **Separate bug:** this compares against the *start* of the due day in the creator's timezone. So a task is overdue from the start of 20 March for **every** user, UK and US included, not from 21 March as the BA decided.
  - Fixing the display alone won't fix the overdue flag.
- **Where is the reminder email sent, and with what date logic?**
  - **Not in this repo.** There's no mail, SMTP, cron, scheduler or reminder code, and no mail dependency in `package.json`.
  - It must live in another service. Find its owner and open the linked ticket the BA asked for.
- **Is the creator's timezone stored anywhere?**
  - **No.** There's no timezone column, no user entity, no creator/assignee on `Task`, and no auth.
  - The BA rule ("day ends at midnight in the assignee's timezone") **can't be built yet**. It needs a separate ticket, or the company default must be used for now.
  - **Good news for existing data:** the web app always saves local midnight, so the stored UTC time of day reveals the creator's offset (`17:00Z` → UTC+7, `23:00Z` → UTC+1, `04:00Z` → UTC−4). The intended day can be worked out for picker-created tasks:
    - UTC time ≥ 12:00 → the next day.
    - Otherwise → the same day.
  - Values not on a whole or half hour didn't come from the picker. Those go in the "can't fix" report.
- **Do other clients send due dates in a different format?**
  - The API accepts **any ISO 8601 string** (`@IsDateString`).
  - `"2026-03-20"` (date only) is parsed as UTC midnight. `"2026-03-20T00:00:00+07:00"` is stored as-is.
  - The mobile app isn't in this repo, so its format is unknown. Ask the mobile team before choosing the new format.
- **Side finding (create a separate ticket):** in `update`, `dueDate: null` passes validation (`@IsOptional` allows null). It then becomes `new Date(null)`, i.e. **1 Jan 1970**, instead of clearing the due date ([tasks.service.ts:54](../../../../task-tracker/src/tasks/tasks.service.ts#L54)).
