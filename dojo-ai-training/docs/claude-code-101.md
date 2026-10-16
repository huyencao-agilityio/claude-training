# Claude Code 101: Notes

> Course: [Claude Code 101](https://academy.claude.com/courses/claude-code-101/what-is-claude-code) · Progress: 12 / 12 lessons · Last updated: 2026-10-16

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
| | 7 | [Code review](https://academy.claude.com/courses/claude-code-101/code-review) | Done |
| **Extending Claude Code** | 8 | [The CLAUDE.md file](https://academy.claude.com/courses/claude-code-101/the-claude-md-file) | Done |
| | 9 | [Subagents](https://academy.claude.com/courses/claude-code-101/subagents) | Done |
| | 10 | [Skills](https://academy.claude.com/courses/claude-code-101/skills) | Done |
| | 11 | [MCP](https://academy.claude.com/courses/claude-code-101/mcp) | Done |
| | 12 | [Hooks](https://academy.claude.com/courses/claude-code-101/hooks) | Done |

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

---

## Lesson 7: Code review

Don't trust Claude's summary of what it changed. Read the real diff, get a second opinion from a clean context, and undo the change if it went wrong.

| Command | What it does | Use it when | Example |
|---|---|---|---|
| `/diff` | Opens a viewer of uncommitted changes, also per Claude turn (arrow keys to move, `Enter` to open a file; needs git) | **After every change**, before you trust Claude's summary | Check for unrequested edits, weakened tests, new packages, hard-coded URLs or keys |
| `/code-review` | Second review in a **fresh context** (no session history). Runs in the background, reports findings, edits nothing unless asked. `low` = only confident findings, `high` = wider net, maybe less certain; the level is remembered | The change **deserves a second look**, not every small edit | Before committing a feature or a bug fix that touches logic |
| `/rewind` (or `Esc` twice on an empty prompt) | Pick the prompt that caused the bad change, then "Restore code and conversation" | The **whole change is wrong** and fixing it costs more than redoing it | Claude rewrote the module in the wrong direction. Note: files changed by shell commands (e.g. package installs) are not rolled back |

**Using them together**

```text
Claude finishes ─→ /diff ─→ looks wrong overall? ─→ /rewind ─→ re-prompt
                     │
                     └─ looks OK ─→ /code-review ─→ triage findings ─→ fix + evidence ─→ /diff ─→ commit
```

**Keep in mind**: read the actual diff, not just the summary. Issues the reviewer flags again and again can become rules in `CLAUDE.md` (next lesson). Claude Code Review for GitHub PRs is a separate team product, not needed here.

---

## Lesson 8: The CLAUDE.md file

**CLAUDE.md is the onboarding script for your codebase.** Without it, every session starts from zero: Claude explores the code again and fills the gaps with assumptions. Claude Code reads the file at the start of every session and adds it to your prompt.

**What goes in it**: your stack, your commands (dev, test, lint) and the conventions Claude can't guess.

| Level | Where | Who it's for |
|---|---|---|
| Project | `CLAUDE.md` in the project root, committed to git | The whole team |
| User | `CLAUDE.md` in your Claude config folder | Only you, across all your projects (personal preferences) |

**Tips**

- **Start without one**: work for a while, notice what you keep correcting, then run `/init`. This keeps the file short.
- **Turn repeated corrections into rules**: ask Claude to save the rule to memory so it knows next session.
- **Link docs, don't copy them**: write `@README.md` in CLAUDE.md and Claude reads that file.

**Keep in mind**: the quality of a session depends on its context. Start small and add rules from real corrections over time.

---

## Lesson 9: Subagents

A subagent is a helper Claude hands a task to. It works in its **own context window** and sends back **only a summary**.

**The two main purposes**

1. **Keep the main context clean**: heavy work such as searching the codebase or researching online fills the context with things that don't matter for the task. The subagent does that work, and the main session gets only the answer.
2. **Run work in parallel**: Claude can split a task and run several subagents at the same time, each one on its own part.

| Use a subagent when | Don't use one when |
|---|---|
| The search or research is big and you only need the conclusion | The task is small or you already know the file: a direct read is faster |
| The parts are independent and can run in parallel | The task needs this conversation's history: the subagent doesn't see it |
| You want a fixed role with limited tools, e.g. a read-only reviewer | The steps depend on each other or edit the same files |
| You want fresh eyes with no bias from the session | You need the details yourself: a summary hides them and can be wrong |

**Creating one**

- Describe it to Claude and say where to save it, e.g. *"Create a code-reviewer subagent in .claude/agents/ that reviews code for bugs and readability. Make it read-only."*
- It's a Markdown file with YAML frontmatter. The `description` tells Claude **when** to call it.
- `.claude/agents/` is for this project and `~/.claude/agents/` is for all your projects. If the folder is new, restart Claude Code to load it.
- Extras: persistent memory across conversations, and a `skills` key that preloads the full skills into the subagent.

**Keep in mind**: a clean context is one of the best ways to stay productive. Check the subagent's summary before you act on it.

---

## Lesson 10: Skills

A skill is know-how for **one kind of task**, written once. Claude **loads it by itself** when your request matches it.

**When**: you keep explaining the same thing to Claude, e.g. commit format, review checklist, doc format.

**Format**: `.claude/skills/<name>/SKILL.md` (project) or `~/.claude/skills/<name>/SKILL.md` (all your projects).

```markdown
---
name: commit-message
description: Write Conventional Commits messages. Use when the user asks to commit.
---
Steps and rules...
```

The `description` decides **when** Claude uses it, so say what it does and when.

| | Loads | Use for |
|---|---|---|
| `CLAUDE.md` | Every session | Rules for every task |
| Skill | Only when the request matches | Know-how for one kind of task |

---

## Lesson 11: MCP

MCP connects Claude Code to **tools and data outside your code** (issue trackers, databases, docs), so it can read them and act, not just answer.

**When**: the context lives outside the repo, e.g. a Linear/GitLab issue, up-to-date library docs (Context7).

**Add**: `claude mcp add`. Types: **HTTP** (remote, hosted by the provider) or **stdio** (local process).

| Scope | Who gets it |
|---|---|
| Local | Only you, this project |
| User | Only you, all projects |
| Project | Everyone, via `.mcp.json` committed to git |

**Manage**: `/mcp` shows servers, status and tools; reconnect or disable from there.

**Keep in mind**: each server takes context even when unused, so disable the ones you don't need. If a CLI exists (`gh`, `aws`), it's cheaper on context than an MCP server.

---

## Lesson 12: Hooks

A hook is a **shell command Claude Code runs at a set point**, every time. CLAUDE.md is followed most of the time; a hook always runs.

**When**: something must happen without fail, e.g. format after edits, block dangerous commands, log commands, notify when done.

| Event | Runs | Typical use |
|---|---|---|
| `PreToolUse` | Before a tool call | Block `rm -rf`, edits to `.env`, commits to `main` |
| `PostToolUse` | After a tool call | Format or lint the edited file |
| `UserPromptSubmit` | Before Claude reads your prompt | Add context, block secrets |
| `Stop` | When Claude finishes | Run tests, notify |
| `Notification` | When Claude needs you | Desktop notification |

**Format**: `/hooks` or `.claude/settings.json` (commit it to share with the team). Each hook has an event, an optional `matcher` (which tools) and a command. The command gets the tool input as JSON on stdin.

```json
"PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-bash.sh" }] }]
```

**Exit codes**: `0` = go ahead, `2` = block and send stderr to Claude, other = error shown to you, nothing blocked.
