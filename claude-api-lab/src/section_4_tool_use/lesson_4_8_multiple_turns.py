"""Lesson 4.8 - Implementing multiple turns: a loop that runs tools until Claude is done.

Part 1: the helpers. Messages can hold text or a list of blocks; chat() sends
        the tools only when given; run_tool() routes a tool name to its function.
Part 2: run_conversation(): call Claude, run the tools it asks for, send the
        results back, repeat until stop_reason is no longer "tool_use".
        Uses only the get_current_datetime tool, so the loop runs twice:
        once to ask for the time, once to write the answer.

Run from claude-api-lab/:  uv run src/section_4_tool_use/lesson_4_8_multiple_turns.py
"""

import json
from datetime import datetime

from common import client, model, text_of

MAX_TURNS = 5  # safety stop so a confused model cannot loop forever


# --- The tool function (same as lesson 4.3) --------------------------------
def get_current_datetime(date_format="%Y-%m-%d %H:%M:%S"):
    """Return the current local date and time, formatted with strftime."""
    if not date_format:
        raise ValueError("date_format cannot be empty")
    return datetime.now().strftime(date_format)


GET_CURRENT_DATETIME_SCHEMA = {
    "name": "get_current_datetime",
    "description": "Returns the current local date and time, formatted with a Python strftime format.",
    "input_schema": {
        "type": "object",
        "properties": {
            "date_format": {
                "type": "string",
                "description": 'A Python strftime format, e.g. "%Y-%m-%d %H:%M:%S" or "%H:%M".',
            }
        },
        "required": [],
    },
}
TOOLS = [GET_CURRENT_DATETIME_SCHEMA]


# --- Part 1: helpers -------------------------------------------------------
def add_user_message(messages, content):
    """Append a user message. content is a string or a list of blocks."""
    messages.append({"role": "user", "content": content})


def add_assistant_message(messages, message):
    """Append Claude's whole reply, keeping every block (text and tool_use)."""
    messages.append({"role": "assistant", "content": message.content})


def chat(messages, tools=None):
    """Call Claude. Pass tools only when there are some."""
    kwargs = {"model": model, "max_tokens": 1000, "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return client.messages.create(**kwargs)


def run_tool(tool_name, tool_input):
    """Route a tool name to its Python function. New tools are added here."""
    if tool_name == "get_current_datetime":
        return get_current_datetime(**tool_input)
    raise ValueError(f"Unknown tool: {tool_name}")


def run_tools(message):
    """Run every tool_use block in the reply and build one tool_result per block."""
    tool_results = []
    for block in message.content:
        if block.type != "tool_use":
            continue
        print(f"  Claude asks to run: {block.name}({block.input})")
        try:
            result, is_error = json.dumps(run_tool(block.name, block.input)), False
        except Exception as error:
            # Send the error back as a result, so Claude can retry or explain it.
            result, is_error = f"Error: {error}", True
        print(f"  App result: {result}")
        tool_results.append(
            {"type": "tool_result", "tool_use_id": block.id, "content": result, "is_error": is_error}
        )
    return tool_results


# --- Part 2: the loop ------------------------------------------------------
def run_conversation(messages):
    """Keep calling Claude until it answers without asking for a tool."""
    for turn in range(1, MAX_TURNS + 1):
        print(f"\n--- Turn {turn} ---")
        message = chat(messages, tools=TOOLS)
        add_assistant_message(messages, message)
        print("Claude:", text_of(message) or "(no text yet)")

        if message.stop_reason != "tool_use":
            return messages  # final answer: no tool requested

        add_user_message(messages, run_tools(message))
    raise RuntimeError(f"No final answer after {MAX_TURNS} turns")


if __name__ == "__main__":
    print("=== Part 1: the helpers on their own ===")
    print("run_tool:", run_tool("get_current_datetime", {"date_format": "%H:%M"}))
    try:
        run_tool("unknown_tool", {})
    except ValueError as error:
        print("Unknown tool ->", f"ValueError: {error}")

    print("\n=== Part 2: the loop ===")
    history = []
    add_user_message(history, "What time is it right now? Answer in one short sentence.")
    history = run_conversation(history)
    print(f"\nMessages in history: {len(history)}")
