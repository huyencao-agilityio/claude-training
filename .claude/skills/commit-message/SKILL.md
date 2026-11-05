---
name: commit-message
description: Write Conventional Commits messages for changes anywhere in the claude-training repo (task-tracker code, dojo-ai-training docs and exercises) and commit them, splitting mixed daily work into one commit per logical change. Use when the user asks to commit, write a commit message, or save/push the day's work to git.
argument-hint: "[issue number]"
---

# Commit changes in claude-training

Commit only when the user asks for it. Never push unless the user asks in the same request.

## 1. Check what will be committed

```bash
git status --short
git diff --staged
```

- If nothing is staged, show the changed files grouped by area (below) and propose how to stage them. Don't run `git add -A`: the repo often has unrelated work in progress (half-done notes, local experiments, a `package-lock.json` that changed by accident).
- Never stage `.env`, real credentials, real project code, or customer data.
- If you are on `main` and the work is code, suggest a branch first: `<type>/<short-kebab-description>` (e.g. `fix/search-case-sensitive`), no issue ID.

## 2. Split daily work into logical commits

A day's work usually mixes code, course notes and exercises. Don't make one "daily update" commit. Group the changes and make one commit per group, in this order:

| Area | Paths | Typical commit |
|------|-------|----------------|
| App code + its tests | `task-tracker/src/`, `task-tracker/public/` | `feat(tasks): ...`, `fix(search): ...`, `test(tasks): ...` |
| App tooling / deps | `task-tracker/package*.json`, `tsconfig*.json`, `docker-compose.yml` | `chore(deps): ...` |
| Course notes | `dojo-ai-training/docs/` | `docs(claude-code-101): ...` (scope = the notes file / topic) |
| Exercises | `dojo-ai-training/exercises/day-N/` | `docs(exercises): add day 4 ...` (the day goes in the summary, not the scope) |
| Tickets | `docs/tickets/` | `docs(tickets): add login ticket` |
| Ticket analysis and plan | `docs/analyze/`, `docs/plans/` | No commit of their own: they go in the commit of the code they describe |
| Claude setup | `**/CLAUDE.md`, `.claude/` (skills, agents, rules, settings) | `chore(claude): ...` |

Show the proposed split (files → message) and let the user adjust it before committing. A code change and the test for it belong in the same commit. A dependency added for that code (e.g. a new package in `package.json` + lock file) also belongs in it.

## 3. Verify each group before committing

- **`task-tracker/src/` or `task-tracker/package*.json` changed** (run from the repo root):
  ```bash
  npx tsc -p task-tracker --noEmit
  npm --prefix task-tracker test
  ```
  If either fails, report the output and don't commit that group unless the user says to.
- **`dojo-ai-training/` changed** (no build there): check that relative links in the changed files point to files that exist, and that `dojo-ai-training/README.md` tables list any file that was added, renamed or moved. Report broken links you find; fix them only if the user agrees.
- **Claude setup only**: no checks needed.

## 4. Write the message

```
<type>(<scope>): <summary>

<optional body: why the change was needed, wrapped at 72 chars>

Closes #<issue>
```

- **type**: `feat` (new behavior), `fix` (bug fix), `test` (tests only), `refactor` (no behavior change), `docs` (notes, exercises, READMEs), `chore` (deps, config, tooling, Claude setup)
- **scope**: the feature or area, not the folder name. Code: `tasks`, `search`, `seed`, `ui`, `deps`. Docs: `claude-code-101`, `exercises`. Claude setup: `claude`. Omit it for repo-wide changes (e.g. `docs: split dojo AI training into docs and exercises`).
- **summary**: English, imperative ("add", not "added"/"adds"), lowercase start, ≤ 72 chars, no trailing period. Describe the change, not the file: `add notes on subagents and skills`, not `update claude-code-101.md`.
- **body**: optional. Explain *why* when it isn't obvious from the summary.
- **issue**: `Closes #N` when the commit fixes the GitLab issue, `Refs #N` when it's related. Use `$ARGUMENTS` if given, else the branch name / conversation. Code fixes and features usually have an issue: ask if unknown. Docs and exercise commits often have none: leave the line out, don't ask.
- End with the attribution line from the system reminder, if there is one.

Examples:

```
fix(search): match task titles case-insensitively

Closes #6
```

```
docs(claude-code-101): add notes for lessons 7-8
```

```
docs(exercises): add day 4 code review exercise

Refs #9
```

```
chore(claude): add shared commit and merge request skills
```

## 5. Commit

Commit each group with a heredoc so the formatting survives:

```bash
git add <files of this group>
git commit -m "$(cat <<'EOF'
docs(claude-code-101): add notes for lessons 7-8
EOF
)"
```

Finish with `git log --oneline -<number of commits>` and report the hashes. If the user also asked to push: `git push` (or `git push -u origin HEAD` for a new branch). Never push to `main` directly unless the user explicitly says so.
