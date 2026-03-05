"""Stage 3: LLM-based normalization of raw OCR text into structured book metadata."""

import json
import logging
import os

from .utils import create_openai_client, llm_call_with_json_retry

log = logging.getLogger("pipeline.normalize")

BATCH_SIZE = 10

NORMALIZE_PROMPT = """\
You are a book identification assistant. Given raw OCR text extracted from book spines, \
identify the book title and author for each entry.

The OCR text may be garbled, misspelled, contain library catalog numbers (like "796"), \
have fragments from adjacent books, or include non-text artifacts. Do your best to \
identify the actual book title and author from the noisy text.

Rules:
- Return a JSON array with one object per input entry, in the same order.
- Each object must have: "index" (integer, from input), "title" (string), "author" (string or null), "language" (string, ISO 639-1 two-letter code like "en", "ru", "es", "fr", etc.).
- If you cannot identify any book from the OCR text, set title to null, author to null, and language to null.
- Do NOT invent books. Only identify books you're reasonably confident about from the OCR clues.
- Strip catalog numbers, library codes, and other non-book metadata.
- Respond with ONLY the JSON array, no other text.

Input entries:
{entries_json}
"""


def normalize_books(ocr_results: list[dict], openai_client=None, model: str | None = None) -> list[dict]:
    """Normalize raw OCR results into structured {title, author} via LLM.

    Processes in batches of up to BATCH_SIZE books per LLM call.
    """
    if openai_client is None:
        openai_client = create_openai_client()
    if model is None:
        model = os.environ["OCR_NORMALIZE_MODEL"]

    # Filter out entries with no OCR text
    entries_with_text = [r for r in ocr_results if r.get("ocr_text", "").strip()]
    entries_empty = [r for r in ocr_results if not r.get("ocr_text", "").strip()]

    log.info("Normalizing %d entries (%d empty, skipped), model=%s",
             len(entries_with_text), len(entries_empty), model)

    all_results = []

    # Process empty entries as null
    for entry in entries_empty:
        all_results.append({
            "index": entry["index"],
            "title": None,
            "author": None,
        })

    # Process in batches
    for batch_start in range(0, len(entries_with_text), BATCH_SIZE):
        batch = entries_with_text[batch_start:batch_start + BATCH_SIZE]
        batch_input = [{"index": e["index"], "ocr_text": e["ocr_text"]} for e in batch]

        log.info("  Batch %d-%d (%d entries)...",
                 batch[0]["index"], batch[-1]["index"], len(batch))

        entries_json = json.dumps(batch_input, indent=2, ensure_ascii=False)
        prompt = NORMALIZE_PROMPT.format(entries_json=entries_json)

        parsed = llm_call_with_json_retry(
            openai_client,
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
            temperature=0.1,
        )

        if not isinstance(parsed, list):
            raise ValueError(f"Expected JSON array from LLM, got: {type(parsed)}")

        for item in parsed:
            all_results.append({
                "index": item["index"],
                "title": item.get("title"),
                "author": item.get("author"),
                "language": item.get("language"),
            })

    all_results.sort(key=lambda r: r["index"])
    identified = sum(1 for r in all_results if r["title"])
    log.info("Normalization complete: %d/%d books identified", identified, len(all_results))
    return all_results
