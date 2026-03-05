"""Stage 2: OCR on cropped book spine images.

Supports two backends controlled by OCR_BACKEND env var:
- "mlx" (default): PaddleOCR-VL via MLX OCR server (high quality, Apple Silicon)
- "easyocr": EasyOCR on CPU (fallback, lower quality)
"""

import base64
import io
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image, ImageEnhance, ImageOps

log = logging.getLogger("pipeline.ocr")

MIN_HEIGHT_PX = 100
CONTRAST_FACTOR = 1.5
CONFIDENCE_THRESHOLD = 0.15


def _get_ocr_backend() -> str:
    return os.environ.get("OCR_BACKEND", "mlx")


# --- MLX OCR Server backend ---

def _ocr_single_crop_mlx(crop_b64: str, index: int) -> dict:
    """OCR via MLX OCR server (PaddleOCR-VL)."""
    server_url = os.environ["MLX_OCR_URL"]
    resp = requests.post(
        f"{server_url}/ocr",
        json={"image_b64": crop_b64},
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.json()["text"]

    log.info("  [%d] MLX OCR -> '%s'", index,
             text[:80] + ("..." if len(text) > 80 else ""))

    return {
        "index": index,
        "ocr_text": text,
        "ocr_regions": [],
    }


# --- EasyOCR backend ---

_reader = None


def _get_reader():
    """Get or initialize the EasyOCR reader (singleton, CPU-only)."""
    global _reader
    if _reader is None:
        import easyocr
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


def _ocr_single_crop_easyocr(crop_b64: str, index: int) -> dict:
    """Run EasyOCR on a single base64-encoded crop image, trying both orientations."""
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


# --- Public API ---

def ocr_crops(crops: list[dict], max_workers: int = 4) -> list[dict]:
    """Run OCR on all cropped spine images.

    Each crop dict must have 'index' and 'crop_b64' keys.
    Returns list of dicts with 'index', 'ocr_text', and 'ocr_regions'.
    """
    backend = _get_ocr_backend()
    log.info("Running OCR on %d crops (backend=%s, max_workers=%d)",
             len(crops), backend, max_workers)

    if backend == "mlx":
        ocr_fn = _ocr_single_crop_mlx
    elif backend == "easyocr":
        # Ensure reader is initialized before threading
        _get_reader()
        ocr_fn = _ocr_single_crop_easyocr
    else:
        raise ValueError(f"Unknown OCR_BACKEND: {backend}")

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for crop in crops:
            future = executor.submit(ocr_fn, crop["crop_b64"], crop["index"])
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
                    result = ocr_fn(retry_crop["crop_b64"], idx)
                    results.append(result)
                except Exception:
                    log.error("  [%d] OCR failed on retry", idx)
                    raise

    results.sort(key=lambda r: r["index"])
    log.info("OCR complete: %d/%d crops processed", len(results), len(crops))
    return results
