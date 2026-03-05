"""Stage 2: OCR on cropped book spine images using EasyOCR."""

import base64
import io
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import easyocr
from PIL import Image, ImageEnhance, ImageOps

log = logging.getLogger("pipeline.ocr")

# Lazy-initialized singleton reader
_reader: easyocr.Reader | None = None

MIN_HEIGHT_PX = 100
CONTRAST_FACTOR = 1.5
CONFIDENCE_THRESHOLD = 0.15


def _get_reader() -> easyocr.Reader:
    """Get or initialize the EasyOCR reader (singleton, CPU-only)."""
    global _reader
    if _reader is None:
        langs = os.environ.get("OCR_LANGUAGES", "en,es").split(",")
        log.info("Initializing EasyOCR reader (CPU, langs=%s)...", langs)
        _reader = easyocr.Reader(langs, gpu=False)
        log.info("EasyOCR reader ready")
    return _reader


def _preprocess_crop(img: Image.Image) -> Image.Image:
    """Upscale small images, enhance contrast, convert to grayscale."""
    if img.height < MIN_HEIGHT_PX:
        scale = MIN_HEIGHT_PX / img.height
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)

    img = ImageEnhance.Contrast(img).enhance(CONTRAST_FACTOR)
    img = ImageOps.grayscale(img)
    return img


def _pil_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _avg_confidence(results: list) -> float:
    if not results:
        return 0.0
    return sum(c for (_, _, c) in results) / len(results)


def _ocr_single_crop(crop_b64: str, index: int) -> dict:
    """Run OCR on a single base64-encoded crop image, trying both orientations."""
    reader = _get_reader()
    img = Image.open(io.BytesIO(base64.b64decode(crop_b64)))
    img = _preprocess_crop(img)

    # Try normal orientation
    normal_bytes = _pil_to_bytes(img)
    results_normal = reader.readtext(normal_bytes)

    # Try flipped 180 degrees
    img_flipped = img.rotate(180)
    flipped_bytes = _pil_to_bytes(img_flipped)
    results_flipped = reader.readtext(flipped_bytes)

    # Pick orientation with better average confidence
    if _avg_confidence(results_flipped) > _avg_confidence(results_normal):
        results = results_flipped
        orientation = "flipped"
    else:
        results = results_normal
        orientation = "normal"

    # Filter by confidence and combine text
    texts = [text for (_, text, conf) in results if conf >= CONFIDENCE_THRESHOLD]
    combined_text = " ".join(texts).strip()

    log.info("  [%d] OCR %s: %d regions, %d kept -> '%s'",
             index, orientation, len(results), len(texts),
             combined_text[:80] + ("..." if len(combined_text) > 80 else ""))

    return {
        "index": index,
        "ocr_text": combined_text,
        "ocr_regions": [
            {"text": text, "confidence": float(conf)}
            for (_, text, conf) in results
        ],
    }


def ocr_crops(crops: list[dict], max_workers: int = 4) -> list[dict]:
    """Run OCR on all cropped spine images.

    Each crop dict must have 'index' and 'crop_b64' keys.
    Returns list of dicts with 'index', 'ocr_text', and 'ocr_regions'.
    """
    log.info("Running OCR on %d crops (max_workers=%d)", len(crops), max_workers)

    # Ensure reader is initialized before threading
    _get_reader()

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for crop in crops:
            future = executor.submit(
                _ocr_single_crop,
                crop["crop_b64"],
                crop["index"],
            )
            futures[future] = crop["index"]

        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
                results.append(result)
            except Exception:
                log.warning("  [%d] OCR failed, retrying once...", idx)
                retry_crop = next(c for c in crops if c["index"] == idx)
                try:
                    result = _ocr_single_crop(retry_crop["crop_b64"], idx)
                    results.append(result)
                except Exception:
                    log.error("  [%d] OCR failed on retry", idx)
                    raise

    results.sort(key=lambda r: r["index"])
    log.info("OCR complete: %d/%d crops processed", len(results), len(crops))
    return results
