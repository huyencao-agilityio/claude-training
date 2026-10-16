# CLAUDE.md

Training repo for the 15-day Claude course (see `README.md` for the day-by-day plan). Each top-level folder has its own `CLAUDE.md`:

- `dojo-ai-training/`: Markdown course notes (`docs/`) and exercises (`exercises/day-N/`)
- `task-tracker/`: NestJS + PostgreSQL app used to practice analyzing, fixing and reviewing code with Claude

Use only sample or made-up data. Real project code, customer data, API keys and `.env` contents stay out of the repo.

Tasks and bugs are tracked as GitLab issues in `huyen.cao/claude-training`.

## Commit messages

Conventional Commits: `<type>(<scope>): <summary>`

- type: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
- scope: the feature or area changed, e.g. `tasks`, `search`, `seed`, `claude-code-101`. Not the folder name. Omit it for repo-wide changes.
- summary: English, imperative mood, ≤ 72 characters, no trailing period
- Reference the GitLab issue in the body: `Refs #6` (related) or `Closes #6` (fixes it)

Example:

```
fix(search): match task titles case-insensitively

Closes #6
```

## Branch names

`<type>/<short-kebab-description>`, using the same types as commits. No issue ID in the branch name; link the issue in the commit and MR instead.

Example: `fix/search-case-sensitive`, `feat/export-tasks-csv`

## Merge requests

- Draft the MR description and get the user's approval before pushing or creating the MR. Never enable auto-merge or merge into `main`; the user merges.
- Title: plain English describing the change, no `fix:` / `feat(...)` prefix. Example: `Match task titles case-insensitively in search`
- Description sections, each written as short bullet points (no long paragraphs):
  - **What**: behaviour change and the exact code change
  - **Why**: `Closes #<issue>` plus the problem being solved
  - **How tested**: commands run with real results (before vs after), and manual checks as checkboxes
  - **Screenshots**: before / after placeholders for the user to fill in
  - **Risk**: scope of impact
- Only describe what the diff actually changes; don't claim behaviour that already existed on `main`.
