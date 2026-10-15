# Claude Code 101: Notes

> Course: [Claude Code 101](https://academy.claude.com/courses/claude-code-101/what-is-claude-code) · Progress: 6 / 12 lessons · Last updated: 2026-10-15

## Course summary

**What the course is about:** Claude Code 101 has 12 lessons. It starts with what Claude Code is and how to install it, moves on to the everyday workflow, and ends with ways to extend it (CLAUDE.md, subagents, skills, MCP, hooks).

**Key takeaways so far**

1. Claude Code is an **agent**: it loops think → act → check until the task is done. *(L1)*
2. It works **directly in your project**: it reads files, edits them, and runs commands. No copy-pasting. *(L1)*
3. The **context window is finite**, so Claude searches for what it needs instead of loading the whole repo. *(L1)*
4. **You choose the permission level**: approve each action, or use auto mode with a background safety check. *(L1)*
5. **Claude makes mistakes** (misreads intent, adds bugs, over-engineers). Stay involved and review its work. *(L1)*

## Course map

| Part | # | Lesson | Status |
|---|---|---|---|
| **Basics** | 1 | [What is Claude Code?](https://academy.claude.com/courses/claude-code-101/what-is-claude-code) | Done |
| | 2 | [How Claude Code works](https://academy.claude.com/courses/claude-code-101/how-claude-code-works) | Done |
| | 3 | [Installing Claude Code](https://academy.claude.com/courses/claude-code-101/installing-claude-code) | Done |
| | 4 | [Your first prompt](https://academy.claude.com/courses/claude-code-101/your-first-prompt) | Done |
| **Daily workflow** | 5 | [The explore → plan → code → commit workflow](https://academy.claude.com/courses/claude-code-101/the-explore-plan-code-commit-workflow) | Done |
| | 6 | [Context management](https://academy.claude.com/courses/claude-code-101/context-management) | Done |
| | 7 | [Code review](https://academy.claude.com/courses/claude-code-101/code-review) |  |
| **Extending Claude Code** | 8 | [The CLAUDE.md file](https://academy.claude.com/courses/claude-code-101/the-claude-md-file) |  |
| | 9 | [Subagents](https://academy.claude.com/courses/claude-code-101/subagents) |  |
| | 10 | [Skills](https://academy.claude.com/courses/claude-code-101/skills) |  |
| | 11 | [MCP](https://academy.claude.com/courses/claude-code-101/mcp) |  |
| | 12 | [Hooks](https://academy.claude.com/courses/claude-code-101/hooks) |  |

---

## Lesson 1: What is Claude Code?

Claude Code is an AI coding tool that works inside your project. With Claude.ai you paste code in and copy the answer back. With Claude Code you give it a task, and it reads your code, edits files and runs commands itself.

**How it works: the agent loop**

Claude Code is an **agent**: an AI that takes actions on its own to reach a goal. It repeats these steps until the task is done:

```text
Task ─→ Think ─→ Act (read, edit, run) ─→ Check result ─→ Report
         ↑                                     │
         └───────────── not done ──────────────┘
```

For example, if you ask it to "fix the failing test", it reads the code, runs the tests, edits the code, and runs the tests again until they pass.

**Keep in mind**

- **Its memory is limited**: Claude can only hold so much at once (its *context window*), so it searches for the files it needs instead of reading the whole project.
- **It makes mistakes**: it can misunderstand you, add bugs, or write more than you asked for. Always review what it changed.

---

## Lesson 2: How Claude Code works

Claude Code is more than a chat window because of four things: a **loop**, a **context window**, **tools**, and **permissions**.

**1. The loop**

```text
Prompt ─→ Gather context ─→ Act ─→ Verify ─→ Done? ─→ Stop
              ↑                                │
              └──────────────── no ────────────┘
   (you can interrupt, steer, or add context at any step)
```

Claude stops only when it can show the goal is met (e.g. tests pass).

**2. Context**: the window has a fixed size. When it fills up, Claude **compacts** (summarizes old parts), so early details can get lost.

**3. Tools**: let Claude *do* things (read, edit, run commands, search), not just reply with text.

**4. Permission modes**

| Mode | Edits | Commands |
|---|---|---|
| Manual | Asks | Asks |
| Auto-accept | Auto | Asks |
| Plan | Read-only | Read-only |
| Auto | Auto | Auto, risky ones blocked |

**Keep in mind**: give Claude a way to check its work (a test or command), and pick the permission mode on purpose.

---

## Lesson 4: Your first prompt

You prompt Claude Code like any AI assistant. Before you send the prompt, pick two things: how much Claude may do without asking (**permission mode**), and whether it should plan first (**Plan Mode**). Both are in the `Shift + Tab` menu.

**Permission mode vs Plan Mode**

| | Permission mode | Plan Mode |
|---|---|---|
| Question it answers | *How* does Claude make changes? | *Should* Claude make changes yet? |
| Edits and commands | Yes; the mode decides how often it asks first | No; read-only tools only |
| Output | Changed code | A plan for you to review |
| Claude asks you | For approval of actions | Clarifying questions about the task |
| Use it when | Carrying out a task you already understand | Complex changes, multi-step features, safe code reviews |
| In one line | "Do you need my OK for each step?" | "Don't touch anything yet. Think and show me the plan." |

**The workflow from the lesson**

```text
claude ─→ Plan Mode ─→ Descriptive prompt ─→ Review plan ─→ Accept ─→ Execute ─→ Review diff
                                                 │            (in the permission
                                                 └─ push back   mode you chose)
                                                    if wrong
```

**Write descriptive prompts**: say the goal, the scope, the constraints, and how to check it's done. The lesson's example: dark mode for the whole app, a toggle in the header, and colors that contrast with the current light theme.

**Keep in mind**: no permission mode is the right one; pick what you're comfortable with. Fixing a wrong plan is cheaper than fixing wrong code, and always review the diff at the end.

---

## Lesson 5: The explore → plan → code → commit workflow

Don't start with "write the code". Gather context and agree on a plan first, or you spend the time correcting Claude later.

**The flow**

```text
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Explore  │ ─→ │   Plan   │ ─→ │   Code   │ ─→ │  Commit  │ ─→ next feature
└──────────┘    └──────────┘    └──────────┘    └──────────┘
 read-only       review and       iterate until    test, review,
 (Plan Mode)     push back        criteria pass    then commit
                     ↑                │
                     └── wrong plan? ─┘  fix the plan, not the code
```

**What to do at each step**

| Step | Goal | How | Tip |
|---|---|---|---|
| **Explore** | Give Claude the context it needs | Plan Mode (`Shift + Tab`): Claude reads files but can't edit. Outside Plan Mode, use the Explore subagent for a codebase overview | Say where the feature goes and which dependencies it needs |
| **Plan** | Get a plan Claude can measure success against | Read the plan and ask for changes to specific parts | **Write success criteria into the plan.** This is the cheapest point to change direction |
| **Code** | Iterate until the result is right | Accept the plan. Your permission mode decides how often Claude asks: every step, auto-accept edits, or auto mode | Give Claude ways to check its work: a reliable test suite, or tools like Claude in Chrome for web UIs |
| **Commit** | Review, push, move on | Test it yourself, then run a **code-review subagent** (fresh context, no bias from the main session). Ask Claude for a commit message in your team's style | Repeat the cycle for the next feature |

**Keep in mind**: if Claude keeps hitting the same problem, have it save the fix to `CLAUDE.md`. Unreliable tests are worse than none, because they let wrong code pass.

---

## Lesson 6: Context management

**Context is Claude's working memory**, like a whiteboard with a fixed size. Messages, files read, and command output all fill it. When it's full, Claude auto-compacts and small details can get lost.

| Command | Use it when | Example |
|---|---|---|
| `/context` | You want to see what's using the space (fuel gauge) | Before a big task, check how much your MCP servers take |
| `/compact` | **Same task**, running out of space (meeting → notes) | Halfway through the login feature after many test runs |
| `/clear` | **New task**, start with a clean whiteboard | Login is done, now start the profile page |

**Tips for saving context space**

- **Be specific**: "fix the bug" makes Claude search everywhere; name the endpoint and file instead.
- **Turn off unused MCP servers**: each one takes space even if never used.
- **Use subagents**: they search in their own context and return only a summary.
- **Use CLAUDE.md**: for facts Claude needs every session.
