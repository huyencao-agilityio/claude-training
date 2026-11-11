"""Lesson 4.3 - Tool functions: the first tool of the reminder project.

Part 1: call the tool function yourself, like any Python function, including
        a bad input that raises a clear error.
Part 2: let Claude use it. Ask "What time is it?": without the tool Claude
        can't know; with it, Claude asks the app to run get_current_datetime,
        the app runs it and sends the result back, Claude answers.
        Part 2 uses the schema (lesson 4.4) and the tool messages (4.5-4.6)
        before the course explains them, so you can see the whole loop.

Run from claude-api-lab/:  uv run src/section_4_tool_use/lesson_4_3_tool_functions.py
"""

from datetime import datetime

from common import client, model, text_of


# --- The tool function -----------------------------------------------------
def get_current_datetime(date_format="%Y-%m-%d %H:%M:%S"):
    """Return the current local date and time, formatted with strftime."""
    if not date_format:
        # Claude sees this message and can retry with a valid format.
        raise ValueError("date_format cannot be empty")
    return datetime.now().strftime(date_format)


# --- Part 1: call it yourself ----------------------------------------------
print("=== Part 1: the function on its own ===")
print("Default format:", get_current_datetime())
print("Hour and minute:", get_current_datetime("%H:%M"))
try:
    get_current_datetime("")
except ValueError as error:
    print("Empty format ->", f"ValueError: {error}")

# --- Part 2: Claude uses it ------------------------------------------------
# The schema tells Claude the tool's name, what it does and its input (lesson 4.4).
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
QUESTION = "What time is it right now? Answer in one short sentence."

print("\n=== Part 2a: no tool ===")
message = client.messages.create(
    model=model, max_tokens=1000, messages=[{"role": "user", "content": QUESTION}]
)
print("Claude:", text_of(message))

print("\n=== Part 2b: with the get_current_datetime tool ===")
messages = [{"role": "user", "content": QUESTION}]

# Call 1: Claude doesn't answer yet; it replies with a tool request.
message = client.messages.create(
    model=model, max_tokens=1000, messages=messages, tools=[GET_CURRENT_DATETIME_SCHEMA]
)
print("Stop reason:", message.stop_reason)  # "tool_use" = Claude wants a tool run

messages.append({"role": "assistant", "content": message.content})
tool_results = []
for block in message.content:
    if block.type != "tool_use":
        continue
    print(f"Claude asks to run: {block.name}({block.input})")
    # Your app runs the function. On an error, send the message back so Claude can retry.
    try:
        result, is_error = get_current_datetime(**block.input), False
    except ValueError as error:
        result, is_error = str(error), True
    print("App runs it, result:", result)
    tool_results.append(
        {"type": "tool_result", "tool_use_id": block.id, "content": result, "is_error": is_error}
    )

# Call 2: send the result back; now Claude writes the answer.
messages.append({"role": "user", "content": tool_results})
message = client.messages.create(
    model=model, max_tokens=1000, messages=messages, tools=[GET_CURRENT_DATETIME_SCHEMA]
)
print("Claude:", text_of(message))
