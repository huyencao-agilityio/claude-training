# Ticket 1 — Search doesn't find tasks that obviously exist

**Source:** [tickets/ticket1.md](../tickets/ticket1.md) · **Prompt:** [v1](../../../docs/prompt-template.md)

## Step 1 — My initial analysis

### What it asks
- Fix the task search so that a search term finds tasks whose title "obviously" matches it.

### What's ambiguous
- Should the search be case-sensitive or case-insensitive?
- Partial words, multiple words in any order (`report monthly`)
- Which fields are searched: title only, or title + description?

### First step
- Reproduce it before touching code.
- ask BA to know that should search the title + description too?

## Step 2 — AI review

<details>
<summary>Raw AI output</summary>

## 1. Review

**What's correct**
- "What it asks" is accurate, and reproducing first is right. Case sensitivity is a fair hypothesis.

**Gaps**
- **Genuine gap — both examples are the same case.** Lowercase term, capitalised word, second word in the title. That fits case-sensitive and start-of-title matching equally, so "case only" is unsupported. A fix for the wrong one leaves the bug.
- **Genuine gap — example 2 doesn't prove a matching bug.** Example 1 says "got nothing back"; example 2 says only "can't find", which could mean the task is hidden in a non-empty list. Different cause, different fix.
- **Genuine gap — causes outside text matching are missing.** Status filters, ownership and pagination can hide a task. Unless they're ruled out, tests can pass while users still can't find it.
- **Genuine gap — no expected results.** No "term X returns task Y" list means no definition of done and no regression tests.
- **Optional enhancement:** multi-word any-order search and searching the description. Neither example needs them. Also split "partial words" from "multiple words": only partial matching affects this bug.

## 2. Clarifying questions

**a. For the BA/PM** (questions that could change acceptance criteria come first)
- "Should a term match anywhere in the title, or only at the start of the title or of a word?" — this sets the core match rule.
- "Should search ignore upper and lower case?" — makes the expectation testable.
- "Should part of a word match, e.g. `rep` → 'Report'?" — decides contains vs whole-word matching.
- "For the 'Weekly Report' user, did the search return nothing, or other tasks without that one?" — tells a matching bug apart from a filtering bug.
- "Were the missing tasks completed, archived, or owned by someone else?" — rules filters in or out.
- "Should the description be searched too, or only the title for now?" — scope only, shouldn't block the fix.

**b. Check in the code yourself first**
- The match operator: case-sensitive or not (incl. DB collation, which can differ dev vs prod), and prefix vs anywhere.
- Server or client search, and which status, owner or pagination filters apply.
- Input handling: trimming, special characters such as `%` or `_`.
- Existing search tests and what they cover.

## 3. First step

- Keep "reproduce first", but isolate the cause: search `Report`, `report`, `Monthly`, `monthly`, `rep` against "Monthly Report", one factor at a time.
- Read the search query before contacting the BA; it may answer section 2b.
- Ask the BA about the match rule first. The description question is scope, not this bug.

</details>

## Step 4 — Final analysis

### Clarifying questions — BA/PM

- **Match anywhere in the title, or only at the start?** Anywhere. "Monthly Report", "Report draft" and "Q3report" all match `report`.
- **Ignore case?** Yes. `report`, `Report` and `REPORT` return the same results, in every environment (don't rely on DB collation).
- **Partial words, e.g. `rep` → "Report"?** Yes. It's a "contains" search, not whole-word.
- **"Weekly Report" user: empty result, or other tasks without that one?** _(assumed, confirm with support)_ Empty, same as the first report. If they saw other tasks, it's a filtering bug: separate ticket.
- **Were the missing tasks completed, archived, or someone else's?** _(assumed, confirm with support)_ The user's own active tasks.
  - Other users' tasks stay out of results. That's correct behaviour.
  - Whether completed/archived tasks show up is out of scope: keep current behaviour.
- **Search the description too?** No, title only for this ticket. Description search and multi-word any-order search go to the backlog.

**Acceptance criteria** — the user owns an active task "Monthly Report":

| Search term | Result |
|---|---|
| `report`, `Report`, `REPORT` | found |
| `monthly` | found |
| `rep`, `port` | found |
| `  report  ` (spaces around it) | found (input trimmed) |
| `weekly` | not found |
| `%`, `_` | treated as normal text, not wildcards |

- A task owned by another user is never returned.
- Searches that already worked return the same results (regression tests added).

### Clarifying questions — check in code myself

Checked [tasks.service.ts](../../../../task-tracker/src/tasks/tasks.service.ts#L15-L27), [list-tasks.query.ts](../../../../task-tracker/src/tasks/dto/list-tasks.query.ts), [app.js](../../../../task-tracker/public/app.js#L25-L45). Ran the queries against the seeded DB (2,505 tasks, Postgres 17, collation `en_US.utf8`).

- **Match operator: case-sensitive? prefix or anywhere?**
  - The query is `task.title LIKE '%<term>%'` ([tasks.service.ts:19](../../../../task-tracker/src/tasks/tasks.service.ts#L19)).
  - It matches **anywhere** in the title, so the prefix theory is ruled out.
  - It is **case-sensitive**. Postgres `LIKE` is always case-sensitive, whatever the collation, so the dev vs prod collation concern doesn't apply.
  - DB result:

    | Query | Matches |
    |---|---|
    | `LIKE '%report%'` | `Quarterly report draft` only |
    | `LIKE '%Report%'` | `Monthly Report`, `Weekly Report` |
    | `ILIKE '%report%'` | all 3 |

  - **Root cause:** case sensitivity explains both examples in the ticket.
- **Server or client search, and which filters apply?**
  - Search runs on the **server**. The frontend sends `search` and `status` as query params ([app.js:26-31](../../../../task-tracker/public/app.js#L26-L31)).
  - `status` is only applied if the user picks one. By default it's "all".
  - There's no owner, user scoping or pagination: `Task` has no owner field and there's no auth.
  - So the only thing that can hide a task besides the match is a status filter the user selected.
  - The seeded "Monthly Report" and "Weekly Report" tasks are both `todo`. This supports the BA assumption that it's a matching bug, not a filtering bug.
- **Input handling: trimming, `%`, `_`?**
  - **No trimming** anywhere, so `" report "` searches with the spaces included.
  - An empty search box is skipped by the frontend.
  - **`%` and `_` are not escaped.** They act as wildcards, so searching `%` or `_` returns all 2,505 tasks.
  - `\` is also Postgres's default `LIKE` escape character.
  - The value is passed as a bound parameter, so there's no SQL injection, only wildcard leakage.
- **Existing search tests?**
  - **None.** There are no `*.spec.ts` files, no test script in `package.json`, and no Jest or test framework installed.
  - The fix needs a test setup first, then tests that cover the BA acceptance table.
