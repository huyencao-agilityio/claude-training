# Introduction to Agent Skills: Notes

> Course: [Introduction to Agent Skills](https://academy.claude.com/courses/introduction-to-agent-skills/what-are-skills) · Progress: 6 / 6 lessons · Last updated: 2026-10-21

## Course map

| # | Lesson | Status |
|---|---|---|
| 1 | [What are skills?](https://academy.claude.com/courses/introduction-to-agent-skills/what-are-skills) | Done |
| 2 | [Creating your first skill](https://academy.claude.com/courses/introduction-to-agent-skills/creating-your-first-skill) | Done |
| 3 | [Configuration and multi-file skills](https://academy.claude.com/courses/introduction-to-agent-skills/configuration-and-multi-file-skills) | Done |
| 4 | [Skills vs. other Claude Code features](https://academy.claude.com/courses/introduction-to-agent-skills/skills-vs-other-claude-code-features) | Done |
| 5 | [Sharing skills](https://academy.claude.com/courses/introduction-to-agent-skills/sharing-skills) | Done |
| 6 | [Troubleshooting skills](https://academy.claude.com/courses/introduction-to-agent-skills/troubleshooting-skills) | Done |

---

## Lesson 1: What are skills?

A **skill** is a folder of reusable instructions that Claude finds and uses on its own when a task matches it.

**Structure:** each skill has a `SKILL.md` file: frontmatter with `name` + `description`, then the instructions.

```yaml
---
name: pr-review
description: Reviews pull requests for code quality. Use when reviewing PRs or checking code changes.
---
```

**How it loads**

- At startup Claude reads only each skill's `name` + `description`, so skills cost almost no context.
- Claude matches your request against the descriptions. On a match it loads the full skill, and the terminal shows "Successfully loaded skill".
- The `description` decides whether a skill is used, so say clearly what it does and when to use it.

**Where it lives**

| Scope | Path | Use for |
|---|---|---|
| Personal | `~/.claude/skills/` | Your own habits, in every project |
| Project | `.claude/skills/` in the repo | Team standards, shared through git |

**Skills vs. similar features**

| Feature | Loads when | Use for |
|---|---|---|
| `CLAUDE.md` | Every conversation | Rules that always apply (e.g. "use TypeScript strict mode") |
| Skill | Only when the request matches | Knowledge for one kind of task |
| Slash command | Only when you type it | Actions you trigger yourself |

**Good candidates:** code review standards, commit message format, brand guidelines, doc templates, debugging checklists for a framework.

> **Rule of thumb:** if you keep explaining the same thing to Claude, turn it into a skill.

---

## Lesson 2: Creating your first skill

**Steps:** create a folder named after the skill, add `SKILL.md` with frontmatter, then write the instructions below it.

```text
~/.claude/skills/
└── pr-description/      ← folder name = skill name
    └── SKILL.md
```

```markdown
---
name: pr-description
description: Writes pull request descriptions. Use when creating or writing a PR.
---

1. Run `git diff main...HEAD` to see the changes.
2. Format: What (one sentence), Why, Changes (grouped bullets).
```

**Test it:** no restart needed, Claude Code picks up new skills on its own. If `~/.claude/skills` didn't exist when the session started, run `/reload-skills`. Then ask for the task (e.g. "write a PR description") and check that Claude says it's using the skill.

**Permissions:** a plain skill (name, description, instructions) loads without asking. A skill that pre-approves tools or adds hooks may ask for approval first.

**Same name in two places:** Enterprise > Personal > Project. Plugin skills are namespaced (`/plugin-name:skill-name`), so they never clash.

**Tips**

- Use specific names (`frontend-review`, not `review`) to avoid clashes.
- To update a skill, edit `SKILL.md`. To remove it, delete its folder.

---

## Lesson 3: Configuration and multi-file skills

**Frontmatter fields** (all optional in Claude Code)

| Field | What it does |
|---|---|
| `description` | The most important field: Claude uses it to decide when to use the skill. Say what it does and when to use it. If the skill doesn't trigger, add the words people actually type. |
| `name` | Defaults to the folder name |
| `allowed-tools` | Lets Claude use these tools without asking, only while the skill runs. It doesn't block other tools. Narrow risky ones, e.g. `Bash(git status *)` instead of `Bash`. |
| `model` | Which model runs the skill, e.g. `sonnet` |

**Multi-file skills:** keep `SKILL.md` short (under 500 lines) and move details into other files. Claude reads them only when needed.

```text
my-skill/
├── SKILL.md       ← core steps + when to open each file below
├── references/    ← extra docs
├── scripts/       ← code to run
└── assets/        ← templates, images, data
```

**Scripts:** tell Claude to *run* a script, not *read* it. Only the output uses context. Use scripts for steps that must be exact every time (validation, data transforms).

---

## Lesson 4: Skills vs. other Claude Code features

| Feature | Kicks in when | Use for | Example |
|---|---|---|---|
| `CLAUDE.md` | Always, in every conversation | Rules that always apply | "Never change the DB schema" |
| Skill | Your request matches its description | Know-how for one kind of task | PR review checklist, loaded only when you ask for a review |
| Subagent | Claude hands off a task | Work in its own separate context, or with different tools. Only the result comes back. | "Search the whole repo for every use of `dueDate`" |
| Hook | An event fires (tool call, file save) | Things that must happen every time, with no AI judgment | Run the linter after every file edit |
| MCP server | Claude needs an outside system | Connecting to external tools and services | Read a GitLab issue |

**They work together.** Example: "fix the bug in issue #6"

```text
MCP ──────→ reads issue #6 from GitLab
CLAUDE.md ─→ rules already loaded (branch name, commit format)
Subagent ──→ searches the codebase, reports back the relevant files
Hook ──────→ runs lint after each edit
Skill ─────→ "commit this" loads commit-message and writes the commit
```

> Don't force everything into a skill. Pick the feature that fits.

---

## Lesson 5: Sharing skills

| Method | How | Use for |
|---|---|---|
| Project repo | Commit to `.claude/skills/`. Teammates get it on clone / pull. | Team standards, workflows tied to this codebase |
| Plugin | Put skills in the plugin's `skills/` folder, publish to a marketplace | Skills useful beyond your team |
| Enterprise managed settings | Admin puts skills in the managed folder (Linux: `/etc/claude-code/.claude/skills/`) | Mandatory company rules (security, compliance). Overrides same-named skills. |

**Skills in subagents:** a subagent does **not** inherit skills you already used in the main conversation.

- It can still load skills itself if it has the `Skill` tool.
- A custom subagent (`.claude/agents/*.md`) can preload skills with the `skills` field. They load in full at startup.

```yaml
---
name: frontend-reviewer
tools: Read, Grep, Glob, Skill   # keep Skill so it can load other skills
skills: accessibility-audit, performance-check
---
```

---

## Lesson 6: Troubleshooting skills

**First step:** run the validator. It catches frontmatter that won't parse.

```bash
claude plugin validate .claude/skills      # or ~/.claude/skills
```

| Problem | Usual cause | Fix |
|---|---|---|
| Doesn't trigger | Description doesn't match how you ask | Add the phrases people actually type ("why is this slow?", "make this faster") |
| Doesn't load at all | `SKILL.md` not inside its own folder, wrong file name (must be exactly `SKILL.md`), bad YAML | Fix path / name / YAML. Find the error with `claude --debug`. |
| Wrong skill used | Descriptions too similar | Make each description specific |
| Your skill is ignored | Higher-priority skill with the same name | Rename yours |
| Plugin skills missing | Skills not in `skills/` at the plugin root | Check `/plugin` → Errors, fix the folder, `/reload-plugins` |
| Loads but fails | Missing package, script not executable, `\` in paths | Install deps, `chmod +x`, use `/` in paths |

> Most problems come from the description.
