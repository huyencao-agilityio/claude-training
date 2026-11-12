"""Lesson 4.10 - Fine-grained tool calling: how tool arguments stream.

Part 1: basic tool streaming. The tool's JSON arguments arrive as input_json_delta
        chunks, but the API buffers them: it waits until each top-level key is
        complete and valid, then sends the buffered chunks together.
Part 2: fine-grained tool streaming (beta). The chunks arrive as Claude writes
        them, with no buffering, so the JSON can be incomplete or invalid until
        the end. Your code must check it.

Both parts stream the same tool call, so compare the chunk timings and counts.

Run from claude-api-lab/:  uv run src/section_4_tool_use/lesson_4_10_fine_grained_tool_calling.py
"""

import json
import time

from common import client, model

FINE_GRAINED_BETA = "fine-grained-tool-streaming-2025-05-14"

SAVE_ARTICLE_SCHEMA = {
    "name": "save_article",
    "description": "Saves an article summary with its metadata.",
    "input_schema": {
        "type": "object",
        "properties": {
            "abstract": {"type": "string", "description": "A short summary of the article."},
            "meta": {
                "type": "object",
                "properties": {
                    "word_count": {"type": "integer", "description": "Number of words in the article."},
                    "review": {"type": "string", "description": "A one-sentence review."},
                },
                "required": ["word_count", "review"],
            },
        },
        "required": ["abstract", "meta"],
    },
}
QUESTION = (
    "Save this article: 'Streaming lets an app show Claude's answer as it is written, "
    "instead of waiting for the full reply.' Include the word count and a one-sentence review."
)
MESSAGES = [{"role": "user", "content": QUESTION}]


# --- Part 1: basic tool streaming ------------------------------------------
def basic_stream():
    return client.messages.stream(
        model=model, max_tokens=1000, tools=[SAVE_ARTICLE_SCHEMA], messages=MESSAGES
    )


# --- Part 2: fine-grained tool streaming (beta) ----------------------------
# eager_input_streaming=True asks for this tool's arguments to stream as they are written.
SAVE_ARTICLE_EAGER = {**SAVE_ARTICLE_SCHEMA, "eager_input_streaming": True}


def fine_grained_stream():
    return client.beta.messages.stream(
        model=model,
        max_tokens=1000,
        betas=[FINE_GRAINED_BETA],
        tools=[SAVE_ARTICLE_EAGER],
        messages=MESSAGES,
    )


def show_chunks(open_stream, label):
    """Print each tool-argument chunk with its arrival time. Return the raw JSON text."""
    print(f"\n=== {label} ===")
    chunks = []
    start = time.perf_counter()
    with open_stream() as stream:
        for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "input_json_delta":
                elapsed_ms = (time.perf_counter() - start) * 1000
                chunks.append(event.delta.partial_json)
                print(f"{elapsed_ms:7.0f} ms  {event.delta.partial_json!r}")
        final = stream.get_final_message()
    print(f"Chunks received: {len(chunks)}")
    return "".join(chunks), final


def check_json(raw_json):
    """Fine-grained chunks can be invalid, so check the complete text before using it."""
    try:
        print("Valid JSON:", json.loads(raw_json))
    except json.JSONDecodeError as error:
        print(f"Invalid JSON, not used: {error}")


if __name__ == "__main__":
    raw, _ = show_chunks(basic_stream, "Part 1: basic tool streaming")
    check_json(raw)

    raw, _ = show_chunks(fine_grained_stream, "Part 2: fine-grained tool streaming (beta)")
    check_json(raw)
