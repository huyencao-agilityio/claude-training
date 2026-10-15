# Day 2 — Ticket Analysis with AI Review

Log of how I analyzed 5 tickets and used AI to review my analysis before implementation.

## Process

1. **My analysis**: read the ticket and write What it asks / What's ambiguous / First step on my own.
2. **AI review**: run the shared prompt ([prompt-template.md](prompt-template.md)) on my analysis.
3. **My evaluation**: decide which AI points I accept or reject, and why.
4. **Final analysis**: clarifying questions (BA/PM vs. check in code) and the revised first step.

Step 1 stays exactly as I first wrote it, so the log shows what changed after the review.

## Files

```
day-2/
├── README.md            ← this overview
├── prompt-template.md   ← shared review prompt + changelog
├── implementation-plan.md ← build plan for all 5 tickets
├── tickets/             ← original tickets
└── analysis/            ← one log per ticket (Steps 1–4)
```

## Summary

| # | Ticket | Prompt | Key gap AI found | Accepted / Rejected | Log |
|---|--------|--------|------------------|---------------------|-----|
| 1 | Search doesn't find tasks that obviously exist | v1 | _TBD_ | _TBD_ | [ticket1](analysis/ticket1.md) |
| 2 | Add pagination to the task list | v1 | _TBD_ | _TBD_ | [ticket2](analysis/ticket2.md) |
| 3 | Due dates show up one day early | v1 | _TBD_ | _TBD_ | [ticket3](analysis/ticket3.md) |
| 4 | Export tasks to CSV | v1 | _TBD_ | _TBD_ | [ticket4](analysis/ticket4.md) |
| 5 | Double-clicking "Save" creates duplicate tasks | v1 | _TBD_ | _TBD_ | [ticket5](analysis/ticket5.md) |

## Lessons learned (overall)

- _TBD — patterns across the 5 tickets, e.g. what I tend to miss._
