---
name: create-pull-request
description: Draft and open a GitLab merge request for the current branch of the claude-training repo (course notes, exercises, Claude setup or task-tracker code), with an imperative title and a What / Why / How tested / Screenshots / Risk description. Use when the user asks to create a merge request, pull request, MR or PR.
argument-hint: "[issue number]"
---

# Create a merge request

GitLab project: `huyen.cao/claude-training`. Target branch: `main`.

Hard rules:
- Draft the title and description, show them, and wait for the user's approval **before** pushing or creating the MR.
- Never enable auto-merge and never merge. The user merges.
- Only describe what the diff actually changes. Don't claim behavior or content that already exists on `main`.
- Never invent check results. If you didn't run something, say so.

## 1. Collect the facts

```bash
git branch --show-current
git fetch origin main
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- . ':(exclude)**/package-lock.json'
```

- If the branch is `main`, stop: the work needs its own branch (`<type>/<short-kebab-description>`).
- Check that the branch doesn't already have an open MR. If it does, offer to update that MR's description instead of creating a new one.
- If there are uncommitted changes, ask whether they belong in this MR (use the `commit-message` skill) or should be left out.
- Issue: `$ARGUMENTS`, else the `Closes #N` / `Refs #N` in the commits. If there is one, read it to get the problem right. If there is none, don't block on it; ask only when the MR is a code fix or feature.
- Map the changed paths to the areas in the table below. An MR can touch several areas: run the checks and fill the sections for each one.

## 2. Area rules

| Area | Paths | Checks to run | What / How tested / Screenshots / Risk |
|------|-------|---------------|-----------------------------------------|
| Course notes | `dojo-ai-training/docs/` | Relative links resolve; `dojo-ai-training/README.md` lists added/renamed/moved files | **What**: topics or lessons added/changed. **Screenshots**: N/A. **Risk**: links from other files to anything renamed or moved. |
| Exercises | `dojo-ai-training/exercises/day-N/` | Same as course notes; links to `../task-tracker` code point to existing files and lines | **What**: which day, what the exercise did and its result. **Screenshots**: optional (e.g. the Claude output being discussed). |
| Claude setup | `**/CLAUDE.md`, `**/.claude/` | Skill / agent frontmatter is valid YAML with `name` and `description`; paths and commands it mentions exist | **What**: which rule, skill or agent, and what Claude now does differently. **Risk**: which workflows it affects. |
| Tickets | `docs/tickets/` | Format follows `.claude/rules/tickets.md` | **What**: which ticket, what was added or changed (ACs, answered questions). **Screenshots**: N/A. **Risk**: the issue description must be updated to match. |
| task-tracker | `task-tracker/` (except its `CLAUDE.md`) | From the repo root: `npx tsc -p task-tracker --noEmit` and `npm --prefix task-tracker test`. Bug fix: the new test's failing output before the fix (see below) | **What**: behavior change from the API/UI user's view + exact code change (file, function). **How tested**: test counts before → after, manual checks such as a `curl` or UI step. **Screenshots**: before/after when the UI changes, else N/A. **Risk**: endpoints/screens affected, schema change (`synchronize: true` alters the table on next start). |

Bug-fix "before" result for task-tracker: prefer the failing output from the TDD step if it's in the conversation. Otherwise run the new test against `main`'s code, then put the fix back:

```bash
git restore --source origin/main -- <fixed source files>   # keep the new spec
npm --prefix task-tracker test -- <spec file>              # expect it to fail
git restore --source HEAD -- <fixed source files>
```

## 3. Draft

**Title**: imperative, describes the change, no `fix:` / `feat(...)` prefix, ≤ 72 chars.
- Good: `Add course notes for lessons 7-8`, `Add day 4 code review exercise`, `Share commit and MR skills across the repo`, `Match task titles case-insensitively in search`
- Bad: `docs(exercises): day 4`, `Update claude-code-101.md`, `Fix #6`, `Daily update`

**Description**: short bullet points only, no long paragraphs. Fill each section from the area rules above.

```markdown
## What
- <one bullet per change: what changed and where (file, section or function)>

## Why
- Closes #<issue> / Refs #<issue> (leave this bullet out if there is none)
- <the problem, gap or goal behind the change>

## How tested
- <each check you ran and its real result>
- Manual checks:
  - [ ] <a step the user can do to confirm, e.g. "Markdown renders in the GitLab preview", "`GET /tasks?search=report` returns 'Write Report'">

## Screenshots
| Before | After |
| ------ | ----- |
| _add screenshot_ | _add screenshot_ |

## Risk
- <scope of impact, per area>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- **Ticket branch** (the diff adds a `docs/plans/` file): add a `## Review guide` section after What, so the reviewer can read the change before the code. Build it from the diff and the plan, not from memory:
  - table `File | What changed | Why (AC)`, one row per changed file except the analysis and plan files; lock files are one row
  - `AC | Files | Unit test`, one row per AC of the plan
  - the plan's Deviations, or "None"
  - links to the plan and analysis files in the branch
- Leave manual-check boxes unchecked unless you actually did them.
- Keep the Screenshots section even when there is nothing to show: replace the table with `N/A (<reason>, e.g. docs only / no UI change)`.

Example (docs-only MR):

```markdown
## What
- `docs/claude-code-101.md`: add a "Skills" section (lesson 7) and a "Subagents" section (lesson 8)
- `README.md`: list the new sections in the Docs table

## Why
- Notes for lessons 7-8 of the course

## How tested
- Relative links in changed files: all resolve
- Manual checks:
  - [ ] Markdown renders correctly in the GitLab preview

## Screenshots
N/A (docs only)

## Risk
- Docs only, no code change
```

Show the title + description and ask for approval. Apply any edits the user asks for.

## 4. Push and create (after approval only)

```bash
git push -u origin HEAD
```

Then create the MR: source = current branch, target = `main`, the approved title and description, delete the source branch on merge. Use the GitLab tools, or `glab mr create` if they aren't available.

Report the MR URL. Don't merge, approve, or set auto-merge.
