# Building with the Claude API: Notes

> Course: [Building with the Claude API](https://academy.claude.com/courses/building-with-the-claude-api) · Progress: 23 / 67 lessons, 0 / 8 quizzes · Last updated: 2026-11-11

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
| [1. Accessing Claude with the API](#1-accessing-claude-with-the-api) | 8 | Yes | In progress (8/8, quiz left) |
| [2. Prompt evaluation](#2-prompt-evaluation) | 6 | Yes | In progress (6/6, quiz left) |
| [3. Prompt engineering techniques](#3-prompt-engineering-techniques) | 5 | Yes | In progress (5/5, quiz left) |
| [4. Tool use with Claude](#4-tool-use-with-claude) | 12 | Yes | In progress (4/12) |
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

### 1.5 [System prompts](https://academy.claude.com/courses/building-with-the-claude-api/system-prompts)

**Purpose:** give Claude a role and rules, so its answers fit your app instead of being generic.

**Example: a math tutor app.** The student types the same question in both cases. Only the system prompt changes.

```text
CASE A: no system prompt
─────────────────────────
Request:  messages = [user: "How do I solve 5x + 2 = 3 for x?"]
              ▼
Claude:   Step 1: subtract 2 from both sides → 5x = 1
          Step 2: divide both sides by 5     → x = 1/5
          Answer: x = 1/5
              ▼
Result:   the student gets the answer but does no thinking.
          Bad for a tutor app.


CASE B: with a system prompt
─────────────────────────────
Request:  system   = "You are a patient math tutor.
                      Do not directly answer a student's questions.
                      Guide them to a solution step by step."
          messages = [user: "How do I solve 5x + 2 = 3 for x?"]
              ▼
Claude:   "Look at the + 2 on the left side.
           What operation would undo adding 2?
           Try it and tell me what you get."
              ▼
Student:  "Subtract 2 from both sides?"
              ▼
Claude:   "Yes! Now x is still multiplied by 5. What undoes that?"
              ▼
Result:   the student finds x = 1/5 by themselves.
```

| | No system prompt | With system prompt |
|---|---|---|
| Who Claude acts as | A general assistant | A patient math tutor |
| What it does | Solves the problem | Asks a question to guide the next step |
| Gives the answer x = 1/5? | Yes, right away | No, the student finds it |
| Fits a tutor app? | No | Yes |

**Flow**

```text
1. Write the role + rules as plain text ("You are a patient math tutor. ...")
      ▼
2. Send it in the system parameter, separate from the messages
      ▼
3. Claude follows it on every turn of the conversation
```

**Key points**

- A system prompt sets **how** Claude answers: role, tone, what to do and what not to do. It also keeps Claude on task.
- It lives in the `system` parameter, separate from the `user` / `assistant` history.
- Only add `system` when you have one: don't send `system=None`.

### 1.6 [Temperature](https://academy.claude.com/courses/building-with-the-claude-api/temperature)

**Purpose:** choose how predictable or how varied Claude's answers are.

**Where it acts:** at the last step of generating each token (see 1.1).

```text
1. Tokenize the input
      ▼
2. Predict: give every possible next token a probability
      ▼
3. Sample: pick one token   ◄── temperature changes the odds here
      ▼
   repeat for the next token
```

**Example:** after "What do you think", which word comes next?

```text
Next token   Temperature 1.0      Temperature 0.5   Temperature 0.0
             = model's own odds
──────────   ──────────────────   ───────────────   ───────────────
about        30%                  58%               100%  ← always
would        20%                  26%                 0%
of           10%                   6%                 0%
is           10%                   6%                 0%
when         10%                   6%                 0%
makes         5%                   2%                 0%
we            5%                   2%                 0%

1.0 → the model's own odds, unchanged: "about" wins only 3 times in 10 → varied answers
0.5 → the likely words get more likely, the rare ones nearly vanish
0.0 → always the most likely word → the same answer every time
```

> The course diagram shows 1.0 as "spread out" (23%, 18%, ...). That is a simplification: 1.0 is the API default and leaves the model's odds as they are. On the Claude API (0 to 1) temperature can only make the odds sharper, never flatter.

**Which value for which task**

| Range | Behaviour | Use for |
|---|---|---|
| Low, 0.0 to 0.3 | Predictable, same answer each time | Facts, coding help, data extraction, content moderation |
| Medium, 0.4 to 0.7 | Balanced | Summaries, teaching content, problem solving, creative writing with rules |
| High, 0.8 to 1.0 | Creative, varied | Brainstorming, creative writing, marketing copy, jokes |

**Key points**

- Temperature is a number from 0 to 1, sent with the request. The default is 1.0, which keeps the model's own odds; lower values make the top word more and more certain.
- It changes only the odds: a high value makes different answers likely, not guaranteed.
- Low for answers that must be right and repeatable, high for ideas, medium for most other tasks.
- Newer models such as `claude-opus-5-5` reject `temperature` (400 "deprecated for this model"). Use an older model like `claude-haiku-4-5` to try it.

### 1.7 [Response streaming](https://academy.claude.com/courses/building-with-the-claude-api/response-streaming)

**Purpose:** show the answer word by word while Claude writes it, instead of a spinner until the whole answer is done.

**The problem:** a long answer can take 10 to 30 seconds. Without streaming, the server waits for the full answer before sending anything, so the user sees nothing for that whole time.

```text
Without streaming                        With streaming
─────────────────                        ──────────────
App ──► Server ──► Claude                App ──► Server ──► Claude
         (wait 10-30s, app shows ...)             ◄── "Quantum"      → shown now
         ◄── whole answer                         ◄── " computing"   → shown now
App shows everything at once                      ◄── " is ..."      → shown now
                                         Same total time, but the first words
                                         appear after about 1 second
```

**Flow: the events of one streamed answer** (all from a single request)

```text
message_start            a new message begins
      ▼
content_block_start      a block begins (text, thinking, tool use ...)
      ▼
content_block_delta  ×N  a small piece of the text   ◄── this is what you show
      ▼
content_block_stop       the block is done
      ▼                  (newer models may send a thinking block first, then the text block)
message_delta            the message is done: stop reason, output tokens
      ▼
message_stop             end of the stream
```

**3 ways to read a stream**

| Way | What you get | When to use |
|---|---|---|
| Raw stream (`stream=True`) | Every event above; you pick out the text yourself | You need the details: block types, stop reason, usage |
| SDK `text_stream` | Only the text pieces, in order | Most apps: just show the text |
| `get_final_message()` after the stream | The complete message, like a normal response | Save the full answer, e.g. to a database, after streaming it to the user |

**Key points**

- Streaming does not make Claude faster. It makes the wait feel shorter, because the user reads while Claude writes.
- The text is in the `content_block_delta` events; the other events are start, stop and metadata.
- Common pattern: send each text piece to the browser, then keep the final message for storage.

### 1.8 [Structured data](https://academy.claude.com/courses/building-with-the-claude-api/structured-data)

**Purpose:** get only the data (JSON, code, a list, CSV) from Claude, with no extra text around it, so your code can use it directly.

**Example: a drink shop takes orders by chat.** A customer writes:

> "Hi, I'm Lan. 2 large milk teas and 1 cheesecake please, deliver to 12 Tran Phu, Da Nang."

The app asks Claude to turn this into JSON, then saves it as an order in the database.

**The problem:** Claude answers like it is chatting with a person, so the JSON comes with extra text around it.

~~~text
Claude's default answer (real lab output)   What the app needs
─────────────────────────────────────────   ──────────────────
```json                                     {
{                                             "name": "Lan",
  "name": "Lan",                              "items": [
  "items": [ ... ],                             {"item": "milk tea", "size": "large", "qty": 2},
  "address": "12 Tran Phu, Da Nang"             {"item": "cheesecake", "size": null, "qty": 1}
}                                             ],
```                                           "address": "12 Tran Phu, Da Nang"
The customer didn't give a size for the     }
cheesecake, so I set it to `null`.

→ json.loads fails on the first line ```json  → the app parses it and saves the order
~~~

**How does Claude know it should write JSON?**

Only because the prompt asks for it. Claude has no "JSON mode" by default: it reads "as JSON with the keys name, items, address" like any other instruction and does its best. That is why it still adds a code fence or a comment: it writes for a human reader. The fixes control the *form* of the answer:

| How you ask | What makes it JSON | Can it still break? |
|---|---|---|
| Prompt only ("... as JSON with keys ...") | Claude follows the instruction | Yes: fences, comments, a missing key |
| Prompt + prefill + stop sequence | The answer is forced to start inside a JSON block and is cut at its end | Rarely: the JSON itself can still be invalid |
| Prompt + structured outputs (schema) | The API only lets Claude write tokens that fit the schema | No, unless cut off by `max_tokens` |

**When to use it, and when not**

| Use structured data when | Don't, when |
|---|---|
| Code reads the answer: save to a database, call an API, fill a form, show a table | A person reads the answer: chat replies, explanations, emails |
| You extract fields from free text: orders, CVs, invoices, support tickets | The answer is free writing: a story, a summary, advice |
| You need the same keys every time, so the next step doesn't break | You don't know the shape in advance, or it changes per request |
| You classify: `{"category": "refund", "urgent": true}` | Forcing JSON would just hide text the user should read |

**Fix 1: prefill + stop sequence** (the course technique)

```text
1. User message       "Turn this order into JSON: Hi, I'm Lan. 2 large milk teas ..."
      ▼
2. Assistant message  ```json        ← we write the start of Claude's answer ourselves
      ▼                                Claude thinks it has already opened a JSON block,
                                       so it goes straight on with the JSON
3. Claude writes      { "name": "Lan", "items": [...], "address": "..." }
      ▼
4. Claude starts      ```            ← stop sequence: Claude is stopped right here,
   closing the block                   so the closing fence and the comment after it are never written
      ▼
5. The app            removes the leading newline → parses the JSON → saves the order
```

**Pick the prefill and stop sequence from how Claude wraps that kind of content:**

| Content | Prefill | Stop sequence |
|---|---|---|
| JSON | ```` ```json ```` | ```` ``` ```` |
| Python code | ```` ```python ```` | ```` ``` ```` |
| CSV, list, other | The marker Claude normally opens with | The marker that closes it |

**Fix 2: structured outputs** (the newer way). Newer models such as `claude-opus-5-5` reject prefill ("does not support assistant message prefill"). Instead, send the shape of the JSON (a schema) with the request, and the API guarantees the answer matches it:

```text
Schema sent with the request              Answer (always exactly this shape)
────────────────────────────              ──────────────────────────────────
name     text                             { "name": "Lan",
items    list of {item, size, qty}          "items": [ ... ],
address  text                               "address": "12 Tran Phu, Da Nang" }
nothing else allowed
```

| | Prefill + stop sequence | Structured outputs |
|---|---|---|
| How | Fake the start of the answer, cut at the end | Give the shape of the JSON (a schema) |
| Valid JSON? | Usually, not guaranteed | Always, and it matches the schema |
| Models | Older ones (e.g. `claude-haiku-4-5`) | Newer ones (e.g. `claude-opus-5-5`) |

**Key points**

- Prefill = the last message is an `assistant` message you wrote; Claude continues it instead of starting fresh.
- Stop sequence = a string that ends generation as soon as Claude writes it; it is not included in the answer.
- Strip the whitespace before parsing: the answer often starts with a newline.
- Getting the format right doesn't make the content right: tell Claude to use only facts in the text, and `null` for anything missing.
- Give the text → Claude extracts only what it says. Give only a name ("Generate information about X as JSON") → Claude answers from its training data, not a web search: more facts, but they can be out of date or differ from your source.

---

## 2. Prompt evaluation

**Section goal:** measure a prompt with a test set and scores, so every change to it is judged by numbers instead of by feel.

**Running example (used in all six lessons):** a prompt that answers AWS tasks with **only** Python, JSON or a regex, with no explanation around it.

**Lab (own example):** a support-ticket classifier (billing / technical / account) scored on 21 tickets, in [claude-api-lab/src/section_2_prompt_evaluation/](../../claude-api-lab/src/section_2_prompt_evaluation/). Result: without "Return only the category name" every answer scored 0 on format, even though the category was right; with it, 21/21.

### 2.1 [Prompt evaluation](https://academy.claude.com/courses/building-with-the-claude-api/prompt-evaluation)

**Purpose:** prompt engineering writes a prompt; prompt evaluation checks how good it is.

**What a prompt evaluation is:**

1. A set of test cases: sample inputs, often with the expected answer (e.g. a ticket + `billing`).
2. Run the **same prompt** on **every** test case and keep each answer.
3. Grade each answer (e.g. 0 to 10), then average the grades into one score for the prompt.

Change the prompt → run the same test cases again → the scores show which version is better.

**Three ways to finish a prompt:**

1. Try it once and ship it: breaks on the first unusual input.
2. Try it a few times and patch the odd cases: still misses most real inputs.
3. Run it through an eval pipeline, get a score, and improve it until the score goes up. ← the course's way

### 2.2 [A typical eval workflow](https://academy.claude.com/courses/building-with-the-claude-api/a-typical-eval-workflow)

**Purpose:** a repeatable process to measure the quality of a prompt and improve it step by step.

**Flow:**

```text
Step 1  Draft a prompt
        Write a first version. It doesn't need to be good yet.
           ▼
Step 2  Create an evaluation dataset
        Sample inputs like the ones the prompt will get in real use
        (common, unusual, tricky), so the test is close to reality.
           ▼
Step 3  Run the prompt on every input
        Same prompt, each input in turn → one answer per input.
           ▼
Step 4  Grade every answer
        Give each answer a score (e.g. 1-10) by code, a model or a person.
        Average of all scores = the score of this prompt version.
           ▼
Step 5  Change the prompt, repeat steps 3-4
        Same dataset, same grader → compare the two averages.
        Keep the higher one; stop when the score is good enough.
```

**Key points**

- Use the same dataset and grader for every version, or the scores can't be compared.
- A score means little on its own; it is useful as a comparison between two versions of the prompt.

### 2.3 [Generating test datasets](https://academy.claude.com/courses/building-with-the-claude-api/generating-test-datasets)

**Purpose:** get many test inputs fast by asking Claude to write them, instead of typing them by hand.

**Flow:**

1. Ask a fast model (Haiku) for a JSON array of test cases, e.g. `{"task": "Write a regex that matches an S3 bucket ARN"}`.
2. Use prefill ```` ```json ```` + stop sequence ```` ``` ```` (lesson 1.8) so the answer parses with `json.loads`.
3. Save the list to `dataset.json`, so every run uses the same tests.

### 2.4-2.6 Running the eval and grading

Lessons: [2.4 Running the eval](https://academy.claude.com/courses/building-with-the-claude-api/running-the-eval) · [2.5 Model-based grading](https://academy.claude.com/courses/building-with-the-claude-api/model-based-grading) · [2.6 Code-based grading](https://academy.claude.com/courses/building-with-the-claude-api/code-based-grading)

**Purpose:** run every test case through the prompt, give each answer a score, and average the scores into one number for the prompt. Lesson 2.4 builds the pipeline; 2.5 and 2.6 fill in the "grade" step.

**Pipeline:**

```text
Dataset (saved in lesson 2.3)
   A list of test cases, e.g. 20 tasks.
      ▼
For each test case, one at a time:
   ┌──────────────────────────────────────────────────────────┐
   │ 1. Build the prompt                                      │
   │    Put the test case's input into the prompt template.   │
   │       ▼                                                  │
   │ 2. Ask Claude                                            │
   │    Send the prompt, get Claude's answer (the output).    │
   │       ▼                                                  │
   │ 3. Grade the answer  ← a code grader, a model grader     │
   │    Give the output a score (1-10).     or both (below)   │
   │       ▼                                                  │
   │ 4. Save the result                                       │
   │    Keep the test case, the output and the score.         │
   └──────────────────────────────────────────────────────────┘
      ▼
List of results, one per test case
   Average of the scores = the score of this prompt version.
```

**The three kinds of grader**

| | Code grader (2.6) | Model grader (2.5) | Human grader |
|---|---|---|---|
| What it is | A function with a fixed rule | Another Claude call with a grading prompt | A person reads the answer |
| Good for | Format, valid JSON / Python / regex, length, required or forbidden words, exact expected answer | Did it do the task, quality, completeness, helpfulness, safety | Depth, tone, relevance, anything subtle |
| Speed and cost | Instant, free | One extra API call per answer | Slow, costly |
| Same answer, same score? | Always | Can vary a little | Can vary between people |
| Limit | Only what a rule can check: a right answer in the wrong form scores 0 | Can be wrong or too generous | Doesn't scale to many test cases |

**When to use which:** ask of each criterion "can a rule check it?"

```text
Can a rule decide pass / fail?  (valid JSON? exactly "billing"? under 100 words?)
   ├─ yes → code grader
   └─ no  → does it need judgement on meaning? (did it solve the task? is it helpful?)
              ├─ yes, many test cases → model grader
              └─ yes, few cases, or to check the model grader itself → human grader
```

Most prompts need more than one criterion, so mix them. In the course example (a prompt that must answer with only code):

| Criterion | Grader |
|---|---|
| Format: only code, no explanation | Code |
| Valid syntax: parses as JSON / Python / regex | Code |
| Task following: the code does what was asked | Model |

`score = (model_score + syntax_score) / 2`; change the weights if one criterion matters more.

**How each grader works**

- **Code grader (2.6):** add a `format` field to each test case (`"json"`, `"python"`, `"regex"`), try to parse the answer with the matching parser (`json.loads`, `ast.parse`, `re.compile`): parses → 10, error → 0.
- **Model grader (2.5):** send the task and the answer to Claude, ask for JSON with `strengths`, `weaknesses`, `reasoning` and `score` (1-10), keep `score` and `reasoning`. Asking for strengths and weaknesses first stops it from giving everything a middle score (around 6).

**Key points**

- Use code wherever a rule works: it is free, instant and always gives the same score. Keep the model for what needs judgement.
- Keep the output and the reasoning with each score: when a score is low, read them to see why.
- The first score is only a baseline: what matters is whether the next version of the prompt raises it (e.g. adding "Respond only with Python, JSON or a plain regex, no explanation").

### Section takeaway

- An eval = dataset + run the prompt on each case + grader + average score; change the prompt and compare.
- Generate the dataset with Claude and save it, so every run uses the same tests.
- Use code graders for what a rule can check (format, syntax) and a model grader for the rest (did it do the task).

---

## 3. Prompt engineering techniques

**Section goal:** improve a prompt with one technique at a time, and use the eval from section 2 to prove each one raises the score.

**Running example (used in the whole section):** a prompt that writes a one-day meal plan for an athlete, from their height, weight, goal and dietary restrictions.

### 3.1 [Prompt engineering](https://academy.claude.com/courses/building-with-the-claude-api/prompt-engineering)

**Purpose:** prompt engineering = take a prompt you wrote and improve it so the answers are better and more reliable. Section 2 measures a prompt; this section improves it.

**Flow:**

```text
Step 1  Set a goal
        What must a good answer contain? These become the grading criteria.
           ▼
Step 2  Write a first prompt
        Keep it basic on purpose: it is the baseline to beat.
           ▼
Step 3  Evaluate it
        Run the eval (section 2) → a baseline score.
           ▼
Step 4  Apply one technique
        Change one thing only, so you know what made the difference.
           ▼
Step 5  Evaluate again
        Score went up → keep the change. Didn't → undo it.
        Repeat steps 4-5 until the score is good enough.
```

**Key points**

- The first prompt in the course, "What should this person eat?" + the inputs, scores **2.3 / 10**: normal for a first try.
- Grading criteria for the meal plan: daily calorie total, macronutrient breakdown, meals with exact foods, portions and times.
- Keep 2-3 test cases while you iterate (fast, cheap); use more for the final check.
- The techniques, one per lesson: 3.2 being clear and direct, 3.3 being specific, 3.4 XML tags, 3.5 examples.

### 3.2-3.5 Building the prompt: task, data, guidelines, steps, examples

Lessons: [3.2 Being clear and direct](https://academy.claude.com/courses/building-with-the-claude-api/being-clear-and-direct) · [3.3 Being specific](https://academy.claude.com/courses/building-with-the-claude-api/being-specific) · [3.4 Structure with XML tags](https://academy.claude.com/courses/building-with-the-claude-api/structure-with-xml-tags) · [3.5 Providing examples](https://academy.claude.com/courses/building-with-the-claude-api/providing-examples)

**Purpose:** a good prompt is built from a few parts, each one leaving Claude less to guess.

**A full prompt, part by part** (meal plan example):

```text
① Generate a one-day meal plan for an athlete that meets their
  dietary restrictions.

② <athlete_information>
  - Height: 180 cm
  - Weight: 75 kg
  - Goal: maintain weight and improve power
  - Dietary restrictions: lactose intolerant
  </athlete_information>

③ Guidelines:
  1. Include accurate daily calorie amount
  2. Show protein, fat, and carb amounts
  3. Specify when to eat each meal
  4. Use only foods that fit restrictions
  5. List all portion sizes in grams
  6. Keep budget-friendly if mentioned

④ Steps: (only for complex tasks; a meal plan doesn't need them)
  1. ...  2. ...  3. ...

⑤ Here is an example input with an ideal response:
  <sample_input> ...an athlete... </sample_input>
  <ideal_output> ...a meal plan that scored 10 in the eval... </ideal_output>
  This example is well-structured, gives exact foods and quantities,
  and fits the athlete's goals and restrictions.
```

| # | Part | What it does | When to add | How to write it | Lesson |
|---|---|---|---|---|---|
| ① | Task | Says what to do | Always, as the first line | An instruction, not a question; start with a verb (Write, Create, Generate); include the action, the thing to make and the main limits | 3.2 |
| ② | Data in XML tags | Separates the data from the instructions | The prompt includes data: user input, documents, code, records | Descriptive tag names: `<athlete_information>`, `<sales_records>`, not `<data>`; one tag per kind of content (`<my_code>`, `<docs>`) | 3.4 |
| ③ | Guidelines | Says what a good answer has: length, format, required content, tone | Almost always | A numbered list of things the answer must have | 3.3 |
| ④ | Steps | Says how to think before answering | Complex tasks: troubleshooting, decisions, anything that needs several angles | A numbered list of steps, e.g. "why did sales drop 30%?": check market, industry, team, organization and customer feedback | 3.3 |
| ⑤ | Examples | Shows a good answer instead of describing it | Tricky cases the rules don't cover, an exact format or tone, ambiguous inputs | Input + ideal output in XML tags (`<sample_input>`, `<ideal_output>`), plus one line on why the output is good | 3.5 |

**Score of the meal plan prompt as parts are added**

| Prompt | Score |
|---|---|
| "What should this person eat?" + the inputs | 2.32 |
| + ① first line rewritten as a direct task | 3.92 |
| + ③ guidelines | 7.86 |
| + ② XML tags | No score given: little change on a short prompt, more on long ones with mixed content |
| + ⑤ examples | No score given |

**Examples (⑤) in more detail**

- **One-shot** = one example, to show the pattern. **Multi-shot** = several, to cover different cases.
- **Use them for the case Claude gets wrong.** Tweet sentiment (Positive / Negative): "Yeah, sure, best movie since Plan 9 from Outer Space" is sarcastic, so Negative, but Claude reads it as Positive. Fix: add a normal example ("Great game tonight!" → Positive) and a sarcastic one ("Oh yeah, I really needed a flight delay tonight! Excellent!" → Negative).
- **Where to find good examples:** in the eval report (section 2), take the answers that scored 10.
- **Say why the example is good:** Claude then learns the reasoning, not only the format.

**Key points**

- A vague prompt leaves length, format and content to Claude, so every answer is different.
- Guidelines control the answer; steps control the thinking. They can be used together.
- Rules (③) describe a good answer; examples (⑤) show one. Use examples where the rules aren't enough.
- Add one part at a time and run the eval after each (lesson 3.1).

### Section takeaway

- Improve a prompt in a loop: one change at a time, run the eval after each, keep what raises the score.
- A good prompt has a direct task as its first line, data in named XML tags, guidelines for the answer, steps for complex tasks and examples for tricky cases.
- The biggest jump in the course example came from guidelines: 3.92 → 7.86.

---

## 4. Tool use with Claude

**Section goal:** let Claude ask your code for data it doesn't have (live weather, a database, an API), so it can answer with fresh facts instead of saying "I don't know".

### 4.1 [Introducing tool use](https://academy.claude.com/courses/building-with-the-claude-api/introducing-tool-use)

**Purpose:** Claude only knows what it learned in training, so it can't answer about anything live or private. Tool use lets Claude ask your code to fetch that data for it.

**What is a tool?** A function in your code (e.g. `get_weather(city)`) that you tell Claude about: its name, what it does, what input it needs. Claude can't run it; it can only ask your app to run it.

**Without a tool vs with a tool**

```text
Without a tool                              With a get_weather tool
──────────────                              ───────────────────────
User:   What's the weather in               User:   What's the weather in
        San Francisco?                              San Francisco?
Claude: Sorry, I don't have                 Claude: (asks your app) please run
        up-to-date weather data.                    get_weather("San Francisco")
                                            App:    (runs it) 18°C, sunny
                                            Claude: It's 18°C and sunny in
                                                    San Francisco right now.
```

**Flow: who does what**

```text
User          asks "What's the weather in San Francisco?"
  ▼
Your app      sends Claude the question + the list of tools it may use
  ▼
Claude        decides it needs live data → replies with a tool request
              "run get_weather, city = San Francisco" (not an answer yet)
  ▼
Your app      runs get_weather → calls a weather API → gets "18°C, sunny"
  ▼
Your app      sends the result back to Claude
  ▼
Claude        writes the answer: "It's 18°C and sunny in San Francisco."
  ▼
User          sees the answer
```

**Key points**

- Claude chooses **when** to use a tool and **what input** to give it. Your code does the real work (the API call, the database query) and returns the result.
- One question now takes two calls to Claude: one that returns the tool request, one with the tool result that returns the answer.
- Use tools for anything Claude can't know by itself: live data (weather, stock prices), your own database, other services.

### 4.2 [Project overview](https://academy.claude.com/courses/building-with-the-claude-api/project-overview)

**Purpose:** the project for this section: Claude sets a reminder from a request like "Remind me about my doctor's appointment a week from Thursday".

**Why Claude can't do it alone, and the tool that fixes each gap:**

| Claude's gap | Tool to build |
|---|---|
| Doesn't know the exact current date and time | `get_current_datetime` |
| Date maths can be wrong ("a week from Thursday") | Add a duration to a date |
| Has no way to save a reminder | Set a reminder |

**Key point:** when the model can't do something, give it a tool instead of working around it in the prompt. The tools are built one at a time, simplest first.

### 4.3 [Tool functions](https://academy.claude.com/courses/building-with-the-claude-api/tool-functions)

**Purpose:** a tool function is a plain Python function that your app runs when Claude asks for it.

**The first tool:** `get_current_datetime` returns the current date and time in the format it is given (default `2026-11-11 14:30:25`, or `14:30` for hours and minutes), and raises an error if the format is empty.

**How to write a tool function**

- Clear names for the function and its parameters: Claude reads them to decide when and how to call it.
- Check the inputs and raise an error when one is empty or wrong.
- Write error messages Claude can act on: Claude sees the error and can retry with a fixed input (e.g. "Location cannot be empty").

**Next (4.4):** describe the function to Claude with a JSON schema.

**Lab:** [lesson_4_3_tool_functions.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_3_tool_functions.py) runs this tool on its own, then lets Claude use it: without the tool Claude says "I can't see the current time"; with it, Claude asks for `get_current_datetime`, the app runs it, and Claude answers "It's 5:22 PM."

### 4.4 [Tool schemas](https://academy.claude.com/courses/building-with-the-claude-api/tool-schemas)

**What it is:** a tool schema is a short description of a tool function, written as JSON and sent to Claude with the request. It says what the tool is called, what it does and what input it takes.

**Why it is needed:** Claude never sees your Python code. The schema is the only thing it knows about the tool, so Claude uses it to decide **whether** to call the tool for a question and **what input** to send. No schema → Claude doesn't know the tool exists. A vague schema → Claude calls it at the wrong time or with the wrong input.

**Flow:**

```text
Tool function (your code)        Claude can't see it
      ▼  you describe it
Tool schema (JSON)               sent with the request, in "tools"
      ▼  Claude reads it
Claude decides                   "the user asks the time → call get_current_datetime,
                                  date_format = %H:%M"
```

**The three parts** (for `get_current_datetime`):

| Part | What it says | Example |
|---|---|---|
| `name` | The tool's name, same as the function | `get_current_datetime` |
| `description` | What it does, when to use it, what it returns | "Returns the current date and time formatted according to the specified format" |
| `input_schema` | Each input: name, type, description, required or not | `date_format`: text, a Python strftime format, optional (default `%Y-%m-%d %H:%M:%S`) |

**Key points**

- Write the description in 3-4 sentences: what the tool does, when to use it, what it returns. Describe every input too.
- Don't write the schema by hand: give Claude the function and the [tool use docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) and ask "Write a valid JSON schema spec for tool calling for this function".
- Name it after the function (`get_current_datetime` → `get_current_datetime_schema`); wrap it in `ToolParam` (from `anthropic.types`) to catch type mistakes.

**Lab:** the schema is `GET_CURRENT_DATETIME_SCHEMA` in [lesson_4_3_tool_functions.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_3_tool_functions.py).

### 4.5-4.6 [Handling message blocks](https://academy.claude.com/courses/building-with-the-claude-api/handling-message-blocks) and [sending tool results](https://academy.claude.com/courses/building-with-the-claude-api/sending-tool-results)

**Purpose:** one tool round trip. When Claude uses a tool, its reply has several blocks, not one text block. Your code runs the tool and sends the result back, then Claude gives the final answer.

**Flow (one round):**

```text
1. You    → Claude: user message + tools
2. Claude → you:    text block + tool_use block (ID, tool name, input)
3. You:   save the FULL reply as the assistant message
4. You:   run the tool with that input
5. You    → Claude: user message holding a tool_result block (same ID)
6. Claude → you:    final answer (text only)
```

**Key points**

- Claude keeps no history: resend the whole conversation on every call.
- Keep both the text and the tool_use block in the assistant message. Saving only the text loses the tool call.
- Each tool_result must carry the `tool_use_id` of its request. With several tool calls in one reply, results can come back in any order, so the ID is what matches them.
- Helper functions such as `add_assistant_message()` must accept a list of blocks, not only a string.
- Keep the `tools` list in follow-up calls, even when you do not expect another tool call.

**Lab:** the tool-enabled call is in [lesson_4_3_tool_functions.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_3_tool_functions.py).

### 4.7 [Multi-turn conversations with tools](https://academy.claude.com/courses/building-with-the-claude-api/multi-turn-conversations-with-tools)

**Purpose:** one question can need several tools in a row. Example: "What day is 103 days from today?" needs today's date first, then a date calculation. The app must loop until Claude stops asking for tools.

**Flow (multiple tools):**

```text
User: "What day is 103 days from today?"
  ▼
Claude → tool_use: get_current_datetime
  ▼ app runs it, sends tool_result back
Claude → tool_use: add_duration_to_datetime
  ▼ app runs it, sends tool_result back
Claude → text only: "103 days from today is …"  → STOP, show answer
```

**The loop**

1. Call Claude with the whole history and the tools.
2. Add Claude's reply to the history as an assistant message.
3. No tool_use block in the reply → stop, the text is the final answer.
4. Otherwise run each requested tool, put all results in one user message, add it to the history, go to step 1.

**Key points**

- Multi-tool answers come from a loop, not from one call.
- Helpers must accept content blocks, return the full message, and have an optional `tools` parameter.
- A text-extraction helper joins the text blocks when showing the answer.
- Next lesson, 4.8, builds the loop itself.

### 4.8 [Implementing multiple turns](https://academy.claude.com/courses/building-with-the-claude-api/implementing-multiple-turns)

**Purpose:** turn the 4.7 flow into code: a loop that stops when Claude gives a final answer.

**Stop signal:** `stop_reason == "tool_use"` means keep looping; anything else means done.

**Key points**

- Add a turn cap as a safety stop; the course's loop has none.
- Every tool_use block needs a matching tool_result, even when the tool fails: send the error as a result with `is_error` set.
- Route tool names through one dispatch function, so new tools do not change the loop.

**Lab:** [lesson_4_8_multiple_turns.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_8_multiple_turns.py). Next: 4.9, multiple tools.

### 4.9 [Using multiple tools](https://academy.claude.com/courses/building-with-the-claude-api/using-multiple-tools)

**Purpose:** add more tools to the same loop; Claude chains them when one answer needs both (e.g. compute a date, then set a reminder for it).

**Add a tool in 4 steps:** write the function, write its schema, add the schema to the `tools` list, add a case in the tool router. The loop does not change.

**Key points**

- Date maths goes to a tool: Claude is not reliable at it.
- One reply can mix text and several tool requests; run them all in one step.

### 4.10 [Fine-grained tool calling](https://academy.claude.com/courses/building-with-the-claude-api/fine-grained-tool-calling)

**Purpose:** how the tool's JSON arguments arrive while Claude writes them.

| | Basic tool streaming (default) | Fine-grained (beta) |
|---|---|---|
| How chunks arrive | Gathered per top-level key, then sent in a burst | As Claude writes them, no buffering |
| Feel in the UI | Pauses, then a block appears | Smooth, text grows steadily |
| JSON validity | Always valid | Can be incomplete or invalid until the end |
| Your code must | Just parse | Check the JSON before using it |
| Enable | Nothing extra | Beta header + `eager_input_streaming` on the tool |

**Use fine-grained when** you show tool-argument progress in the UI or start work on partial arguments early. **Otherwise keep the default.**

**Lab:** [lesson_4_10_fine_grained_tool_calling.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_10_fine_grained_tool_calling.py) streams the same tool call both ways and prints the chunk timings.

### 4.11 [The text edit tool](https://academy.claude.com/courses/building-with-the-claude-api/the-text-edit-tool)

**Purpose:** a built-in tool that lets Claude view, change and create files. Claude knows the tool; your code must do the file work.

**Your side**

- Send only a short stub in `tools`; its type and name depend on the model family.
- Carry out each command Claude asks for, then send the result back in the same loop as before.
- Limit the paths: only allow files inside a folder you choose.

| Command | What Claude uses it for |
|---|---|
| `view` | Show a folder listing or a file, or a line range |
| `str_replace` | Replace one exact piece of text (must match once) |
| `create` | Create a new file |
| `insert` | Insert text after a given line |

**Lab:** [lesson_4_11_text_edit_tool.py](../../claude-api-lab/src/section_4_tool_use/lesson_4_11_text_edit_tool.py) works in a temporary folder: Claude views `main.py`, adds a docstring, and creates `test_main.py`.

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
