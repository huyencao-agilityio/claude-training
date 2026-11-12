# claude-api-lab

Runnable Python code for the [Building with the Claude API](https://academy.claude.com/courses/building-with-the-claude-api) course. One `.py` file per lesson, in one folder per course section under `src/`. The notes for each lesson are in [../dojo-ai-training/docs/building-with-the-claude-api.md](../dojo-ai-training/docs/building-with-the-claude-api.md).

## Layout

One folder per course section, named like the sections in the notes. Each lesson file starts with what it does and how to run it.

| File | What it is |
|---|---|
| `src/common.py` | Shared setup: loads `.env`, creates the client, picks the model, `text_of()` reads the answer text |
| **`src/section_1_accessing_claude/`** | **1. Accessing Claude with the API** |
| `lesson_1_3_making_a_request.py` | 1.3: send one message, print the answer and its metadata |
| `lesson_1_4_multi_turn.py` | 1.4: keep the history so Claude remembers the previous turn |
| `lesson_1_5_system_prompts.py` | 1.5: same question without and with a math-tutor system prompt |
| `lesson_1_6_temperature.py` | 1.6: same prompt 4 times at temperature 0.0, 0.5 and 1.0, counts the different answers |
| `lesson_1_7_streaming.py` | 1.7: no streaming vs raw stream events vs `text_stream`, with timings |
| `lesson_1_8_structured_data.py` | 1.8: a person's profile as JSON: from a text (prefill + stop sequence, then structured outputs), then from the name only |
| **`src/section_2_prompt_evaluation/`** | **2. Prompt evaluation**, own example: a support-ticket classifier (billing / technical / account) |
| `ticket_dataset.json` | 21 made-up tickets with the expected category, including tricky ones that fit two categories |
| `lesson_2_3_generate_ticket_dataset.py` | 2.3: Claude writes 12 test tickets with labels (structured outputs), saved to `ticket_dataset_generated.json` |
| `lesson_2_ticket_classifier_eval.py` | 2.2 to 2.6: runs prompts v0, v1, v2 on a dataset, grades each answer by code (format + expected label), prints the misses and the average score |
| **`src/section_4_tool_use/`** | **4. Tool use with Claude** |
| `lesson_4_3_tool_functions.py` | 4.3: the `get_current_datetime` tool on its own (incl. a bad input), then "What time is it?" without the tool vs with it: tool request → app runs it → result back → answer |
| `lesson_4_11_text_edit_tool.py` | 4.11: the built-in text editor tool in a temporary folder: Claude views, edits and creates files; the app runs each command with a path check |
| `lesson_4_10_fine_grained_tool_calling.py` | 4.10: the same tool call streamed two ways: basic tool streaming (bursts, always valid JSON) vs fine-grained beta (chunks as written, check the JSON) |
| `lesson_4_8_multiple_turns.py` | 4.8: helpers (`chat`, `run_tool`, `run_tools`) and `run_conversation()`, a loop that runs tools until Claude stops asking for them (max 5 turns) |
| `pyproject.toml` | Dependencies: `anthropic` SDK and `python-dotenv`; also puts `src/` on the import path so lessons in subfolders can import `common` |
| `uv.lock` | Exact versions uv installs. Commit it, don't edit it by hand |
| `.env.example` | Template for `.env` (your API key) |

## Setup (once)

Needs [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`) and Python 3.10+. Run from the `claude-api-lab/` folder:

```bash
cd claude-api-lab

# 1. Create .venv and install the dependencies from uv.lock (.venv is gitignored)
uv sync

# 2. API key: copy the template, then put your key in .env
cp .env.example .env
```

Get a key at [platform.claude.com](https://platform.claude.com) → API keys. Keep it in `.env` only: `.env` is gitignored, never commit it or paste it in code.

## Run a lesson

```bash
cd claude-api-lab
uv run src/<lesson-file>.py
```

Pick the file from the Layout table above, with its section folder, e.g.:

```bash
uv run src/section_1_accessing_claude/lesson_1_3_making_a_request.py
uv run src/section_2_prompt_evaluation/lesson_2_ticket_classifier_eval.py
```

`uv run` uses `.venv` for you, no need to activate it. Every run calls the real API and costs a few tokens.

To add a library: `uv add <name>` (updates `pyproject.toml` and `uv.lock`).

## Change the model

The default is `claude-opus-5-5`. To use another one, set it in `.env`:

```bash
CLAUDE_MODEL="claude-haiku-5-5"
```

Some lessons use an older model because newer models reject a feature they teach:

| Lesson | Feature | Default model | Change it with |
|---|---|---|---|
| 1.6 | `temperature` | `claude-haiku-4-5` | `TEMPERATURE_MODEL` in `.env` |
| 1.8 part 1 | Assistant prefill | `claude-haiku-4-5` | `PREFILL_MODEL` in `.env` |

## Add a new lesson

1. Create the file in its section folder: `src/section_<N>_<short_section_name>/lesson_<section>_<lesson>_<short_name>.py`, e.g. `src/section_3_prompt_engineering/lesson_3_2_clear_and_direct.py`. Make the folder if it is the first lesson of the section.
2. Start it with `from common import client, model, text_of` (works from any folder under `src/`).
3. Add a row to the Layout table above, under its section.

## Troubleshooting

| Error | Fix |
|---|---|
| `uv: command not found` | Install uv (see Setup), then open a new terminal |
| `ModuleNotFoundError: No module named 'common'` | Run `uv sync` once after pulling: it installs the project so `src/` is on the import path |
| `ModuleNotFoundError: No module named 'anthropic'` | Run the script with `uv run`, not plain `python`; or run `uv sync` again |
| `Could not resolve authentication method` / `401 authentication_error` | `.env` is missing or the key is wrong: check `ANTHROPIC_API_KEY` in `claude-api-lab/.env` |
| `404 not_found_error` on the model | The `CLAUDE_MODEL` name is wrong |
| `429 rate_limit_error` | Too many requests: wait a bit and run again |
