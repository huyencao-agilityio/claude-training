"""Lesson 2.3 - Generating test datasets: let Claude write the test tickets.

Asks Claude for made-up support tickets, each with its expected category,
including tickets that could fit two categories. Uses structured outputs
(lesson 1.8) so the answer is always a valid list, then saves it to
ticket_dataset_generated.json for the eval script.

Run from claude-api-lab/:
  uv run src/section_2_prompt_evaluation/lesson_2_3_generate_ticket_dataset.py
  uv run src/section_2_prompt_evaluation/lesson_2_ticket_classifier_eval.py \\
      src/section_2_prompt_evaluation/ticket_dataset_generated.json
"""

import json
from collections import Counter
from pathlib import Path

from common import client, model, text_of

OUT = Path(__file__).parent / "ticket_dataset_generated.json"

PROMPT = """\
Write 12 made-up customer support tickets for a project-management web app, to test a
ticket classifier. Each ticket has an expected category:
- billing: charges, refunds, invoices, payment methods, plans and upgrades
- technical: errors, crashes, slow pages, broken features
- account: password, 2FA, email, profile, deletion, security

Rules:
- 4 tickets per category.
- Vary the tone and length: short and angry, long and polite, typos, no punctuation.
- Make 3 of them tricky: they mention two categories, and the expected one is what the
  user needs fixed (money back -> billing, a bug -> technical, access to the account -> account).
- Use made-up details only."""

SCHEMA = {
    "type": "object",
    "properties": {
        "cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ticket": {"type": "string"},
                    "expected": {"type": "string", "enum": ["billing", "technical", "account"]},
                },
                "required": ["ticket", "expected"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["cases"],
    "additionalProperties": False,
}

message = client.messages.create(
    model=model,
    max_tokens=4000,
    messages=[{"role": "user", "content": PROMPT}],
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
)
if message.stop_reason == "max_tokens":
    raise SystemExit("Answer cut off by max_tokens: raise it and run again")

cases = json.loads(text_of(message))["cases"]
OUT.write_text(json.dumps(cases, indent=2) + "\n")

print(f"Saved {len(cases)} tickets to {OUT.name}: {dict(Counter(c['expected'] for c in cases))}")
for c in cases:
    print(f"  {c['expected']:<9} {c['ticket'][:80]}")
print("\nRead them before using them: a generated label can be wrong too.")
