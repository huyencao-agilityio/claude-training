# The AI-Native SDLC Playbook: Notes

> Course: [AI-Native SDLC Playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook/introduction) · Lessons: Introduction, Capture intent, Requirements and design, Plan mode, CLAUDE.md, Skills as institutional knowledge, Parallel sessions and subagents, Give Claude a feedback loop, Continuous evals in CI, AI in the PR review loop · Last updated: 2026-10-26

## Introduction

**Purpose:** AI writes code much faster than before, but the processes around the code (requirements, review, QA, ops) have not changed. The playbook shows how to change the whole development lifecycle (SDLC), not just the coding step.

**Flow (what changes at each stage):**

```
Plan      Claude turns pain points / source material into intent.md
  ↓       (instead of committee-written requirements)
Design    Requirements + design in one working session with an agent,
  ↓       standards come from versioned skills
Build     AI writes code and tests; docs kept as machine-readable files
  ↓
Test      Continuous evals while building (instead of QA gates)
  ↓
Deploy    Layered agentic review; humans review only regulated/critical code;
  ↓       hooks act as approval gates
Maintain  Agents watch live systems, diagnose issues,
          and feed them back as new intent files  ──► back to Plan
```

**Key points:**

- **Plays:** modular practices per stage (what changes, how to start, steps, governance, how to measure). They are not linear; pick the stage that fits your organization.
- **Dependencies:** solid arrow = a play requires another; dotted arrow = it only helps.
- **Six plays with no prerequisites (good starting points):** capture intent (`intent.md`), use plan mode, write `CLAUDE.md`, build skills, add a feedback loop, use hooks as approval gates.
- **Shared knowledge:** `intent.md` (requirements) and `CLAUDE.md` + skills (standards) are versioned files that both humans and Claude can read.
- **Humans stay accountable** for decisions that need judgment.

---

## Capture intent (Stage 1: Plan)

**Purpose:** let the person who has the idea (or a ticket / incident alert) produce a reviewable `intent.md` directly with Claude, instead of passing it through backlog items, user stories and refinement meetings where the meaning drifts at each handoff.

**Flow:**

```
1. Describe the problem in plain words
   (what can't be done, who is affected, what better looks like, out of scope)
        ↓
2. Brainstorm: Claude asks analyst-style questions (scope, users, constraints, success)
        ↓
3. Claude drafts intent.md from the org template (template kept as a skill)
        ↓
4. Originator corrects what Claude misunderstood
        ↓
5. Commit to the shared intent folder → product owner accepts or rejects
```

Example: a claims-operations user wants customers to see claim status in the portal (status calls take ~1/3 of handler time). Claude drafts, the user fixes, commits, and the product owner reviews.

**`intent.md` contains:** title / author / status, problem, proposed outcome, affected users and systems, constraints, open questions.

**Key points:**

- The originator's own words are preserved, so less drift between idea and spec.
- Stored in an `intent/` folder in the repo: versioned and auditable. A technical teammate sets up a GitHub connector once; non-engineers then commit without Git.
- The product owner always reviews an agent-written draft; accepting it moves it to Stage 2: Design.
- Measure: time from first conversation to committed intent (weeks → hours), and the share of intents accepted into Design.

---

## Requirements and design (Stage 2: Design)

**Purpose:** Claude turns an approved `intent.md` into a `spec.md` (requirements + design) in one session. The product owner reviews it but does not write it, so requirements and design are no longer two slow, separate handoffs.

**Flow:**

```
1. Open a session: load org skills (brand, security, compliance, UX) + attach intent.md
        ↓
2. Prompt Claude for a full spec that follows the skills
   and flags any conflicting policies
        ↓
3. Product owner checks: does it solve the stated problem?
   are the open questions answered or carried forward?
        ↓
4. Send each flagged concern to its policy owner BEFORE engineering sees the spec
        ↓
5. Commit spec.md next to intent.md (what was asked + what was decided)
        ↓
6. Human go / no-go → accepted spec starts plan mode in Build
```

Example: UX says "every status shows a date", brand says "never promise a payment date". Claude flags the conflict, compliance approves an "Estimated date" label.

**`spec.md` contains:** numbered requirements (R1, R2…), the design, a table showing how each intent constraint is met, open questions, and concerns with named owners.

**Key points:**

- Policies are applied as live constraints while the spec is written, not found later in review.
- A human always decides to move to Build.
- The prompt can be saved as a slash command and run when `intent.md` is merged; the `spec.md` opens as a PR, so the product owner only reviews.
- Measure: time from `intent.md` commit to `spec.md` commit, and how many `spec.md` commits happen after the first `plan.md` (= requirements rework during build).

---

## Plan mode (Stage 3: Build)

**Purpose:** agree on a written implementation plan before any code exists. Changing a document is far cheaper than changing a diff. Plan mode lets Claude read the codebase but not edit files until the engineer accepts the plan.

**Flow:**

```
1. Start Claude Code in plan mode
        ↓
2. Give it intent.md + spec.md; ask for a plan:
   files to change, order of work, tests that prove it
        ↓
3. Interrogate the plan: what could break? riskiest step? rejected alternatives?
        ↓
4. Iterate until someone who never saw the chat could implement from it alone
        ↓
5. Commit the approved plan as plan.md
        ↓
6. Claude implements (a strong plan often means one pass)
        ↓
7. If the code diverges, update plan.md in the same commit (a hook can enforce this)
```

Example: adding a claim-status panel. The plan lists the new endpoint, panel and tests, orders the work, and flags the legacy system's 50 rps rate limit as a risk that needs a 60-second cache. Its steps cite R1–R4 from `spec.md`, so a reviewer can check it line by line.

**Key points:**

- `plan.md` holds: files that change, work order, risks, proof (tests / visual checks), and the spec requirements it cites.
- Routine changes are approved by the engineer; higher-risk ones go to a tech lead or architect. The plan, its revisions and the approver are logged.
- Plan mode is the default start. Auto mode (no per-edit prompts) comes later, only for low-risk work and once guardrails exist: tuned `CLAUDE.md`, skills, safety hooks, a runnable test suite.
- Existing tools (Jira, change boards): pick one source of truth per artifact. Linking each side by ID or commit SHA is a good first step.
- Measure: share of changes merged on the first pass, rework cycles, and whether the merged diff still matches `plan.md`.

---

## CLAUDE.md

**Purpose:** give Claude what a new engineer needs on day one (commands, conventions, architecture, recurring mistakes). The file lives in the repo, is read at the start of every session and is owned by the whole team, so this knowledge no longer sits in people's heads or on wikis.

**Flow:**

```
1. Run /init in the repo → Claude drafts a starting file
        ↓
2. Trim to what a new joiner needs on day one
        ↓
3. Commit at the repo root (shared version, changes go through code review)
        ↓
4. Claude makes the same mistake twice → add the correction to the file
        ↓
5. Keep it under a page (stale text wastes context every session)
```

**Include:** build / test / lint commands, key conventions, architecture and system boundaries, constraints (rate limits, data-handling rules), and a "things Claude gets wrong" list.
**Avoid:** long documentation, stale details, anything not needed for routine work.

Example: `make test`, `make lint`; "only `claims-api` talks to the rate-limited legacy system, so cache reads"; "never log request bodies (PII)"; "don't bump dependency versions".

**Key points:**

- Turns tribal knowledge into a versioned, reviewable artifact; changes are approved by code owners in PRs.
- Every repeated mistake is a signal to update the file.
- Measure: how often Claude repeats a mistake the file should prevent, and time from a new member's start to their first merged PR.

---

## Skills as institutional knowledge

**Purpose:** turn knowledge that must be applied consistently (security standards, API conventions, brand rules) into skills Claude loads when the task matches. Everything else stays in `CLAUDE.md` or the prompt.

**Flow:**

```
1. Pick one policy that is enforced inconsistently (e.g. API security standard)
        ↓
2. Write it as .claude/skills/<name>/SKILL.md
   (frontmatter = when to trigger, body = what to do), drafted from the policy owner's source
        ↓
3. Ship it in the repo, or org-wide through a plugin
        ↓
4. Test triggering: ask the task in several ways, confirm the skill loads each time
        ↓
5. Policy changes → edit the skill, policy owner signs off
        ↓
6. Engineers get the new version in their next session
```

Example `secure-api-review` skill: JWT auth on endpoints, request validation against the OpenAPI schema, audit events on state-changing endpoints, no `pii` fields in logs.

**Skill vs. CLAUDE.md:** `CLAUDE.md` is broad, general context for the repo. A skill is one specific, versioned policy that is triggered by the task and updated centrally.

**Key points:**

- A skill is **advisory**: Claude will probably follow it, nothing forces it. Policies that must always hold need a hook (e.g. `PostToolUse` check that blocks the edit with exit code 2) plus a required CI check on PRs (hooks miss shell-made changes).
- Keep hooks fast and file-scoped; put heavy checks at commit / PR time and approval prompts at Deploy.
- Skills are owned, versioned and reviewed like code.
- Measure: time from policy approval to the skill update merged, and PR review findings citing that policy should go down (if not, the skill isn't triggering or has drifted from the policy).

---

## Parallel sessions and subagents (Stage 3: Build)

**Purpose:** let one engineer steer several streams of work at once: parallel sessions for separate tasks, subagents for jobs that repeat.

**Flow:**

```
1. Split the work using plan.md: tasks touching different files run in parallel,
   tasks sharing files run one after another in one session
        ↓
2. One worktree (own branch) per task:
   claude --worktree feature-auth      (terminal 1)
   claude --worktree fix-rate-limit    (terminal 2)
        ↓
3. Start with 2–3 sessions; add more only while you can still review them
        ↓
4. Turn repeated jobs into subagents: .claude/agents/<name>.md
   (name, when to use, allowed tools), committed to Git
```

Example subagent: `verifier` (Bash + Read) starts the app, exercises the changed behavior and nearby flows, and reports results without fixing anything. Other useful ones: code simplifier, codebase researcher.

**Key points:**

- **Parallel session** = full Claude Code instance in its own worktree; sessions don't know about each other, the engineer is the link.
- **Subagent** = scoped helper inside one session with its own context window and tool limits, so the main session stays focused.
- Every session reads the same `CLAUDE.md`; a working feedback loop lets a session check its own work.
- Hooks and permissions live in repo config and apply to all sessions; tune permissions so safe commands don't stall on prompts.
- The engineer shifts from doing the work to steering and reviewing. **Review capacity is the real ceiling**, so scale sessions to what you can review well.
- Measure: concurrent sessions per engineer (while review quality holds), merged changes per week alongside rework rate.

---

## Give Claude a feedback loop (Stage 3: Build)

**Purpose:** let Claude verify its own work (tests, build, screenshot compare) and fix mistakes before a human reviews. Without it, the engineer checks everything and becomes the bottleneck.

**Flow (example: status endpoint returns stale data):**

```
1. Wrap checks in one command (make test) that exits non-zero on failure
        ↓
2. Document the commands in CLAUDE.md, with what healthy output looks like
        ↓
3. Set a measurable target: "all tests in test_status.py pass"
        ↓
4. Failing test first: Claude reproduces the bug as a test, confirms it fails
   for the right reason, commit it → then fixes the code without touching the test
        ↓
5. UI work: give a screenshot / browser tool + design mock;
   Claude implements → captures → compares → adjusts (2–3 rounds)
        ↓
6. "Done" = verified: CLAUDE.md says run the checks and show the output first
        ↓
7. Protect the loop: a hook blocks test-file edits during fix tasks
   (or reviewers reject any diff that changes a test)
```

**Key points:**

- A test written before the fix, which the agent cannot rewrite, is real evidence the bug is gone.
- A verifier subagent gives a final check in a fresh context, free of the assumptions behind the code. It is one way to package the check, not the loop itself.
- Evidence = literal tool output (test results, build logs, screenshot diffs) pasted by Claude; enforce "verify before done" and the test-edit block with hooks.
- Code owner then focuses on intent and risk, since mechanical checks are already attached.
- Measure: first-pass CI success rate for agent changes, review time per PR (should drop), change failure rate.


---

## Continuous evals in CI (Stage 4: Test)

**Purpose:** `CLAUDE.md`, skills and hooks decide how Claude behaves. If someone edits them (or the model changes), Claude's behavior can silently get worse. An **eval** is a test for *Claude's behavior*: give Claude a real past task, then check automatically that its result is acceptable. CI runs the evals on every config change, like unit tests do for code.

**Flow (example):**

```
Someone opens a PR that shortens CLAUDE.md
(it removes the line "never log full response bodies")
        ↓
CI runs the evals: for each saved real task,
Claude does the task using the NEW CLAUDE.md
        ↓
Automatic checks on each result:
tests pass? lint clean? no PII logged? no response body logged?
        ↓
Eval "no body logging" FAILS: Claude logged a whole response
        ↓
Merge is blocked; reviewer sees the bad log line and restores the rule
```

**How to set it up:**

1. Collect 20–50 real recent tasks, each with a known good result.
2. Turn each into an eval = a prompt + automatic checks.
3. Run the suite in CI on every config change (or on a schedule); block the merge if the pass rate drops.
4. After every production incident, add a new eval so it cannot happen again.

**Key points:**

- Checks look at behavior (what actually got logged), not how the code is written.
- Claude must not be able to cheat: checks live outside its working folder, and any edit outside the allowed paths counts as a fail.
- Keep adding cases from incidents; old cases stop being useful as models improve.
- Measure: pass rate over time, and regressions caught in CI vs. found in production.

---

## AI in the PR review loop (Stage 5: Deploy)

**Purpose:** Claude does the first pass of PR review against the team's written rules, and fixes review comments on PRs it wrote. Humans then spend their time on two questions: does the change match the plan, and is the risk acceptable?

**Flow:**

```
1. Turn it on: managed Code Review service (org Owner enables per repo),
   or claude-code-action in your own CI
        ↓
2. Tech lead writes REVIEW.md at the repo root:
   review passes (bugs, security, matches spec/plan), Important vs Nit, what to skip
        ↓
3. A PR is opened → Claude reviews it against REVIEW.md and posts findings
        ↓
4. Human code owner still approves (branch protection); findings never approve or block alone
        ↓
5. Reviewer tags @claude on a comment → Claude fixes and pushes
        ↓
6. Same mistake flagged twice → add the rule to CLAUDE.md
```

Example: a PR adds a claim-status panel. Claude reports **Important**: fetches on every render but `plan.md` requires caching (found because it read the plan, not just the diff); **Important**: error path logs the full response with the customer's name; **Nit**: missing test case.

**Key points:**

- **`REVIEW.md`** = written review policy applied to every PR; **Important** = breaks behavior, leaks data or breaks policy, **Nit** = style and naming.
- **Separation of duties:** the AI that wrote the code cannot approve it; a human does.
- Reviewing against `plan.md` / `spec.md` catches "not what was planned", which a diff-only review misses.
- Tune monthly: tech lead rates findings and caps the number of Nits.
- Measure: time to first review (should drop to minutes), share of comments resolved without a human editing the branch, defects caught before vs. after production.
