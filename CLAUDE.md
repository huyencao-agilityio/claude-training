# CLAUDE.md

Training repo for the 15-day Claude course (see `README.md` for the day-by-day plan).

- `dojo-ai-training/`: Markdown course notes (`docs/`) and exercises (`exercises/day-N/`). Has its own `CLAUDE.md`.
- `task-tracker/`: NestJS + PostgreSQL app used to practice analyzing, fixing and reviewing code with Claude. Has its own `CLAUDE.md`.
- `docs/tickets/`: one file per ticket, written with `/define-ticket`.
- `docs/analyze/`, `docs/plans/`: one analysis and one plan per issue, written with `/analyze-ticket` and `/build-plan`, committed with the ticket's code.

Use only sample or made-up data. Real project code, customer data, API keys and `.env` contents stay out of the repo.

Tasks and bugs are tracked as GitLab issues in `huyen.cao/claude-training`.

## Ticket workflow

| Step | Command | Ends with |
|---|---|---|
| 1. Define | `/define-ticket <request>` | Approved ticket file in `docs/tickets/` and its GitLab issue |
| 2. Analyze | `/analyze-ticket <issue URL>` | Ready / Not ready report in `docs/analyze/` |
| 3. Plan | `/build-plan <issue URL>` | Plan approved by the developer in `docs/plans/` |
| 4. Implement | `/implement-plan <issue URL>` | Verified, reviewed, uncommitted changes in the ticket's worktree, tested by the developer |
| 5. Ship | `/ship <issue URL>` | Code, analysis and plan committed; pushed; MR opened with a review guide. The user merges |

The developer only types step 2. Each of steps 2-4 ends by asking whether to run the next one and runs it on a yes. Every step can also be run on its own, e.g. in a new session; it picks up its state from the analysis and plan files and the ticket's worktree.

Rules live in `.claude/rules/`: `git-conventions.md` (approvals, branches, worktrees, commits, issues, MRs), `tickets.md` (ticket format) and `code-structure.md` (task-tracker code layout). The commands order these rules; they don't replace them.
