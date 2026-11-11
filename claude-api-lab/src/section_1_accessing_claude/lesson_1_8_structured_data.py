"""Lesson 1.8 - Structured data: get clean JSON out of Claude, with no extra text.

Gets a person's profile (name, birth year, address, current company,
experience) as JSON, in three ways:

Part 1: the course technique - prefill the assistant turn with ```json and stop
        at the closing ```. Newer models (e.g. claude-opus-5-5) reject prefill
        ("does not support assistant message prefill"), so this part uses
        PREFILL_MODEL, default claude-haiku-4-5.
Part 2: structured outputs - send a JSON schema in output_config; the API
        guarantees the answer matches it. Works on the default model.
Part 3: same schema, but the prompt gives only the name, no text: Claude
        answers from its own knowledge (no web search), so it adds facts
        the text doesn't have.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_8_structured_data.py
"""

import json
import os

from common import client, model, text_of

PREFILL_MODEL = os.getenv("PREFILL_MODEL", "claude-haiku-4-5")

TEXT = """\
Sundar Pichai (Pichai Sundararajan), born on June 10, 1972, in Chennai, India, is the Chief Executive Officer (CEO) of Google and its parent company, Alphabet Inc. After earning his metallurgical engineering degree from IIT Kharagpur, he moved to the United States to complete his Master's at Stanford University and an MBA from the Wharton School. He joined Google in 2004, where he successfully led the development of core products like Google Chrome and Android before being named CEO of Google in 2015 and later taking the helm of Alphabet in 2019.

If you want to focus on a specific aspect of his life, let me know if you need information about:
- His childhood and early life in India
- His management style and major achievements at Google
- His leadership role in Artificial Intelligence (AI) development
I can rewrite the paragraph to highlight exactly what you need.
"""

INSTRUCTIONS = f"""\
Extract the person's profile from the text below as JSON with these keys:
- name: full name (string)
- birth_year: year of birth (integer)
- address: where the person is from, as written in the text (string)
- current_company: list of {{"company", "role"}} the person works for now
- experience: list of {{"company", "role", "start_year", "end_year"}}, one entry per
  role held, oldest first; end_year is null if the role is current
Use only facts stated in the text. Use null for anything the text doesn't say.

<text>
{TEXT}
</text>"""


def chat(messages, system=None, temperature=1.0, stop_sequences=None, model_name=model):
    """Send the history and return the answer text. Optional params are only sent when set."""
    params = {"model": model_name, "max_tokens": 1000, "messages": messages}
    if system:
        params["system"] = system
    if temperature != 1.0:
        params["temperature"] = temperature
    if stop_sequences:
        params["stop_sequences"] = stop_sequences
    return text_of(client.messages.create(**params))


# --- Part 1: prefill + stop sequence (course technique) -------------------
print(f"=== Part 1: prefill ```json + stop at ``` ({PREFILL_MODEL}) ===")
messages = [
    {"role": "user", "content": INSTRUCTIONS},
    {"role": "assistant", "content": "```json"},  # Claude thinks it already opened a JSON block
]
raw = chat(messages, stop_sequences=["```"], model_name=PREFILL_MODEL)  # stops before closing it
print("Raw text:", repr(raw[:60]), "...")  # only JSON, plus some newlines
profile = json.loads(raw.strip())
print(json.dumps(profile, indent=2))

# --- Part 2: structured outputs with a JSON schema ------------------------
JOB = {
    "type": "object",
    "properties": {"company": {"type": "string"}, "role": {"type": "string"}},
    "required": ["company", "role"],
    "additionalProperties": False,
}
NULLABLE_YEAR = {"anyOf": [{"type": "integer"}, {"type": "null"}]}
SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "birth_year": NULLABLE_YEAR,
        "address": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "current_company": {"type": "array", "items": JOB},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "company": {"type": "string"},
                    "role": {"type": "string"},
                    "start_year": NULLABLE_YEAR,
                    "end_year": NULLABLE_YEAR,
                },
                "required": ["company", "role", "start_year", "end_year"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["name", "birth_year", "address", "current_company", "experience"],
    "additionalProperties": False,
}

print(f"\n=== Part 2: structured outputs with a JSON schema ({model}) ===")
message = client.messages.create(
    model=model,
    max_tokens=1000,
    messages=[{"role": "user", "content": INSTRUCTIONS}],
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
)
profile = json.loads(text_of(message))  # always valid JSON that matches SCHEMA
print(json.dumps(profile, indent=2))

# --- Part 3: no text, only a name: Claude answers from what it learned -----
# Claude doesn't search the web here: it uses its training data. So it can add
# facts the text above doesn't have (e.g. jobs before Google), and they can be
# out of date or wrong. Check them before you rely on them.
KNOWLEDGE_PROMPT = """\
Generate information about Sundar Pichai as JSON with these keys:
name, birth_year, address (where he is from), current_company (list of company + role),
experience (every job he has held, oldest first: company, role, start_year, end_year;
end_year is null if the role is current). Use null for anything you don't know."""

print(f"\n=== Part 3: only a name, no text - from Claude's own knowledge ({model}) ===")
message = client.messages.create(
    model=model,
    max_tokens=4000,  # longer answer: 1000 cut it off mid-JSON
    messages=[{"role": "user", "content": KNOWLEDGE_PROMPT}],
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
)
# A cut-off answer is broken JSON, even with a schema: check before parsing.
if message.stop_reason == "max_tokens":
    raise SystemExit("Answer cut off by max_tokens: raise it and run again")
print(json.dumps(json.loads(text_of(message)), indent=2))
