# Dojo AI Training

Notes and practice work from the AI training.

```
dojo-ai-training/
├── docs/        ← what I learned: summaries and reusable material
└── exercises/   ← hands-on work, one folder per exercise
```

## Docs

| File | What it covers |
|---|---|
| [ai-capabilities-and-limitations.md](docs/ai-capabilities-and-limitations.md) | How generative AI works and where it is strong or weak: next-token prediction, knowledge, working memory, steerability |
| [prompt-template.md](docs/prompt-template.md) | Prompt for having AI review a ticket analysis before implementation |

## Exercises

| Exercise | What I did |
|---|---|
| [day-2-ticket-analysis](exercises/day-2-ticket-analysis/README.md) | Analyzed 5 tickets on [task-tracker](../task-tracker), then used AI to review each analysis |
| [day-3-planning](exercises/day-3-planning/ticket5-plan.md) | Implementation plan for ticket 5 (duplicate tasks on "Save") |
| [day-4/explain-update-task.md](exercises/day-4/explain-update-task.md) | Had AI explain the "update task" flow end-to-end, then verified 2 of its claims |
| [day-4/ticket1-search-fix-plan.md](exercises/day-4/ticket1-search-fix-plan.md) | Fix plan for ticket 1 (search misses tasks): root cause, fix, tests, curl checks |
| [day-5/context-matters-results.md](exercises/day-5/context-matters-results.md) | Ran ticket 3 in a fresh session vs. one primed by reading the codebase, then compared fix quality and token cost |
| [day-6/artifact-example.md](exercises/day-6/artifact-example.md) | Prompted Claude to build and publish a company trip registration form as a shared artifact; the prompt and a screenshot of the UI |
| [day-6/effort-comparison.md](exercises/day-6/effort-comparison.md) | Ran one null-handling bug at each `/effort` level and with `ultrathink`, then compared fix quality, thinking tokens and cost; plan-tier notes |
| [day-6/session-stats.mjs](exercises/day-6/session-stats.mjs) | Script that reads local Claude Code transcripts and prints effort, ultrathink use, thinking/output tokens and cost per session, to compare effort levels on one bug |
