# Building Effective Human-Agent Teams: Notes

> Course: [Building Effective Human-Agent Teams](https://academy.claude.com/courses/building-effective-human-agent-teams/why-multiplayer-ai-matters) · Progress: 4 / 5 lessons · Last updated: 2026-11-10

## Course map

| # | Lesson | Status |
|---|---|---|
| 1 | [Why multiplayer AI matters](https://academy.claude.com/courses/building-effective-human-agent-teams/why-multiplayer-ai-matters) | Done |
| 2 | [How is a multiplayer agent different from traditional AI tools?](https://academy.claude.com/courses/building-effective-human-agent-teams/how-multiplayer-agents-differ) | Done |
| 3 | [What a strong human-agent team looks like](https://academy.claude.com/courses/building-effective-human-agent-teams/what-a-strong-team-looks-like) | Done |
| 4 | [Organizational checklist](https://academy.claude.com/courses/building-effective-human-agent-teams/organizational-checklist) | Done |
| 5 | Some practical ways to get started | Done |

---

## Lesson 1: Why multiplayer AI matters

**Purpose:** show what changes when a team stops using AI alone and starts using it in a shared space.

| | Single-player AI | Multiplayer AI |
|---|---|---|
| Where | Each person in a private chat | One shared space the whole team sees |
| Effect | Makes one person faster ("a super suit at work") | Builds shared team knowledge |
| Risk / gain | Context is siloed; the team asks the same thing many times and gets different answers | People and agents work from the same context toward one goal |

**Key ideas**

- Single-player AI speeds up individuals but keeps information siloed.
- The faster a team grows, the more siloed context hurts what agents can do.
- In a shared space, an agent can be proactive and personalized: it sees what the team decided and can act on it.

**Reflection**

- Where has single-player AI made me faster in a way my team never sees?
- If an agent could see our shared space today, what should it notice first?

### Exercise: Find your team's repeats

Steps: list three questions the team asks most weeks, paste them into the prompt below, keep the answer for the final lesson.

**Prompt**

```text
I lead a team of 4 people, and today we each use AI on our own. Here are three questions that come up on our team most weeks:

What is the current status of our tasks, and are there any blockers?
What decisions were made during our recent meetings, and what are the follow-up actions?
What should we prioritize this week based on current tasks, deadlines, and dependencies?

For each one, ask me who else on the team probably asks it too, then describe what goes wrong when our answers differ.
Finally, say what would change if one shared AI agent like you answered it once where everyone could see it.
Keep it to a short table.
```

**AI response (Claude Opus 5.5)**

| Question | Who else probably asks it | What goes wrong when answers differ | With one shared agent, answered once in the open |
|---|---|---|---|
| Task status and blockers | Everyone: the lead before a stand-up or client update, each dev before picking up work, the BA to check which tickets are done or stuck. The PM, to watch progress | Each person's AI sees a different snapshot (old notes, one person's chat). A blocker one person knows about is invisible to the others, so work stalls or the client hears a wrong status | One status, built from the same task list and updates, that everyone sees. Blockers are visible to the person who can unblock them, and nobody has to re-ask |
| Meeting decisions and follow-ups | The lead writing the recap, the BA updating tickets with what was agreed, a dev who missed the meeting or owns an action item. The PM, to see what was decided | Each summary is made from a different person's notes, so decisions drift ("we agreed X" vs "we agreed Y"), owners are unclear and actions get dropped or done twice | One recap of decisions, owners and due dates, posted where everyone sees it. Disagreements show up right away and get fixed once, and the agent can remind owners |
| This week's priorities | The lead planning the week, each dev choosing what to do next, the BA deciding which tickets to get ready first. The PM, to check the plan against deadlines | Each person gets a ranking from their own view of deadlines and dependencies. People pull in different directions and dependent work is started out of order | One ranked list from the same deadlines and dependencies. The team discusses and adjusts one list instead of reconciling four, and the agent can flag when a change in one task shifts the order |

**Takeaway:** all three questions repeat because each person rebuilds the same context alone. Answering them once in a shared space turns several private answers (lead, devs, BA, PM) into one team answer.

---

## Lesson 2: How is a multiplayer agent different from traditional AI tools?

**Purpose:** tell a personal AI tool apart from an agent that works as a teammate.

A single-player AI is an extension of you: it signs in as you and knows only what you tell it. A multiplayer agent is its own team member, with three things:

| Capability | Single-player AI (a tool) | Multiplayer agent (a teammate) |
|---|---|---|
| **Identity and credentials** | Acts under your name and your login | Acts under its own name; the team decides what it can access and which tools it uses |
| **Shared memory** | Starts fresh each chat, or remembers only you | Remembers what everyone on the team taught it |
| **Shared context** | Sees only what you paste in | Reads the team's shared spaces (tickets, chat, docs), so it stays up to date |

**Example:** a dev asks AI to review a merge request.

- *Tool:* the dev pastes the diff and explains the team's coding rules again. The review is posted under the dev's name. Next week another dev pastes the same rules again.
- *Teammate:* the agent opens the MR itself, already knows the team's rules and last week's decisions from the ticket, and posts the review as "Review bot". Everyone sees the same review.

**Key takeaway:** a multiplayer agent = own identity + shared memory + shared context. Take one away and it slides back toward a personal tool.

**Reflection**

- Which tasks on my team would benefit from a shared set of instructions and context?
- Which recent decision was made out loud and never written down?

### Exercise: Tool or teammate?

Steps: pick an AI tool the team relies on, run the prompt below (it asks three questions one at a time), then note the smallest change that moves it one step toward teammate.

**Prompt**

```text
My team of 4 people relies on Claude for software development activities, including requirement analysis, planning, coding, code reviews, testing, and creating GitLab Merge Requests (MRs).

I want to figure out whether it is a personal tool or closer to a teammate. Ask me three questions, one at a time, and wait for each answer. 1) Does it act under its own name and sign-in, or under mine? 2) Does it remember our goals between conversations, or start fresh each time? 3) Can it read what my team writes in our shared spaces, or only what I paste in?

Then tell me which it is today, what my team is probably re-explaining or losing because of that, and the smallest change that would move it one step toward teammate.
```

**Conversation**

| # | Claude asked | My answer |
|---|---|---|
| 1 | Does Claude act under its own name and sign-in, or under yours? | Under each person's own name: everyone uses Claude with their own account and token, so commits, reviews and MRs show that person's name |
| 2 | Does it remember your goals between conversations, or start fresh each time? | Shared files in the repo: `CLAUDE.md`, rules and skills are committed, so anyone who opens Claude reads them. New decisions only stick if someone writes them in |
| 3 | Can it read what your team writes in shared spaces, or only what you paste in? | It can read most of it: tracker, team chat and shared docs are connected |

**AI response (Claude Opus 5.5)**

**Which it is today:** about two thirds of the way to a teammate. Memory and context are shared, but identity is not: Claude is still four personal tools that happen to read the same files.

| Capability | Today | Tool or teammate |
|---|---|---|
| Identity and credentials | Each person's own account and token | Tool |
| Shared memory | Committed `CLAUDE.md`, rules and skills | Mostly teammate, but only what someone writes down |
| Shared context | Reads tracker, chat and docs | Teammate, but through each person's own access |

**What the team is probably re-explaining or losing**

- **Who did what is blurred.** A review or MR from Claude looks like it came from the person who ran it. Reviewers can't tell AI work from human work, and nobody knows which rules that run used.
- **Each person's Claude sees a different slice.** It reads with the user's own permissions, so the BA's Claude and a dev's Claude can give different answers to the same question.
- **Decisions made in chat or meetings stay there.** Claude can read them, but they only reach shared memory if someone copies them into the repo files, so people keep re-stating them at the start of a session.
- **Access is not a team decision.** What Claude may touch is whatever each person's token allows, not something the team agreed on.

**Smallest next step:** give Claude its own identity for one job. For example, run MR code review under a `claude-bot` account with permissions the team agrees on (read the repo and issues, comment on MRs, no merge). Every review then shows up under one name, uses the same rules, and is visible to the whole team.

---

## Lesson 3: What a strong human-agent team looks like

**Purpose:** set up a team of people and agents so the agent helps instead of adding mistakes faster.

Agents get more work done, so a wrong goal or a mistake also spreads faster. Setting up the team well comes first.

**Four principles**

| Principle | What it means |
|---|---|
| **Clear roles** | Every person and agent has a defined job and the right tools. One roster, one set of artifacts, one shared workspace |
| **A written north star** | One sentence for the team's goal, always set by people. An agent that knows the goal can suggest useful work toward it |
| **Right information access** | Work in public. If it isn't written down where the agent can read it, the agent can't use it |
| **Gradual release (trust)** | Give the agent more freedom only as it proves reliable, then widen it on purpose |

**Who does what**

| People | Agent |
|---|---|
| Set the north star | Works toward the north star |
| Make the important judgment calls (scope, architecture, what goes to the client) | Drafts and prepares: specs, code, tests, notes, status |
| Decide how much freedom the agent gets | Works only inside its role and with the tools it was given |
| Accept or reject the agent's proposals | Proposes work on its own when it sees a gap |

**Example:** before a client demo, the agent drafts the demo script and lists open bugs. The tech lead decides what to show and what to cut, then presents it.

**Reflection**

- Which recurring job on my team has no clear owner today?
- Who on my team would accept or reject an agent's unrequested proposal?

### Exercise: Draft your roster

Steps: name a project and its people, run the prompt, check that every judgment call stays with a person, correct the north star, and mark one job you wouldn't hand to the agent yet.

**Prompt**

```text
Here's my team and a project we're starting:

Team (4 people):
- Me (Tech Lead): architecture, code review, client communication, final technical decisions
- Marry (Backend, Nodejs): API design, database schema, auth & permissions
- Henry (Frontend, React/TypeScript): UI components, forms, state management
- Tomas (Full-stack / DevOps): CI/CD, Docker, deployment, testing, bug fixing

Project: Admin dashboard (CRUD) for our Affiliate Bio Page product, which lets affiliates manage their profile, links, and display settings shown on the public bio page.
Scope: auth + role-based access, CRUD for profiles/links, image upload, preview of the public page, basic audit log.
Deadline: MVP in 6 weeks (by [date]), with a client demo at week 4.

Propose a roster for a human-agent team that includes one shared AI agent like you. For each job, say who leads (a named person or the agent) and who drafts or prepares. Add how often it runs and how the work gets checked.
Keep every decision that needs judgment with a person and say which ones those are. Finish with the one-sentence north star you think this team is working toward, so I can correct it.
```

**AI response (Claude Opus 5.5)**

**Roster:** 4 people + 1 shared agent working in the same tracker, repo and team channel.

| Job | Leads | Drafts / prepares | How often | How it's checked |
|---|---|---|---|---|
| Weekly plan and priorities | Tech Lead | Agent: ranked list from open tickets, deadlines and dependencies | Weekly (Monday) | Tech Lead approves; team adjusts in planning |
| Tickets and acceptance criteria | Tech Lead | Agent: tickets with ACs from the scope | Per feature, weeks 1-2, then as needed | Feature owner confirms the ACs are buildable |
| Architecture and API contract | Tech Lead | Marry; agent drafts the API spec | Once in week 1, then on change | Tech Lead signs off; Henry confirms it fits the UI |
| Database schema and migrations | Marry | Agent: migration and model drafts | Per feature | Marry reviews; runs on staging first |
| Auth and role-based access | Marry (owns the permission matrix) | Agent: tests for each role, from Marry's matrix | Weeks 1-2 | Marry + Tech Lead review; tests for every role pass |
| CRUD APIs, image upload, audit log | Marry | Agent: endpoint code and unit tests | Per ticket | MR review + CI |
| UI components, forms, public page preview | Henry | Agent: component and form drafts from the API spec | Per ticket | Henry reviews; checked in the browser against the ACs |
| First-pass code review | Agent | Agent: comments on every MR against team rules and ACs | Every MR | Tech Lead does the final review and approves the merge |
| Tests (unit, E2E) | Tomas | Agent: test cases from the ACs | Every MR | CI must pass; Tomas checks each AC has a test |
| CI/CD, Docker, deployment | Tomas | Agent: pipeline and Docker config drafts | Set up in week 1, deploys as needed | Tomas reviews; production deploys by Tomas only |
| Bug triage | Agent | Agent: reproduces, labels and suggests an owner | Daily | Tomas assigns or fixes; Tech Lead for priority calls |
| Daily status and blockers | Agent | Agent: posts in the team channel from tracker and MRs | Daily | Team corrects anything wrong in the thread |
| Meeting notes and decision log | Agent | Agent: decisions, owners, due dates | After each meeting | Tech Lead confirms the decisions |
| Client updates and week-4 demo | Tech Lead | Agent: demo script, release notes, update email drafts | Weekly + week 4 | Tech Lead edits and sends; nothing goes to the client from the agent |

**Decisions that stay with a person**

- **Tech Lead:** architecture and tech choices, scope cuts against the deadline, weekly priorities, final MR approval, everything sent to the client, which agent proposals to accept.
- **Marry:** API contract, database schema, the permission matrix (who can do what in each role).
- **Henry:** UX and layout choices in the dashboard and preview.
- **Tomas:** production deploys and rollbacks, test strategy.

**North star (please correct):** By week 6, affiliates can safely manage their own profile, links and display settings in the admin dashboard, with a working demo for the client at week 4.

---

## Lesson 4: Organizational checklist

**Purpose:** check honestly whether the team is ready before bringing in a shared agent.

**Core message:** an agent can only be as good as the team setup around it. Fix the gaps first, then add the agent.

**Five readiness questions**

| # | Question | If the answer is "no" |
|---|---|---|
| 1 | **Open and searchable:** is what people and agents need written in shared places, not private docs and DMs? | The agent can't stay up to date |
| 2 | **Clear owners, agents included:** is it written who owns what? | Work gets done twice, or not at all |
| 3 | **Right tools for everyone:** does every teammate, the agent too, have the access the job needs? | The agent does thin work, guesses or makes mistakes |
| 4 | **A check before a person sees it:** is the agent's key work checked by a rubric, a test or a second agent first? | People spend longer reviewing and fixing its work |
| 5 | **A written north star:** is there one goal everyone can point to? | Neither people nor the agent can see what is needed next |

**Example:** a team adds an agent for daily status, but tasks are tracked in personal notes (fails #1). The agent posts a status that misses half the work, and the team stops trusting it.

**Reflection**

- Which of the five questions would my team disagree about most?
- What is private by habit on my team that could be open on purpose?
