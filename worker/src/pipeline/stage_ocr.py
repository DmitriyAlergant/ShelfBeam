"""Stage 2: OCR on cropped book spine images.

Supports four backends controlled by OCR_BACKEND env var:
- "llm": Vision LLM via OpenAI-compatible API (uses OPENAI_API_KEY/OPENAI_BASE_URL + OCR_LLM_MODEL)
- "hf": PaddleOCR-VL via HuggingFace Inference Endpoint (cloud GPU)
- "mlx": PaddleOCR-VL via vllm-mlx OpenAI-compatible server (Apple Silicon, local)
- "easyocr": EasyOCR on CPU (lower quality)
"""

import base64
import io
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image, ImageEnhance, ImageOps

from .utils import create_openai_client, pil_to_base64

log = logging.getLogger("pipeline.ocr")

LLM_OCR_CONCURRENCY = 4
MIN_HEIGHT_PX = 100
CONTRAST_FACTOR = 1.5
CONFIDENCE_THRESHOLD = 0.15
HF_OCR_MAX_TOKENS = 64
HF_OCR_CONCURRENCY = 4
MLX_OCR_CONCURRENCY = 4


def _get_ocr_backend() -> str:
    return os.environ["OCR_BACKEND"]


# --- LLM Vision backend ---

SEPARATOR_HEIGHT = 6
SEPARATOR_COLOR = (255, 0, 0)



def _ocr_single_crop_llm(crop_b64: str, index: int, client, model: str) -> dict:
    """OCR via vision LLM — send both orientations, ask for title + author."""
 
    def _build_dual_orientation_image(crop_b64: str) -> str:
        """Stack the crop and its 180° rotation vertically, separated by a red line."""
        img = Image.open(io.BytesIO(base64.b64decode(crop_b64)))
        flipped = img.rotate(180)

        w = max(img.width, flipped.width)
        h = img.height + SEPARATOR_HEIGHT + flipped.height
        combined = Image.new("RGB", (w, h), SEPARATOR_COLOR)
        combined.paste(img, (0, 0))
        combined.paste(flipped, (0, img.height + SEPARATOR_HEIGHT))

        return pil_to_base64(combined)

    combined_b64 = _build_dual_orientation_image(crop_b64)

    resp = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "This image shows a book spine, in two orientations (normal and flipped), separated by a horizontal red line."
                        "The text may be in any language. "
                        "Identify the book title and author from whichever orientation is readable. "
                        "Reply with ONLY: Title — Author\n"
                        "If you can only read the title, reply with just the title. "
                        "If there appears to be more then one book, reply with the one that appears to be the CENTRAL focus of each part of the image (normal and flipped)"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{combined_b64}"},
                },
            ],
        }],
        max_tokens=128,
    )

    text = resp.choices[0].message.content.strip()
    log.info("  [%d] %s", index, text[:120])

    return {
        "index": index,
        "ocr_text": text,
        "ocr_regions": [],
    }


# --- MLX (vllm-mlx) backend ---

def _ocr_single_crop_mlx(crop_b64: str, index: int) -> dict:
    """OCR via vllm-mlx OpenAI-compatible server (PaddleOCR-VL on Apple Silicon)."""
    server_url = os.environ["MLX_OCR_URL"]
    api_key = os.environ.get("MLX_OCR_API_KEY", "")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": os.environ["MLX_OCR_MODEL"],
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{crop_b64}"}},
                    {"type": "text", "text": "OCR:"},
                ],
            }
        ],
        "max_tokens": 256,
        "stream": False,
    }

    resp = requests.post(
        f"{server_url}/v1/chat/completions",
        json=payload,
        headers=headers,
        timeout=60,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]
    merged = " ".join(text.split())
    log.info("  [%d] %s", index, merged[:120] + ("..." if len(merged) > 120 else ""))

    return {
        "index": index,
        "ocr_text": text,
        "ocr_regions": [],
    }


# --- HuggingFace Endpoint backend ---

def _ocr_single_crop_hf(crop_b64: str, index: int) -> dict:
    """OCR via HuggingFace Inference Endpoint (PaddleOCR-VL)."""
    endpoint_url = os.environ["HF_ENDPOINT_URL"]
    api_key = os.environ["HUGGINGFACE_API_KEY"]
    resp = requests.post(
        endpoint_url,
        json={"image": crop_b64, "task": "ocr", "max_new_tokens": HF_OCR_MAX_TOKENS},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=180,
    )
    resp.raise_for_status()
    text = resp.json()[0]["text"]
    merged = " ".join(text.split())
    log.info("  [%d] %s", index, merged[:120] + ("..." if len(merged) > 120 else ""))

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
        langs = os.environ["OCR_LANGUAGES"].split(",")
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
    log.info("  [%d] %s", index,
             combined_text[:120] + ("..." if len(combined_text) > 120 else "") if combined_text else "(empty)")

    return {
        "index": index,
        "ocr_text": combined_text,
        "ocr_regions": [
            {"text": text, "confidence": float(conf)}
            for (_, text, conf) in results
        ],
    }


# --- Public API ---

def ocr_crops(crops: list[dict]) -> list[dict]:
    """Run OCR on all cropped spine images.

    Each crop dict must have 'index' and 'crop_b64' keys.
    Returns list of dicts with 'index', 'ocr_text', and 'ocr_regions'.
    """
    backend = _get_ocr_backend()
    log.info("Running OCR on %d crops (backend=%s)", len(crops), backend)

    if backend == "llm":
        client = create_openai_client()
        model = os.environ["OCR_LLM_MODEL"]
        ocr_fn = lambda b64, idx: _ocr_single_crop_llm(b64, idx, client, model)
    elif backend == "hf":
        ocr_fn = _ocr_single_crop_hf
    elif backend == "mlx":
        ocr_fn = _ocr_single_crop_mlx
    elif backend == "easyocr":
        _get_reader()
        ocr_fn = _ocr_single_crop_easyocr
    else:
        raise ValueError(f"Unknown OCR_BACKEND: {backend}")

    if backend in ("hf", "llm", "mlx"):
        results = []
        concurrency = {"llm": LLM_OCR_CONCURRENCY, "hf": HF_OCR_CONCURRENCY, "mlx": MLX_OCR_CONCURRENCY}[backend]
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(ocr_fn, c["crop_b64"], c["index"]): c for c in crops}
            for future in as_completed(futures):
                results.append(future.result())
    else:
        results = []
        for crop in crops:
            results.append(ocr_fn(crop["crop_b64"], crop["index"]))

    results.sort(key=lambda r: r["index"])
    log.info("OCR complete: %d/%d crops processed", len(results), len(crops))
    return results
