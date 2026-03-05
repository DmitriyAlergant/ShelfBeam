"""Shared utilities for the BookBeam pipeline."""

import base64
import io
import json
import os

from openai import OpenAI
from PIL import Image


def _parse_llm_json(raw_text: str) -> dict:
    """Strip markdown fences and parse JSON from LLM response."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


def create_openai_client() -> OpenAI:
    """Create an OpenAI client from env vars."""
    return OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ["OPENAI_BASE_URL"],
    )


def load_image_to_pil(source: str, is_base64: bool = False) -> Image.Image:
    """Load an image from a file path or base64 string into a PIL Image."""
    if is_base64:
        data = base64.b64decode(source)
        return Image.open(io.BytesIO(data))
    return Image.open(source)


def pil_to_base64(img: Image.Image, fmt: str = "JPEG") -> str:
    """Convert a PIL Image to a base64-encoded string."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
