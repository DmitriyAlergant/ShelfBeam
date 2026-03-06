"""Stage 3: LLM-based normalization of raw OCR text into structured book metadata."""

import json
import logging
import os

from .utils import create_openai_client, llm_call_with_json_retry

log = logging.getLogger("pipeline.normalize")

BATCH_SIZE = int(os.environ["NORMALIZATION_BATCH_SIZE"])

NORMALIZE_PROMPT = """\
You are a book identification assistant. Given raw OCR text extracted from book spines, \
identify the book title and author for each entry.

The OCR text may be garbled, misspelled, contain library catalog numbers (like "796"), \
have fragments from adjacent books, or include non-text artifacts. Do your best to \
identify the actual book title and author from the noisy text.

Rules:
- Return a JSON array of books. 
- Each object must have: "index" (integer, from input), "title" (string), "author" (string or null).
- If you cannot identify any book from the OCR text, set title to null and author to null.
- Do NOT invent books. Only identify books you're reasonably confident about from the OCR clues.
- Strip catalog numbers, library codes, and other non-book metadata.
- Respond with ONLY the JSON array, no other text.
- YOU CAN DEDUPLICATE. If entry had same book multiple times, return in only one (first index).
- YOU CAN SPLIT BOOKS. If entry clearnly referred to two different books known to you, you can return them separately, link to the same index.
- COLLAPSE SERIES. If there are 3 or more entries for a well-known book series (not just different titles from the same author), return only first book in the series.

Input entries:
{entries_json}
"""


def normalize_books(ocr_results: list[dict], openai_client=None, model: str | None = None, progress_callback=None) -> list[dict]:
    """Normalize raw OCR results into structured {title, author} via LLM.

    Processes in batches of up to BATCH_SIZE books per LLM call.
    """
    if openai_client is None:
        openai_client = create_openai_client()
    if model is None:
        model = os.environ["NORMALIZATION_MODEL"]

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
    total_entries = len(entries_with_text)
    for batch_start in range(0, total_entries, BATCH_SIZE):
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
            })

        if progress_callback and total_entries > 0:
            done = min(batch_start + len(batch), total_entries)
            progress_callback(done, total_entries)

    # Post-process: assign unique indices for split entries (multiple books from one OCR slot).
    # Every entry gets a `detection_index` pointing back to the original detection for crop/OBB.
    seen_indices: dict[int, int] = {}  # original index -> count
    next_index = max((r["index"] for r in all_results), default=-1) + 1
    final_results = []
    for r in sorted(all_results, key=lambda x: x["index"]):
        orig_idx = r["index"]
        count = seen_indices.get(orig_idx, 0)
        seen_indices[orig_idx] = count + 1
        if count == 0:
            # First (or only) entry for this detection — keep original index
            final_results.append({**r, "detection_index": orig_idx})
        else:
            # Split: assign a new unique index, link back via detection_index
            log.info("Split detected: index %d has multiple books, assigning new index %d", orig_idx, next_index)
            final_results.append({**r, "index": next_index, "detection_index": orig_idx})
            next_index += 1

    identified = sum(1 for r in final_results if r["title"])
    log.info("Normalization complete: %d/%d books identified", identified, len(final_results))
    return final_results
