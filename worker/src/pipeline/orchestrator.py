"""Orchestrator: chains all 4 pipeline stages into a single run_full_pipeline call."""

import logging

from .stage_detect import detect_books
from .stage_normalize import normalize_books
from .stage_ocr import ocr_crops
from .stage_recommend import recommend_books

log = logging.getLogger("pipeline.orchestrator")


def run_full_pipeline(
    image_source: str,
    reader_context: str,
    reader_comment: str | None = None,
    is_base64: bool = False,
    status_callback=None,
) -> dict:
    """Run the full 4-stage pipeline: detect -> OCR -> normalize -> recommend.

    Returns dict with detected_books, recommendations, recommendation_summary.
    """

    def _notify(stage_name: str):
        log.info("Stage: %s", stage_name)
        if status_callback:
            status_callback(stage_name)

    # Stage 1: Detection
    _notify("detect")
    detections = detect_books(image_source, is_base64=is_base64)

    if not detections:
        return {
            "detected_books": [],
            "recommendations": [],
            "recommendation_summary": "I couldn't detect any books on this shelf. Try taking a clearer photo!",
        }

    # Stage 2: OCR
    _notify("ocr")
    ocr_results = ocr_crops(detections)

    # Stage 3: Normalize
    _notify("normalize")
    normalized = normalize_books(ocr_results)

    for n in normalized:
        log.info("  [%d] %s — %s", n["index"], n.get("title"), n.get("author"))

    # Build detected_books list combining detection + normalization data
    detected_books = []
    norm_by_index = {n["index"]: n for n in normalized}
    for det in detections:
        idx = det["index"]
        norm = norm_by_index.get(idx, {})
        detected_books.append({
            "index": idx,
            "title": norm.get("title"),
            "author": norm.get("author"),
            "confidence": det["confidence"],
            "obb": det["obb"],
            "crop_b64": det["crop_b64"],
        })

    # Stage 4: Recommend
    _notify("recommend")
    rec_result = recommend_books(normalized, reader_context, reader_comment)

    # Resolve book_index references to actual book data
    books_by_index = {b["index"]: b for b in detected_books}
    resolved_recommendations = []
    for pick in rec_result.get("recommendations", []):
        book = books_by_index.get(pick.get("book_index"))
        if book and book.get("title"):
            resolved_recommendations.append({
                "book_index": pick["book_index"],
                "rank": pick.get("rank"),
                "title": book["title"],
                "author": book.get("author"),
                "reason": pick.get("comment", ""),
                "obb": book["obb"],
            })

    return {
        "detected_books": detected_books,
        "recommendations": resolved_recommendations,
        "recommendation_summary": rec_result["recommendation_summary"],
    }
