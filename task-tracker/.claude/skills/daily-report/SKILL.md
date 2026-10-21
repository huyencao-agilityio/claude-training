---
name: daily-report
description: Write the user's daily team report listing the tickets they finished that day, from their git commits, merge requests and GitLab issues in the claude-training repo, as [#ID] ticket lines ready to copy. Use when the user asks for a daily report, daily update, standup report, end-of-day report or "what did I do today".
argument-hint: "[date: today | yesterday | YYYY-MM-DD, default today]"
---

# Daily report

GitLab project: `huyen.cao/claude-training`. Report date: `$ARGUMENTS`, default today (local time). Use `yesterday` or a `YYYY-MM-DD` date for an earlier day.

The report lists only the tickets the user finished that day. In-progress work, blockers and plans aren't in git, so the user adds them by hand if the team needs them.

Hard rules:
- Read only. Don't commit, push, change files, or post the report anywhere (GitLab, Slack, email). Show it for the user to review and copy.
- Never invent a ticket ID or ticket title. Everything in the report must come from git or GitLab.
- Only the user's own work: filter by their git author, not the whole team's.

## 1. Collect the facts

From anywhere in the repo (`--all` covers every folder, not only `task-tracker/`), with `<since>` / `<until>` the start and end of the report day (e.g. `2026-10-21 00:00` / `2026-10-22 00:00`):

```bash
git fetch --all --prune -q
git config user.email
git log --all --no-merges --author="<email>" --since="<since>" --until="<until>" \
  --format='%h|%ad|%D|%s|%b' --date=format:'%H:%M'
git log origin/main --no-merges --first-parent --author="<email>" --since="<since>" --until="<until>" --format='%h|%s'
```

The second `git log` lists commits pushed straight to `main` (not through an MR).

Then from GitLab (read-only tools):
- MRs the user authored and updated on the report day: `mcp__gitlab__list_merge_requests` (`project_id`, `scope: created_by_me`, `state: all`, `updated_after` = `<since>`). Keep the ones opened or merged that day; note which are still open.
- Every issue referenced by `Closes #N` / `Refs #N` in those commits or MRs: `mcp__gitlab__get_issue` for its exact title.

If GitLab is unreachable, build the report from git alone, take ticket IDs only from `Closes #N` / `Refs #N` lines, and tell the user which titles couldn't be checked.

## 2. Pick the done tickets

A ticket is done on the report day when it has an MR opened or merged that day, whether the MR is still open or the issue is closed or not. Commits pushed straight to `main` that day also count.

Commits on a branch with no MR aren't done: leave them out.

## 3. Group the work into tickets

One line per ticket, not per commit. Group the commits by the ticket ID in their `Closes #N` / `Refs #N` lines: every commit, the branch and the MR for the same ID become one line, with that ticket's title. Never list commit summaries under a ticket.

- **Ticket ID**: the GitLab issue number as `#N`, taken from `Closes #N` / `Refs #N` in the commits or MR, or from the MR's linked issue. Branch names here carry no ID. An ID only counts if the issue exists (`get_issue`) or, when GitLab is down, if a commit names it.
- **Commits without an ID**: if another commit on the same branch, or the branch's MR, names an ID, the commit belongs to that ticket. Otherwise it's its own line (see Title).
- **Title**: the issue title of that ID, exactly as in GitLab. No issue: use the MR title, else the commit summary rewritten as a short title in sentence case (`docs(agent-skills): add notes on ...` → `Add notes on the Introduction to Agent Skills course`), with no ID.
- Skip merge commits ("Merge branch ...") and commits that only sync `main` into a branch.

If no ticket was done that day, say so and ask whether to use another date before writing an empty report.

## 4. Write the report

Concise, professional English, one `[#ID] Title` line per ticket in the order they were done, no commit hashes or file names. Add `(MR !N in review)` after the title when the MR is still open. Put it inside a `text` code block so it copies cleanly. Illustrative example (`#12` and `!7` are made up):

```text
DONE:
[#10] Filter task list by overdue
[#12] Export tasks as CSV (MR !7 in review)
Add notes on the Introduction to Agent Skills course
```

Below the block, add a short note for the user (not part of the report):
- Items you weren't sure about and why (e.g. "#9 title not checked: GitLab unreachable").
- Commits left out because their branch has no MR yet, so the user can check nothing is missing.
