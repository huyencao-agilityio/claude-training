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
| [building-effective-human-agent-teams.md](docs/building-effective-human-agent-teams.md) | Notes on the Building Effective Human-Agent Teams course: single-player vs. multiplayer AI, why siloed context hurts as a team grows, what makes an agent a teammate (own identity, shared memory, shared context), what a strong human-agent team looks like (roles, north star, access, trust; who does what), a five-question readiness checklist, and the "find your team's repeats", "tool or teammate?" and "draft your roster" exercises with the AI's answers |
| [building-with-the-claude-api.md](docs/building-with-the-claude-api.md) | Notes on the Building with the Claude API course (9 sections, 67 lessons): API basics, prompt evaluation, prompt engineering, tool use, RAG, Claude features, MCP, Claude Code and computer use, agents and workflows |
| [introduction-to-agent-skills.md](docs/introduction-to-agent-skills.md) | Notes on the Introduction to Agent Skills course: what a skill is, how it loads, where it lives, skills vs. CLAUDE.md and slash commands |
| [introduction-to-mcp.md](docs/introduction-to-mcp.md) | Notes on the Introduction to Model Context Protocol course: what MCP is, MCP servers vs. clients, MCP vs. tool use, transports, ListTools / CallTool flow, defining tools with the Python SDK, testing servers with the MCP Inspector, implementing a client, defining and reading resources, defining and using prompts |
| [prompt-template.md](docs/prompt-template.md) | Prompt for having AI review a ticket analysis before implementation |
| [the-ai-native-sdlc.md](docs/the-ai-native-sdlc.md) | Notes on the AI-Native SDLC Playbook course: how each SDLC stage changes with Claude (intent.md, spec.md, plan mode, CLAUDE.md, skills, parallel sessions, feedback loops, continuous evals, AI PR review) |

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
| [day-10/code-review-comparison.md](exercises/day-10/code-review-comparison.md) | Ran `/code-review` and `/code-review ultra` on the same CSV-export diff, then compared shared findings, findings only one run caught, and their signal |
| [day-11/intent.md](exercises/day-11/intent.md) | Drafted an `intent.md` for requiring email + password login before viewing the task list (problem, outcome, constraints, open questions) |
| [day-11/spec.md](exercises/day-11/spec.md) | Requirements and design spec for the login intent on [task-tracker](../task-tracker): data model, API, session, UI, tests, and areas of concern |
| [day-11/plan.md](exercises/day-11/plan.md) | Implementation plan for the login spec: files to change, order of steps, tests, risks, and alternatives not chosen |
| [day-12/ticket-pack.md](exercises/day-12/ticket-pack.md) | Capstone intake: client brief, open questions, assumptions, one ticket per feature (login, urgent tasks first, assign a task) with UI changes, Given/When/Then ACs and a draft test matrix |
