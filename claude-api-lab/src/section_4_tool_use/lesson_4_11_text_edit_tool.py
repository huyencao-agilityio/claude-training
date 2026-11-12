"""Lesson 4.11 - The text edit tool: Claude asks, your code edits the files.

Part 1: the built-in tool needs only a short stub in the request. Claude sends
        commands (view, str_replace, create, insert); your code does the file work.
Part 2: a loop that runs the text editor commands until Claude gives its answer.

Works in a temporary folder, never in the repo. Every command is checked to
stay inside that folder.

Run from claude-api-lab/:  uv run src/section_4_tool_use/lesson_4_11_text_edit_tool.py
"""

import os
import tempfile

from common import client, model, text_of

MAX_TURNS = 8

# The stub Claude expands into the full text editor tool (lesson text).
# Models of the claude-3 family use other type/name values.
TEXT_EDITOR_STUB = {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"}

SAMPLE_MAIN = "def add(a, b):\n    return a + b\n"
QUESTION = (
    "Open main.py and summarize it. Then add a one-line docstring to add(), "
    "and create test_main.py with a unit test for add()."
)


# --- Part 1: your side of the commands -------------------------------------
def safe_path(sandbox, path):
    """Resolve a path inside the sandbox; refuse anything that leaves it."""
    full = os.path.abspath(os.path.join(sandbox, path))
    if os.path.commonpath([sandbox, full]) != sandbox:
        raise ValueError(f"Path outside the sandbox: {path}")
    return full


def read_lines(full):
    with open(full) as f:
        return f.read().splitlines()


def write_lines(full, lines):
    with open(full, "w") as f:
        f.write("\n".join(lines) + "\n")


def view(full, view_range=None):
    """Show a folder listing, or a file with line numbers (optionally a range)."""
    if os.path.isdir(full):
        return "\n".join(sorted(os.listdir(full)))
    lines = read_lines(full)
    start, end = view_range or [1, len(lines)]
    if end == -1:
        end = len(lines)
    return "\n".join(f"{n}\t{line}" for n, line in enumerate(lines, 1) if start <= n <= end)


def str_replace(full, old_str, new_str):
    """Replace one exact match. Refuse if it is missing or not unique."""
    with open(full) as f:
        text = f.read()
    count = text.count(old_str)
    if count != 1:
        raise ValueError(f"old_str must match exactly once, found {count} matches")
    with open(full, "w") as f:
        f.write(text.replace(old_str, new_str, 1))
    return "Replaced."


def create(full, file_text):
    if os.path.exists(full):
        raise ValueError("File already exists")
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(file_text)
    return "Created."


def insert(full, insert_line, insert_text):
    """Insert text after line insert_line (0 = before the first line)."""
    lines = read_lines(full)
    lines.insert(insert_line, insert_text.rstrip("\n"))
    write_lines(full, lines)
    return "Inserted."


def run_text_edit(sandbox, tool_input):
    """Carry out one text editor command that Claude asked for."""
    command = tool_input["command"]
    full = safe_path(sandbox, tool_input["path"])
    if command == "view":
        return view(full, tool_input.get("view_range"))
    if command == "str_replace":
        return str_replace(full, tool_input["old_str"], tool_input["new_str"])
    if command == "create":
        return create(full, tool_input["file_text"])
    if command == "insert":
        return insert(full, tool_input["insert_line"], tool_input["insert_text"])
    raise ValueError(f"Unknown command: {command}")


def run_tools(sandbox, message):
    """Run every text editor request in the reply; errors go back as results."""
    results = []
    for block in message.content:
        if block.type != "tool_use":
            continue
        print(f"  Claude asks: {block.input}")
        try:
            result, is_error = run_text_edit(sandbox, block.input), False
        except Exception as error:
            result, is_error = f"Error: {error}", True
        print(f"  App result: {result[:200]!r}")
        results.append(
            {"type": "tool_result", "tool_use_id": block.id, "content": result, "is_error": is_error}
        )
    return results


# --- Part 2: the loop ------------------------------------------------------
def run_conversation(sandbox, messages):
    for turn in range(1, MAX_TURNS + 1):
        print(f"\n--- Turn {turn} ---")
        message = client.messages.create(
            model=model, max_tokens=1500, messages=messages, tools=[TEXT_EDITOR_STUB]
        )
        messages.append({"role": "assistant", "content": message.content})
        print("Claude:", text_of(message) or "(no text yet)")
        if message.stop_reason != "tool_use":
            return
        messages.append({"role": "user", "content": run_tools(sandbox, message)})
    raise RuntimeError(f"No final answer after {MAX_TURNS} turns")


if __name__ == "__main__":
    # The folder is deleted when the script ends.
    with tempfile.TemporaryDirectory(prefix="text_edit_lab_") as folder:
        sandbox = os.path.abspath(folder)
        write_lines(os.path.join(sandbox, "main.py"), SAMPLE_MAIN.splitlines())
        print("Sandbox:", sandbox)

        print("\n=== Part 1: one command by hand ===")
        print(run_text_edit(sandbox, {"command": "view", "path": "main.py"}))

        print("\n=== Part 2: Claude edits the files ===")
        history = [{"role": "user", "content": QUESTION}]
        run_conversation(sandbox, history)

        print("\n=== Result ===")
        for name in sorted(os.listdir(sandbox)):
            print(f"--- {name} ---")
            print("\n".join(read_lines(os.path.join(sandbox, name))))
