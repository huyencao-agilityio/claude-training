"""Lesson 1.6 - Temperature: compare how predictable or varied answers are.

Sends the same prompt several times at temperature 0.0, 0.5 and 1.0, then
counts how many different answers each value gave.

Newer models (e.g. claude-opus-5-5) reject `temperature` with a 400 error
("temperature is deprecated for this model"), so this lesson uses its own
model. Override it with TEMPERATURE_MODEL in .env.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_6_temperature.py
"""

import os

from common import client, text_of

MODEL = os.getenv("TEMPERATURE_MODEL", "claude-haiku-4-5")
PROMPT = "Give me one movie idea in a single sentence. Reply with the sentence only."
TEMPERATURES = [0.0, 0.5, 1.0]
RUNS = 4


def chat(messages, system=None, temperature=1.0):
    """Send the history and return the answer, at the given temperature (0.0 to 1.0)."""
    params = {
        "model": MODEL,
        "max_tokens": 200,
        "messages": messages,
        "temperature": temperature,
    }
    if system:
        params["system"] = system
    return text_of(client.messages.create(**params)).strip()


print(f"Model: {MODEL}")
print(f"Prompt: {PROMPT}")

summary = []
for temperature in TEMPERATURES:
    print(f"\n=== temperature={temperature} ({RUNS} runs) ===")
    answers = []
    for run in range(1, RUNS + 1):
        answer = chat([{"role": "user", "content": PROMPT}], temperature=temperature)
        answers.append(answer)
        print(f"{run}. {answer}")
    summary.append((temperature, len(set(answers))))

print("\n=== Summary: different answers out of", RUNS, "===")
for temperature, distinct in summary:
    print(f"temperature={temperature}: {distinct} / {RUNS}")
print("Low temperature -> same or near-same answers. High -> more variety (not guaranteed).")
