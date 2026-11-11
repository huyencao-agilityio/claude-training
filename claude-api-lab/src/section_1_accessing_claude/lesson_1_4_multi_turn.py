"""Lesson 1.4 - Multi-turn conversations: Claude is stateless, so we keep the history.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_4_multi_turn.py
"""

from common import client, model, text_of


def add_user_message(messages, text):
    messages.append({"role": "user", "content": text})


def add_assistant_message(messages, text):
    messages.append({"role": "assistant", "content": text})


def chat(messages):
    """Send the whole history and return Claude's answer as text."""
    message = client.messages.create(model=model, max_tokens=1000, messages=messages)
    return text_of(message)


messages = []

# Turn 1
add_user_message(messages, "Define quantum computing in one sentence")
answer = chat(messages)
add_assistant_message(messages, answer)  # forget this and Claude loses its own reply
print("Turn 1:", answer)

# Turn 2: "another sentence" only makes sense because turn 1 is in the history
add_user_message(messages, "Write another sentence")
answer = chat(messages)
add_assistant_message(messages, answer)
print("Turn 2:", answer)

print(f"\nThe history now holds {len(messages)} messages (2 per turn).")
