# Introduction to MCP: Notes

> Course: [Introduction to Model Context Protocol](https://academy.claude.com/courses/introduction-to-model-context-protocol/introducing-mcp) · Progress: 9 / 11 lessons · Last updated: 2026-10-22

## Course map

| Part | # | Lesson | Status |
|---|---|---|---|
| **Introduction** | 1 | [Introducing MCP](https://academy.claude.com/courses/introduction-to-model-context-protocol/introducing-mcp) | Done |
| | 2 | [MCP clients](https://academy.claude.com/courses/introduction-to-model-context-protocol/mcp-clients) | Done |
| **Hands-on with MCP servers** | 3 | [Defining tools with MCP](https://academy.claude.com/courses/introduction-to-model-context-protocol/defining-tools-with-mcp) | Done |
| | 4 | [The server inspector](https://academy.claude.com/courses/introduction-to-model-context-protocol/the-server-inspector) | Done |
| **Connecting with MCP clients** | 5 | [Implementing a client](https://academy.claude.com/courses/introduction-to-model-context-protocol/implementing-a-client) | Done |
| | 6 | [Defining resources](https://academy.claude.com/courses/introduction-to-model-context-protocol/defining-resources) | Done |
| | 7 | [Accessing resources](https://academy.claude.com/courses/introduction-to-model-context-protocol/accessing-resources) | Done |
| | 8 | [Defining prompts](https://academy.claude.com/courses/introduction-to-model-context-protocol/defining-prompts) | Done |
| | 9 | [Prompts in the client](https://academy.claude.com/courses/introduction-to-model-context-protocol/prompts-in-the-client) | Done |
| **Wrap-up** | 10 | [Final assessment on MCP](https://academy.claude.com/courses/introduction-to-model-context-protocol/final-assessment-on-mcp) | |
| | 11 | [MCP review](https://academy.claude.com/courses/introduction-to-model-context-protocol/mcp-review) | |

---

## Lesson 1: Introducing MCP

**Model Context Protocol (MCP)** is a communication layer that gives Claude **context and tools** without you writing much integration code.

**The problem:** a chat app that answers questions about the user's GitHub data needs Claude to have GitHub tools. GitHub has many features (repos, PRs, issues, projects), so you would write, test and maintain every tool schema and function yourself.

**The fix:** move tool definitions and execution out of your server into an **MCP server** for that service.

```text
Without MCP                              With MCP

┌─ Your server ───────────┐              ┌─ Your server ─┐       ┌─ GitHub MCP server ──┐
│ get_repos    schema+fn  │              │  MCP client   │ ────→ │ tools                │ ──→ GitHub
│ search_issues schema+fn │ ──→ GitHub   │               │ ←──── │ prompts              │
│ get_prs      schema+fn  │              └───────┬───────┘       │ resources            │
│ ... (you write them all)│                      │               └──────────────────────┘
└─────────────────────────┘                      ↕
                                              Claude
```

**Key terms**

- **MCP server**: an interface to an outside service (GitHub, AWS, ...). It exposes **tools**, **prompts** and **resources** in a standard way.
- **MCP client**: your server. It connects to one or more MCP servers.

**Common questions**

| Question | Answer |
|---|---|
| Who writes MCP servers? | Anyone. Service providers often publish official ones (e.g. AWS). |
| How is it different from calling the API directly? | The MCP server already defines the tool schemas and functions. With a direct API you write them yourself. |
| Isn't MCP just tool use? | No, they work together. **Tool use** = how Claude calls a tool. **MCP** = who implements the tool (the server, not you). |

---

## Lesson 2: MCP clients

The **MCP client** lives in your server and is the bridge to MCP servers. It handles the messages and protocol details, so your app just asks it for tools.

**Transport agnostic:** client and server can talk over any transport.

- **stdio**: most common, client and server on the same machine
- **HTTP**, **WebSockets** or other network protocols: server runs elsewhere

**Main message types**

| Request → | ← Result | Purpose |
|---|---|---|
| `ListToolsRequest` | `ListToolsResult` | Ask which tools the server provides |
| `CallToolRequest` | `CallToolResult` | Run one tool with arguments, get the result |

**Full flow:** "What repositories do I have?"

1. **Ask**: the user sends the question to your server.
2. **Discover tools**: your server → MCP client → MCP server: `ListToolsRequest`. It gets back `ListToolsResult` (the tool list).
3. **Claude picks a tool**: your server sends the question + tool list to Claude. Claude replies "use `get_repos`".
4. **Run the tool**: your server → MCP client → MCP server: `CallToolRequest`. The MCP server calls the GitHub API and returns the repo data as `CallToolResult`.
5. **Answer**: your server sends the tool result to Claude. Claude writes the final answer, and your server returns it to the user.

**Who does what**

- **Your server**: talks to the user and Claude, and decides when to ask the client.
- **MCP client**: sends `ListTools` / `CallTool` requests to the MCP server.
- **MCP server**: runs the tool and calls the real API (GitHub).
- **Claude**: picks the tool and writes the final answer. It never talks to the MCP server directly.

---

## Lesson 3: Defining tools with MCP

With the Python SDK, you define a tool as a normal function with a **decorator + type hints**. The SDK generates the JSON schema for Claude, so you don't write it by hand.

**Example:** a document server with docs kept in memory (`{doc_id: content}`).

```python
from mcp.server.fastmcp import FastMCP
from pydantic import Field

mcp = FastMCP("DocumentMCP", log_level="ERROR")
docs = {"plan.md": "The plan outlines the steps...", "spec.txt": "These specifications..."}

@mcp.tool(
    name="edit_document",
    description="Edit a document by replacing a string in the documents content with a new string.",
)
def edit_document(
    doc_id: str = Field(description="Id of the document that will be edited"),
    old_str: str = Field(description="The text to replace. Must match exactly, including whitespace."),
    new_str: str = Field(description="The new text to insert in place of the old text."),
):
    if doc_id not in docs:
        raise ValueError(f"Doc with id {doc_id} not found")
    docs[doc_id] = docs[doc_id].replace(old_str, new_str)
```

The lesson's second tool, `read_doc_contents(doc_id)`, works the same way and returns `docs[doc_id]`.

| Piece | Becomes |
|---|---|
| `@mcp.tool(name, description)` | Registers the tool and sets its name + description |
| Function parameters + type hints | Tool arguments, validated automatically |
| `Field(description=...)` | Argument description that tells Claude what to pass |
| `raise ValueError` | Tool error sent back to the client |

**Keep in mind:** clear names and descriptions help Claude pick the right tool and fill in the arguments correctly.

---

## Lesson 4: The server inspector

The **MCP Inspector** is a browser UI for testing an MCP server directly, without building a client app.

**Start it**

```bash
mcp dev mcp_server.py               # Python SDK: inspector for your own server
npx @modelcontextprotocol/inspector # standalone: inspector for any server
```

Then open the printed URL (usually `http://127.0.0.1:6274`).

**Use it**

1. Click **Connect**: the status changes from Disconnected to Connected.
2. Tabs: **Resources**, **Tools**, **Prompts**.
3. **Tools** → **List Tools** → pick a tool → fill in the arguments → **Run Tool** → check the status and the output.
4. Run tools in sequence to test a workflow (e.g. `edit_document` then `read_doc_contents`). Server state persists between calls.

**Example: inspect the GitHub MCP server**

UI: run `npx @modelcontextprotocol/inspector`, then connect with transport **STDIO**, command `npx`, args `-y @modelcontextprotocol/server-github`. To call tools against your account, add the env var `GITHUB_PERSONAL_ACCESS_TOKEN`.

---

## Lesson 5: Implementing a client

**Goal:** Lessons 3–4 built a server that has tools. This lesson builds the **client**: the code inside your app that talks to that server. (Real projects usually build only one side; the course builds both so you can see them connect.)

**The big picture**

```text
User question
     ↓
main.py  ←───→  Claude     your app: chats with Claude
     ↓ needs a tool
MCPClient                  your class: 2 functions, closes the connection when done
     ↓
ClientSession              from the SDK: the actual connection
     ↓
MCP server                 has the tools: read_doc_contents, edit_document
```

`MCPClient` only needs two functions. Each one passes the request to the SDK session:

```python
async def list_tools(self):                        # "What tools do you have?"
    result = await self.session().list_tools()
    return result.tools

async def call_tool(self, tool_name, tool_input):  # "Run this tool with this input"
    return await self.session().call_tool(tool_name, tool_input)
```

**Example:** "What is the contents of the report.pdf document?"

1. The app calls `list_tools()`, then sends the question + tool list to Claude.
2. Claude picks `read_doc_contents` with `doc_id = "report.pdf"`.
3. The app calls `call_tool(...)` to get the document text, sends it to Claude, and Claude answers.

**Run:** `uv run mcp_client.py` (client only, prints the tools) · `uv run main.py` (full app)

---

## Lesson 6: Defining resources

A **resource** exposes **read-only data** from an MCP server, like a GET endpoint in an HTTP API.

| | Tool | Resource |
|---|---|---|
| Used for | Doing an action | Reading data |
| Who uses it | Claude decides to call it | Your app fetches it |

**Example:** the user types `@report.pdf` in the chat. The app fetches that document through a resource and puts its text into the prompt, so Claude doesn't need to call a tool.

**Flow**

```text
Your app ──→ MCP client ──ReadResourceRequest (URI: docs://documents)──→ MCP server
Your app ←── MCP client ←──ReadResourceResult (the data)──────────────── MCP server
```

**Two kinds**

```python
# Direct: fixed URI, no parameters → list all docs (for the @ autocomplete)
@mcp.resource("docs://documents", mime_type="application/json")
def list_docs() -> list[str]:
    return list(docs.keys())

# Templated: {doc_id} in the URI becomes a function argument → one doc's text
@mcp.resource("docs://documents/{doc_id}", mime_type="text/plain")
def fetch_doc(doc_id: str) -> str:
    return docs[doc_id]
```

- `mime_type` tells the client what it gets back: `application/json`, `text/plain`, `application/pdf`...
- Return plain Python data. The SDK converts it to JSON for you.

**Test:** `uv run mcp dev mcp_server.py` → in the Inspector, direct resources are under **Resources** and templated ones under **Resource Templates** (fill in `doc_id`).

---

## Lesson 7: Accessing resources

**Purpose:** let the user attach a document to the question with `@`, so Claude gets the content up front instead of fetching it with a tool.

**Flow:** "What's in @report.pdf?"

```text
User types "@"
     ↓
App ── read_resource("docs://documents") ──→ MCP server            → list of doc names
     ↓ shows the list, user picks report.pdf
App ── read_resource("docs://documents/report.pdf") ──→ MCP server → the doc text
     ↓
App sends the question + the doc text to Claude
     ↓
Claude answers right away (no tool call)
```

**Resource vs tool for the same question**

- **Tool:** question → Claude asks for `read_doc_contents` → app runs it → Claude answers. Two trips to Claude.
- **Resource:** question + doc text → Claude answers. One trip.

**What `read_resource()` does** (new function in `MCPClient`)

1. Sends the URI to the server (`ReadResourceRequest`).
2. Takes the first item from the result (`ReadResourceResult`).
3. If the mime type is JSON, turns it into a Python object (e.g. the list of doc names). Otherwise it returns the plain text.

---

## Lesson 8: Defining prompts

**Purpose:** the MCP server ships **ready-made, tested prompts** for common jobs. The user picks one instead of writing a prompt from scratch, and gets better, more consistent results.

**Flow:** the `/format` command (turn a document into clean markdown)

```text
User types "/"  → sees the commands, picks format, enters doc_id = "plan.md"
     ↓
MCP server fills "plan.md" into its prompt template
     ↓
App sends the filled-in messages to Claude
     ↓
Claude rewrites the doc as markdown (headers, lists, tables) using the edit_document tool
```

**Key points**

- Defined like tools and resources: a function with `@mcp.prompt(name, description)` that takes `doc_id` and returns a **list of messages** for Claude.
- Fix or improve the prompt once on the server, and every client gets the better version.
- Test in the Inspector: open **Prompts**, enter `doc_id`, check the filled-in message.

**Tools vs resources vs prompts:** who decides to use it

| | Used for | Who decides |
|---|---|---|
| Tool | Doing an action | Claude |
| Resource | Reading data into the prompt | Your app (e.g. `@` mention) |
| Prompt | A ready-made instruction | The user (e.g. `/` command) |

---

## Lesson 9: Prompts in the client

**Purpose:** Lesson 8 put prompts on the server. This lesson lets the app **find** them and **get** one filled in, so the user can run them as `/` commands.

**Flow:** `/format plan.md`

```text
User types "/"
     ↓
App ── list_prompts() ──→ MCP server                                 → the prompt list, shown as commands
     ↓ user picks format, then picks plan.md from the doc list
App ── get_prompt("format", {"doc_id": "plan.md"}) ──→ MCP server    → messages with "plan.md" filled in
     ↓
App sends those messages to Claude
     ↓
Claude follows the instructions and uses tools to read and edit plan.md
```

**Key points**

- `list_prompts()`: "Which prompts do you have?"
- `get_prompt(name, args)`: "Give me this prompt with these values filled in." The server puts `args` into its template and returns ready-to-send messages.
- With this, `MCPClient` is complete:

| Function | Used for |
|---|---|
| `list_tools()`, `call_tool()` | Tools: Claude runs actions (Lesson 5) |
| `read_resource()` | Resources: the app adds data with `@` (Lesson 7) |
| `list_prompts()`, `get_prompt()` | Prompts: the user runs `/` commands (this lesson) |
