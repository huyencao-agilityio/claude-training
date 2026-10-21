---
name: daily-report
description: Write the user's daily team report (DONE / IN-PROGRESS / ISSUES / NEXT-PLAN) from their git commits, branches, GitLab issues and merge requests in the claude-training repo, as [#ID] ticket lines ready to copy. Use when the user asks for a daily report, daily update, standup report, end-of-day report or "what did I do today".
argument-hint: "[date: today | yesterday | YYYY-MM-DD, default today]"
---

# Daily report

GitLab project: `huyen.cao/claude-training`. Report date: `$ARGUMENTS`, default today (local time). Use `yesterday` or a `YYYY-MM-DD` date for an earlier day.

Hard rules:
- Read only. Don't commit, push, change files, or post the report anywhere (GitLab, Slack, email). Show it for the user to review and copy.
- Never invent a ticket ID, ticket title, blocker or plan. Everything in the report must come from git, GitLab or what the user said in the conversation.
- Only the user's own work: filter by their git author, not the whole team's.

## 1. Collect the facts

From anywhere in the repo (`--all` covers every folder, not only `task-tracker/`), with `<since>` / `<until>` the start and end of the report day (e.g. `2026-10-21 00:00` / `2026-10-22 00:00`):

```bash
git fetch --all --prune -q
git config user.email
git log --all --no-merges --author="<email>" --since="<since>" --until="<until>" \
  --format='%h|%ad|%D|%s|%b' --date=format:'%H:%M'
git log origin/main --merges --since="<since>" --until="<until>" --format='%h|%s'
git branch -a --no-merged origin/main --format='%(refname:short) %(committerdate:short)'
```

Then from GitLab (read-only tools):
- MRs the user authored and updated on the report day: `mcp__gitlab__list_merge_requests` (`project_id`, `scope: created_by_me`, `state: all`, `updated_after` = `<since>`). Note each one's state (`merged`, `opened`, `closed`) and, if open, unresolved threads or a failed pipeline.
- Every issue referenced by `Closes #N` / `Refs #N` in those commits or MRs, or in branch names: `mcp__gitlab__get_issue` for its exact title and state.
- Open issues assigned to the user: `mcp__gitlab__my_issues`. They're used only as NEXT-PLAN candidates (step 3).

If GitLab is unreachable, build the report from git alone, take ticket IDs only from `Closes #N` / `Refs #N` lines, and tell the user which titles couldn't be checked.

## 2. Group the work into tickets

One line per ticket, not per commit. Group the commits by the ticket ID in their `Closes #N` / `Refs #N` lines: every commit, the branch and the MR for the same ID become one line, with that ticket's title. Never list commit summaries under a ticket.

- **Ticket ID**: the GitLab issue number as `#N`, taken from `Closes #N` / `Refs #N` in the commits or MR, or from the MR's linked issue. Branch names here carry no ID. An ID only counts if the issue exists (`get_issue`) or, when GitLab is down, if a commit names it.
- **Commits without an ID**: if another commit on the same branch, or the branch's MR, names an ID, the commit belongs to that ticket. Otherwise it's its own line (see Title).
- **Title**: the issue title of that ID, exactly as in GitLab. No issue: use the MR title, else the commit summary rewritten as a short title in sentence case (`docs(agent-skills): add notes on ...` → `Add notes on the Introduction to Agent Skills course`), with no ID.
- **Status**: decided per ticket, not per commit (step 3). One MR for the ticket makes the whole line DONE, even if some of its commits are still on a branch without an MR.
- Skip merge commits ("Merge branch ...") and commits that only sync `main` into a branch.

## 3. Sort the tickets into sections

| Section | What goes in | Evidence |
|---|---|---|
| **DONE** | Work that reached an MR on the report day | MR opened or merged that day (add `(MR !N in review)` after the title if it's still open), issue closed that day, or commits pushed straight to `main` that day. The issue doesn't have to be closed |
| **IN-PROGRESS** | Work started or continued but with no MR yet | Commits on a branch that has no MR, or work on an open issue that has no MR yet |
| **ISSUES** | Real blockers or unresolved problems | Only what the user said, or hard evidence: failed pipeline, merge conflicts with `main`, an MR with unresolved review threads, an MR waiting on someone else. Say what blocks and on whom |
| **NEXT-PLAN** | Next steps | What the user said, plus the obvious next step for each IN-PROGRESS item and each MR still in review (e.g. "Address review comments on MR !6"). Open assigned issues not yet started are candidates: list them under NEXT-PLAN only if the user confirms, otherwise mention them below the report as suggestions |

- A ticket appears in one of DONE / IN-PROGRESS, never both. A ticket with an MR is DONE, whether the MR is open or merged and whether the issue is closed or not; follow-up work on it (review fixes) goes under NEXT-PLAN.
- Only work with activity on the report day (commits, MR merged or updated, issue closed). An old unmerged branch with no new commits isn't reported.
- Empty section: `None` when you checked and there is nothing (e.g. no failed pipeline, no conflicts, no open review threads for ISSUES). `Not provided` when the sources can't tell (e.g. blockers the user hasn't mentioned and git doesn't show).
- If nothing at all was found for the day, say so and ask whether to use another date or author before writing an empty report.

## 4. Write the report

Concise, professional English, one `[#ID] Title` line per ticket, no commit hashes or file names unless they help the team. Always the four headings, in this order, inside a `text` code block so it copies cleanly. Illustrative example (`#12`, `#13` and `!7` are made up):

```text
DONE:
[#10] Filter task list by overdue
[#12] Export tasks as CSV (MR !7 in review)
Add notes on the Introduction to Agent Skills course

IN-PROGRESS:
[#13] Import tasks from CSV

ISSUES:
None

NEXT-PLAN:
[#12] Address review comments on MR !7
```

Below the block, add a short note for the user (not part of the report):
- Items you weren't sure about and why (e.g. "#9 title not checked: GitLab unreachable").
- NEXT-PLAN suggestions from open assigned issues that weren't added.
- Anything to fill in by hand, such as blockers only they know about.
