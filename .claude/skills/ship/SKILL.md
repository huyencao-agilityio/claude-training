---
name: ship
description: Dev step 3 - ship an implemented and manually tested ticket from its worktree - commit the code, tests, analysis and plan files, then push and open the GitLab merge request with a review guide (what changed per file and why). Every commit, push and MR waits for the user's OK. Use when the user asks to ship, finish, commit and push, or open the MR for a ticket.
argument-hint: "<issue URL | #N>"
---

# Ship a ticket

**Ends with:** the ticket's commits pushed and a merge request open. The user merges.

This skill only orders two others: `commit-message` (how to commit) and `create-pull-request` (MR format, checks, push). Approvals follow `.claude/rules/git-conventions.md`.

## Steps

1. **Gate.** Work in the ticket's worktree (`.claude/worktrees/<slug>`, `EnterWorktree` if needed). Its plan `docs/plans/<issue-number>-*.md` must say `Status: Implemented`; otherwise stop and point to `/implement-plan`. If it isn't clear from this conversation that the developer finished the manual test, ask.
2. **Commit** with the `commit-message` skill. The analysis and plan files go in the same commit as the code they describe. Use `Closes #<issue>`.
3. **MR** with the `create-pull-request` skill, which adds the review guide for ticket branches. Show the title and description, wait for the OK, then push and create the MR.
4. **Report** the commit hashes and MR URL. After the user merges, the worktree can be removed with `git worktree remove .claude/worktrees/<slug>`.
