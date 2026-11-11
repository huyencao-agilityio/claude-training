"""Lesson 1.7 - Response streaming: show the answer while Claude is still writing it.

Part 1: no streaming    - wait for the whole answer, then print it.
Part 2: raw events      - stream=True, print every event Claude sends, in order.
Part 3: text_stream     - the SDK helper: print text as it arrives, then
                          get_final_message() for the complete message.

Watch the timings: with streaming the first words show up long before the end.

Run from claude-api-lab/:  uv run src/section_1_accessing_claude/lesson_1_7_streaming.py
"""

import time

from common import client, model, text_of

PROMPT = "Write a 3 sentence description of a fake database"
messages = [{"role": "user", "content": PROMPT}]

# --- Part 1: no streaming -------------------------------------------------
print("=== Part 1: no streaming ===")
start = time.perf_counter()
message = client.messages.create(model=model, max_tokens=1000, messages=messages)
waited = time.perf_counter() - start
print(f"(screen stays empty for {waited:.1f}s, then everything at once)")
print(text_of(message))

# --- Part 2: raw events with stream=True ----------------------------------
print("\n=== Part 2: raw events (stream=True) ===")
start = time.perf_counter()
stream = client.messages.create(model=model, max_tokens=1000, messages=messages, stream=True)
for event in stream:
    t = time.perf_counter() - start
    detail = ""
    if event.type == "content_block_start":
        detail = f"block type: {event.content_block.type}"
    elif event.type == "content_block_delta" and event.delta.type == "text_delta":
        detail = repr(event.delta.text)
    elif event.type == "content_block_delta":
        detail = f"({event.delta.type})"
    elif event.type == "message_delta":
        detail = f"stop_reason: {event.delta.stop_reason}, output tokens: {event.usage.output_tokens}"
    print(f"{t:5.2f}s  {event.type:<20} {detail}")

# --- Part 3: SDK helper text_stream + get_final_message --------------------
print("\n=== Part 3: text_stream (text only, printed live) ===")
start = time.perf_counter()
first_chunk_at = None
with client.messages.stream(model=model, max_tokens=1000, messages=messages) as stream:
    for text in stream.text_stream:
        if first_chunk_at is None:
            first_chunk_at = time.perf_counter() - start
        print(text, end="", flush=True)  # in a real app: send the chunk to the browser
    final_message = stream.get_final_message()  # the full message, e.g. to save in a database
total = time.perf_counter() - start

print("\n")
print(f"First words after: {first_chunk_at:.1f}s")
print(f"Whole answer after: {total:.1f}s")
print("Final message:", final_message.stop_reason, "/", final_message.usage.output_tokens, "output tokens")
