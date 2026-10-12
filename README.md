# Claude Training

This is where I practice what I learn in the 15-day Claude training program (Developer track). Everything here is for practice only; no code or data comes from real projects.

**Training course:** https://dojo.agilityio.dev/

## Goal

By the end of the program, I want Claude to be a normal part of my daily development work: something I can use quickly and safely, not something I second-guess or blindly trust. I'll measure progress with the AI Fluency 4Ds:

| Competency | What it means for me |
| --- | --- |
| **Delegation** | Know which tasks to give Claude (boilerplate, debugging, tests, docs) and which to keep (design decisions, final review). |
| **Description** | Write prompts and tickets with enough context, constraints, and acceptance criteria that Claude gets it right the first time. |
| **Discernment** | Read diffs, run tests, and question Claude's explanations before accepting them. |
| **Diligence** | Take ownership of everything I ship: security, cost, and reliability. |

Beyond the 4Ds, I also want to get comfortable with Claude Code's advanced features: parallel sessions, Skills, hooks, and MCP integrations.

## Program plan

| Day | Focus | Notes |
| --- | --- | --- |
| 1 | Mental model + Claude basics | |
| 2 | Ticket analysis, reproduce & understand | |
| 3 | Fix, review, merge | ✅ Checkpoint 1 |
| 4 | Install & daily loop | |
| 5 | Memory & context | |
| 6 | Flagship & parallel | ✅ Checkpoint 2 |
| 7 | Skills & plugins | |
| 8 | MCP & connectors | |
| 9 | Hooks & automation | |
| 10 | Review & quality | |
| 11 | Role day | ✅ Checkpoint 3 |
| 12 | Capstone: kickoff and planning | |
| 13 | Capstone: build | |
| 14 | Capstone: test and harden | |
| 15 | Capstone: review, merge, demo | ✅ Final checkpoint |

- **Days 1–3:** shared fundamentals.
- **Days 4–11:** Developer track (Claude Code Desktop).
- **Days 12–15:** cross-functional capstone (mini-product, lead plays the client).

## Getting started

```bash
git clone git@gitlab.asoft-python.com:huyen.cao/claude-training.git
cd claude-training
claude
```

## Working rules

**Safety**

- Use only sample or made-up data here. Real project code, customer data, API keys, and `.env` files stay out.
- Allow only the tools and commands Claude needs for the current task, and grant more permissions only when needed.

**Working with Claude**

- Plan before coding: ask Claude for a plan, agree on it, then let it implement.
- Read every diff myself and run the tests before I commit. If I can't explain a change, I don't commit it.
- Keep each session to one task and start a new session when the topic changes.

**Learning**

- When Claude gets something wrong, write down what happened, which of the 4Ds broke down, and what I changed.
- Measure time saved on my own tasks instead of trusting general claims.
- End each day with 3 takeaways in my own words.

## Author

Huyen Cao
