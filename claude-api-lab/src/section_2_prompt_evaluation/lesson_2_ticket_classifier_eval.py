"""Section 2 - Prompt evaluation, own example: score a support-ticket classifier.

Claude must put each ticket in exactly one category: billing, technical or
account. Instead of trying the prompt on one ticket, we run it on a dataset of
tickets with the expected category, grade every answer and compare two
versions of the prompt by their average score.

Flow (lesson 2.2):
  1. Prompts v0, v1 and v2 below, simplest first.
  2. Dataset: ticket_dataset.json (hand-written, with an "expected" label), or
     a generated one from lesson_2_3_generate_ticket_dataset.py.
  3. run_prompt: send each ticket with the prompt, get Claude's answer.
  4. grade: code-based grader (lesson 2.6):
       - format:  is the answer only one of the 3 labels?      10 or 0
       - correct: is it the expected label (ignoring case)?    10 or 0
       score = average of the two
  5. Print the wrong answers and the average score of each prompt version.

What a run shows (claude-opus-5-5 and claude-haiku-4-5): v0 picks the right
category but wraps it in "**Billing** The customer...", so the code grader gives
0; v1 and v2 both score 10. Fix the format first; v2's extra rules only pay
off once the dataset has tickets v1 gets wrong. A code grader only checks the
exact text: to judge a free-text answer by its meaning, use a model grader (2.5).

Run from claude-api-lab/:
  uv run src/section_2_prompt_evaluation/lesson_2_ticket_classifier_eval.py
  uv run src/section_2_prompt_evaluation/lesson_2_ticket_classifier_eval.py <dataset.json>
"""

import json
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from common import client, model, text_of

LABELS = {"billing", "technical", "account"}
HERE = Path(__file__).parent
DATASET = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "ticket_dataset.json"

# --- 1. The prompts to compare, simplest first ------------------------------
# v0: says what to do, but not how to answer.
PROMPT_V0 = "Classify this support ticket as billing, technical or account."

PROMPT_V1 = """\
You are a support ticket classifier.

Classify the user's ticket into exactly one category:
- billing
- technical
- account

Return only the category name."""

# v2: defines each category and says what to do when a ticket fits two.
PROMPT_V2 = """\
You are a support ticket classifier.

Classify the user's ticket into exactly one category:
- billing: charges, refunds, invoices, payment methods, plans and upgrades
- technical: the product doesn't work as expected: errors, crashes, slow pages, broken features
- account: getting into the account or changing it: password, 2FA, email, profile, deletion, security

If a ticket fits more than one, pick what the user needs fixed:
money back or a plan they paid for -> billing; a bug or error message -> technical;
access to or details of their account -> account.

Answer with only the category name in lowercase, no punctuation, no explanation."""


# --- 3. Run one test case ----------------------------------------------------
def run_prompt(system_prompt, ticket):
    message = client.messages.create(
        model=model,
        # Not 20: newer models can think before answering, and thinking counts
        # toward max_tokens. Too low gives an empty answer (stop_reason "max_tokens").
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": ticket}],
    )
    return text_of(message)


# --- 4. Code-based grader ------------------------------------------------------
def grade(output, expected):
    format_score = 10 if output.strip() in LABELS else 0  # only the label, nothing around it
    correct_score = 10 if output.strip().strip(".").lower() == expected else 0
    return {"format": format_score, "correct": correct_score, "score": (format_score + correct_score) / 2}


def run_test_case(system_prompt, case):
    output = run_prompt(system_prompt, case["ticket"])
    return {**case, "output": output, **grade(output, case["expected"])}


def run_eval(system_prompt, dataset):
    # 5 requests at a time: same results as a plain loop, just faster.
    with ThreadPoolExecutor(max_workers=5) as pool:
        return list(pool.map(lambda case: run_test_case(system_prompt, case), dataset))


# --- 5. Compare the versions ---------------------------------------------------
dataset = json.loads(DATASET.read_text())
print(f"Dataset: {DATASET.name}, {len(dataset)} tickets, model {model}\n")

summary = {}
for name, prompt in [("v0", PROMPT_V0), ("v1", PROMPT_V1), ("v2", PROMPT_V2)]:
    results = run_eval(prompt, dataset)
    print(f"=== Prompt {name} ===")
    for r in results:
        if r["score"] < 10:
            print(f"  [{r['score']:>4}] expected {r['expected']:<9} got {r['output'][:40]!r:<42} {r['ticket'][:40]}")
    summary[name] = {
        "average": statistics.mean(r["score"] for r in results),
        "format_ok": sum(r["format"] == 10 for r in results),
        "correct": sum(r["correct"] == 10 for r in results),
    }
    s = summary[name]
    print(f"  Average score {s['average']:.2f} / 10 | format OK {s['format_ok']}/{len(results)}"
          f" | correct {s['correct']}/{len(results)}\n")

# max() returns the first of equal scores, i.e. the simplest prompt that scores best.
best = max(summary, key=lambda n: summary[n]["average"])
print(f"Keep prompt {best}: the simplest one with the best score.")
print("Answers can differ between runs: run again after each change before you decide.")
