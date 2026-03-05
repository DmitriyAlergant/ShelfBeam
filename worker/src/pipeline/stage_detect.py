"""Stage 1: Book detection via Roboflow open-shelves model + Pillow cropping."""

import base64
import io
import logging
import os

import requests
from PIL import Image

from .utils import load_image_to_pil, pil_to_base64

log = logging.getLogger("pipeline.detect")

MODEL_ID = "open-shelves/9"
ROBOFLOW_API_URL = "https://serverless.roboflow.com"
CONFIDENCE_THRESHOLD = 0.4


def _infer_roboflow(image_path_or_b64: str, is_base64: bool = False) -> list[dict]:
    """Call Roboflow serverless inference API and return predictions."""
    api_key = os.environ["ROBOFLOW_API_KEY"]
    url = f"{ROBOFLOW_API_URL}/{MODEL_ID}"
    params = {
        "api_key": api_key,
        "confidence": CONFIDENCE_THRESHOLD,
    }

    if is_base64:
        resp = requests.post(url, params=params, data=image_path_or_b64, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=60)
    else:
        with open(image_path_or_b64, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
        resp = requests.post(url, params=params, data=img_b64, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=60)

    resp.raise_for_status()
    return resp.json().get("predictions", [])


def _crop_and_rotate(img: Image.Image, pred: dict) -> Image.Image:
    """Crop a single detection from the image and rotate for reading."""
    x, y = pred["x"], pred["y"]
    w, h = pred["width"], pred["height"]

    left = x - w / 2
    top = y - h / 2
    right = x + w / 2
    bottom = y + h / 2

    crop = img.crop((left, top, right, bottom))

    # Spines are vertical - rotate left 90 degrees so text reads horizontally
    if crop.height > crop.width:
        crop = crop.rotate(90, expand=True)

    return crop


def detect_books(image_path_or_b64: str, is_base64: bool = False) -> list[dict]:
    """Detect books on a shelf image and return cropped spine images.

    Returns list of dicts with keys: bbox, confidence, crop_b64
    """
    log.info("Running Roboflow detection (model=%s, confidence>=%.2f)", MODEL_ID, CONFIDENCE_THRESHOLD)

    predictions = _infer_roboflow(image_path_or_b64, is_base64=is_base64)
    log.info("Roboflow returned %d predictions", len(predictions))

    img = load_image_to_pil(image_path_or_b64, is_base64=is_base64)

    results = []
    for i, pred in enumerate(predictions):
        crop = _crop_and_rotate(img, pred)
        crop_b64 = pil_to_base64(crop)

        results.append({
            "index": i,
            "bbox": {
                "x": pred["x"],
                "y": pred["y"],
                "width": pred["width"],
                "height": pred["height"],
            },
            "confidence": pred["confidence"],
            "class": pred.get("class", "book"),
            "crop_b64": crop_b64,
        })
        log.info("  [%d] class=%s conf=%.3f size=%dx%d -> crop %dx%d",
                 i, pred.get("class", "book"), pred["confidence"],
                 int(pred["width"]), int(pred["height"]),
                 crop.width, crop.height)

    return results
