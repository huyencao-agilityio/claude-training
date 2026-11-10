# Building with the Claude API: Notes

> Course: [Building with the Claude API](https://academy.claude.com/courses/building-with-the-claude-api) · Progress: 4 / 67 lessons, 0 / 8 quizzes · Last updated: 2026-11-10

<!--
How these notes are organized
- One `##` per course section, one `###` per lesson, numbered <section>.<lesson> (e.g. 4.3).
- Lesson template (fill in when the lesson is done, replace "_Not started_"):

  **Purpose:** why this exists, in one line.
  **Flow:** numbered steps or a vertical diagram, with one real example.
  **Key points:** 2-4 bullets. Code only when needed, kept short.

- Each section ends with "Section takeaway" (3 bullets max) and "Quiz notes" (only the questions I got wrong and why).
- Sections 7 (MCP) and 8 (Claude Code) overlap with other notes: write only what is new and link the rest.
- Update the course map status and the Progress line after each lesson.
-->

## Course summary

**What the course is about:** _fill in after section 1._

**Key takeaways so far**

_Add one line per section as you finish it, tagged with the section, e.g. (S1)._

## Course map

| Section | Lessons | Quiz | Status |
|---|---|---|---|
| [1. Accessing Claude with the API](#1-accessing-claude-with-the-api) | 8 | Yes | In progress (4/8) |
| [2. Prompt evaluation](#2-prompt-evaluation) | 6 | Yes | Not started |
| [3. Prompt engineering techniques](#3-prompt-engineering-techniques) | 5 | Yes | Not started |
| [4. Tool use with Claude](#4-tool-use-with-claude) | 12 | Yes | Not started |
| [5. RAG and agentic search](#5-rag-and-agentic-search) | 7 | No | Not started |
| [6. Features of Claude](#6-features-of-claude) | 8 | Yes | Not started |
| [7. Model Context Protocol](#7-model-context-protocol) | 10 | Yes | Not started |
| [8. Anthropic apps: Claude Code and computer use](#8-anthropic-apps-claude-code-and-computer-use) | 4 | No | Not started |
| [9. Agents and workflows](#9-agents-and-workflows) | 7 | Yes | Not started |
| [10. Final assessment](#10-final-assessment) | 0 | Yes | Not started |

---

## 1. Accessing Claude with the API

**Section goal:** _one line._

### 1.1 [Accessing the API](https://academy.claude.com/courses/building-with-the-claude-api/accessing-the-api)

**Purpose:** see what happens to a message from the moment the user sends it until the answer shows on screen.

**Flow: the 5-step request**

```text
┌────────────────────────┐
│ User app (web/mobile)  │
└───────────┬────────────┘
            │ 1. "What is quantum computing?"
            ▼
┌────────────────────────┐
│ Your server            │   holds the API key
└───────────┬────────────┘
            │ 2. request: API key · model · messages · max_tokens
            ▼
┌────────────────────────┐
│ Anthropic API → Claude │   3. process (see below)
└───────────┬────────────┘
            │ 4. response: message · usage (in/out tokens) · stop reason
            ▼
┌────────────────────────┐
│ Your server            │
└───────────┬────────────┘
            │ 5. forward the text
            ▼
┌────────────────────────┐
│ User app shows answer  │
└────────────────────────┘
```

The app never calls Anthropic directly: a key in client code can be stolen.

**Flow: inside Claude's processing** (example input: "What is quantum computing?")

```text
┌─ 1. TOKENIZATION ── cut the text into pieces ───────────────────────────┐
│  "What is quantum computing?"                                           │
│        → [What] [is] [quantum] [computing] [?]                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─ 2. EMBEDDING ── each piece becomes a list of numbers ──────────────────┐
│  quantum → [0.12, -0.80, 0.45, ...]   (numbers are made up)             │
│  The numbers hold ALL meanings the word can have:                       │
│    • physics (quantum mechanics)                                        │
│    • a tiny fixed amount (a quantum of energy)                          │
│    • a big sudden change ("a quantum leap")                             │
│  Claude doesn't know yet which one you mean.                            │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─ 3. CONTEXTUALIZATION ── nearby words choose the meaning ───────────────┐
│  quantum  +  computing  →  physics / computers                          │
│  "quantum leap" meaning is dropped.                                     │
│  (Same idea: "bank" next to "river" ≠ "bank" next to "money")           │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─ 4. GENERATION ── guess the next word, one at a time ───────────────────┐
│  Next word?   Quantum 30% │ Great 23% │ Are 19% │ What 10% │ ...        │
│  Pick one (mostly by probability, with a bit of randomness)             │
│  Append it, then guess again:                                           │
│    "Quantum" → "Quantum computing" → "Quantum computing uses" → ...     │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
                     ┌───────────────────────────┐
                     │  After each token: stop?  │── no ──► back to 4
                     └─────────────┬─────────────┘
                                   │ yes, one of:
                                   │  • max_tokens reached  (answer may be cut)
                                   │  • natural end         (end-of-sequence token)
                                   │  • stop sequence hit   (a phrase you set)
                                   ▼
                  Response sent back, with the stop reason
```

**Key points**

- The API key stays on your server; the app only talks to your server.
- Every request needs 4 things: API key, model, messages, max tokens.
- Claude writes one token at a time, so `max_tokens` can cut an answer short: check the stop reason in your code.
- Knowing these steps tells you where to look when something goes wrong (key, request, limit, stop).

### 1.2 [Getting an API key](https://academy.claude.com/courses/building-with-the-claude-api/getting-an-api-key)

**Purpose:** create the secret key every API request needs.

```text
platform.claude.com  (log in)
      ▼
Get API Key  (top right of the dashboard)
      ▼
Create Key
      ▼
Workspace: Default  ·  Name: e.g. "Anthropic Course"   →  Add
      ▼
Copy the key NOW  (shown only once)
```

**Key points**

- The name is only a label to tell your keys apart.
- Lost the key? Delete it and create a new one; it can't be shown again.
- Keep it secret: on your server only, never in client code or in the repo.

### 1.3 [Making a request](https://academy.claude.com/courses/building-with-the-claude-api/making-a-request)

**Purpose:** send a first message to Claude from Python and read the answer.

**Flow**

```text
1. Install        pip install "anthropic<1" python-dotenv
      ▼
2. .env file      ANTHROPIC_API_KEY="..."    (add .env to .gitignore)
      ▼
3. Load + client  load_dotenv()  →  client = Anthropic()   (reads the key from env)
      ▼
4. Request        client.messages.create(model, max_tokens, messages)
      ▼
5. Read answer    message.content[0].text
```

**The 3 required parameters**

| Parameter | What it is |
|---|---|
| `model` | Which Claude model, e.g. `"claude-haiku-4-5"` |
| `max_tokens` | A safety cap, not a target: Claude stops at the cap but doesn't try to reach it |
| `messages` | The conversation so far: a list of `{"role": "user" \| "assistant", "content": "..."}` |

**Code**

```python
message = client.messages.create(
    model=model,
    max_tokens=1000,
    messages=[{"role": "user", "content": "What is quantum computing? Answer in one sentence"}],
)
print(message.content[0].text)
```

**Key points**

- `user` = what a human writes, `assistant` = what Claude wrote.
- The response holds the text plus metadata; `content[0].text` is just the text.

### 1.4 [Multi-turn conversations](https://academy.claude.com/courses/building-with-the-claude-api/multi-turn-conversations)

**Purpose:** make Claude "remember" earlier messages.

**Core idea:** Claude is stateless. It stores nothing between requests, so **your code keeps the history and sends all of it every time**.

```text
Without history                         With history
───────────────                         ────────────
Request 1: [user: Define quantum        Request 1: [user: Define quantum computing]
            computing]                  ← answer A  → append as assistant message
Request 2: [user: Write another         Request 2: [user: Define quantum computing,
            sentence]                               assistant: A,
→ random sentence: no context                       user: Write another sentence]
                                        → a 2nd sentence about quantum computing
```

**Flow**

```text
messages = []
   │ add user message ──► send all ──► get answer
   │ add answer as assistant message
   │ add next user message ──► send all ──► ...
   └─ the list grows by 2 every turn
```

**Key points**

- Forget to append Claude's answer and it loses its own previous reply.
- Messages alternate `user` → `assistant` → `user`.
- 3 helpers make this easy: add a user message, add an assistant message, `chat` (send the list, return the text).

### 1.5 System prompts

_Not started_

### 1.6 Temperature

_Not started_

### 1.7 Response streaming

_Not started_

### 1.8 Structured data

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 2. Prompt evaluation

**Section goal:** _one line._

### 2.1 Prompt evaluation

_Not started_

### 2.2 A typical eval workflow

_Not started_

### 2.3 Generating test datasets

_Not started_

### 2.4 Running the eval

_Not started_

### 2.5 Model-based grading

_Not started_

### 2.6 Code-based grading

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 3. Prompt engineering techniques

**Section goal:** _one line._

### 3.1 Prompt engineering

_Not started_

### 3.2 Being clear and direct

_Not started_

### 3.3 Being specific

_Not started_

### 3.4 Structure with XML tags

_Not started_

### 3.5 Providing examples

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 4. Tool use with Claude

**Section goal:** _one line._

### 4.1 Introducing tool use

_Not started_

### 4.2 Project overview

_Not started_

### 4.3 Tool functions

_Not started_

### 4.4 Tool schemas

_Not started_

### 4.5 Handling message blocks

_Not started_

### 4.6 Sending tool results

_Not started_

### 4.7 Multi-turn conversations with tools

_Not started_

### 4.8 Implementing multiple turns

_Not started_

### 4.9 Using multiple tools

_Not started_

### 4.10 Fine-grained tool calling

_Not started_

### 4.11 The text edit tool

_Not started_

### 4.12 The web search tool

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 5. RAG and agentic search

**Section goal:** _one line._

### 5.1 Introducing Retrieval Augmented Generation

_Not started_

### 5.2 Text chunking strategies

_Not started_

### 5.3 Text embeddings

_Not started_

### 5.4 The full RAG flow

_Not started_

### 5.5 Implementing the RAG flow

_Not started_

### 5.6 BM25 lexical search

_Not started_

### 5.7 A multi-index RAG pipeline

_Not started_

### Section takeaway

-

---

## 6. Features of Claude

**Section goal:** _one line._

### 6.1 Extended thinking

_Not started_

### 6.2 Image support

_Not started_

### 6.3 PDF support

_Not started_

### 6.4 Citations

_Not started_

### 6.5 Prompt caching

_Not started_

### 6.6 Rules of prompt caching

_Not started_

### 6.7 Prompt caching in action

_Not started_

### 6.8 Code execution and the Files API

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 7. Model Context Protocol

**Section goal:** _one line._

> Most of this section is covered in [introduction-to-mcp.md](introduction-to-mcp.md). Write only what is new here and link the matching lesson there.

### 7.1 Introducing MCP

_Not started_

### 7.2 MCP clients

_Not started_

### 7.3 Project setup

_Not started_

### 7.4 Defining tools with MCP

_Not started_

### 7.5 The server inspector

_Not started_

### 7.6 Implementing a client

_Not started_

### 7.7 Defining resources

_Not started_

### 7.8 Accessing resources

_Not started_

### 7.9 Defining prompts

_Not started_

### 7.10 Prompts in the client

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 8. Anthropic apps: Claude Code and computer use

**Section goal:** _one line._

> Claude Code basics are covered in [claude-code-101.md](claude-code-101.md). Write only what is new here.

### 8.1 Anthropic apps: Claude Code and computer use

_Not started_

### 8.2 Claude Code setup

_Not started_

### 8.3 Claude Code in action

_Not started_

### 8.4 Adding MCP servers to Claude Code

_Not started_

### Section takeaway

-

---

## 9. Agents and workflows

**Section goal:** _one line._

### 9.1 Agents and workflows

_Not started_

### 9.2 Parallelization workflows

_Not started_

### 9.3 Chaining workflows

_Not started_

### 9.4 Routing workflows

_Not started_

### 9.5 Agents and tools

_Not started_

### 9.6 Environment inspection

_Not started_

### 9.7 Workflows vs agents

_Not started_

### Section takeaway

-

### Quiz notes

-

---

## 10. Final assessment

**Score:** _fill in._

### Quiz notes

-
