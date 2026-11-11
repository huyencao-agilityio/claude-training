"""Lesson 1.5 - System prompts: give Claude a role and rules with the `system` parameter.

Asks the same math question twice, without and with a "patient math tutor"
system prompt, so you can compare the two answers.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_5_system_prompts.py
"""

from common import client, model, text_of

SYSTEM_PROMPT = """
You are a patient math tutor.
Do not directly answer a student's questions.
Guide them to a solution step by step.
"""

QUESTION = "How do I solve 5x + 2 = 3 for x?"


def add_user_message(messages, text):
    messages.append({"role": "user", "content": text})


def add_assistant_message(messages, text):
    messages.append({"role": "assistant", "content": text})


def chat(messages, system=None):
    """Send the history and return Claude's answer.

    `system` is optional. The API rejects system=None, so the key is only
    added when a system prompt is given.
    """
    params = {"model": model, "max_tokens": 1000, "messages": messages}
    if system:
        params["system"] = system
    return text_of(client.messages.create(**params))


# 1. No system prompt: Claude usually solves it right away.
messages = []
add_user_message(messages, QUESTION)
print("=== Without system prompt ===")
print(chat(messages))

# 2. Tutor system prompt: Claude should ask a guiding question instead.
messages = []
add_user_message(messages, QUESTION)
answer = chat(messages, system=SYSTEM_PROMPT)
add_assistant_message(messages, answer)
print("\n=== With tutor system prompt ===")
print(answer)

# 3. The system prompt applies to every turn: pass it again on the next request.
add_user_message(messages, "I'd subtract 2 from both sides?")
print("\n=== Turn 2, student replies ===")
print(chat(messages, system=SYSTEM_PROMPT))
