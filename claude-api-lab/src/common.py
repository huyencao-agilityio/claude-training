"""Shared setup for every lesson: load the key, create the client, read answers."""

import os

from anthropic import Anthropic
from dotenv import load_dotenv

# Reads claude-api-lab/.env (searches up from this file) into the environment.
load_dotenv()

# Anthropic() reads ANTHROPIC_API_KEY from the environment.
client = Anthropic()
model = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")


def text_of(message):
    """Return the text of a response.

    The response content is a list of blocks. Newer models can put a
    "thinking" block before the text, so content[0] is not always the text:
    keep only the "text" blocks.
    """
    if message.stop_reason == "refusal":
        return "[Claude declined this request]"
    return "".join(block.text for block in message.content if block.type == "text")
