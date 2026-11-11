"""Lesson 1.3 - Making a request: send one message to Claude and print the answer.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_3_making_a_request.py
"""

from common import client, model, text_of

message = client.messages.create(
    model=model,
    max_tokens=1000,
    messages=[{"role": "user", "content": "What is quantum computing? Answer in one sentence"}],
)

print("Answer:", text_of(message))

# The response also carries metadata, not just the text.
print("Model:", message.model)
print("Stop reason:", message.stop_reason)
print("Tokens in/out:", message.usage.input_tokens, "/", message.usage.output_tokens)
