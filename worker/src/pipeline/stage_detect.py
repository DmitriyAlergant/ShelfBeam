"""Stage 1: Book detection via Roboflow open-shelves model + Pillow cropping."""

import base64
import io
import json
import logging
import os

import numpy as np
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
    data = resp.json()
    log.debug("Roboflow raw response: %s", json.dumps(data, indent=2))
    return data.get("predictions", [])


def _min_area_rect(points: list[dict]) -> tuple[np.ndarray, float, tuple[float, float]]:
    """Compute minimum-area rotated rectangle from polygon points.

    Returns (4 corner points, angle in degrees, (width, height)).
    Uses rotating calipers on the convex hull.
    """
    pts = np.array([[p["x"], p["y"]] for p in points], dtype=np.float64)
    # Convex hull
    from functools import reduce
    # Graham scan - sort by angle from centroid
    hull_indices = _convex_hull(pts)
    hull = pts[hull_indices]

    min_area = float("inf")
    best_rect = None
    best_angle = 0.0
    best_size = (0.0, 0.0)

    n = len(hull)
    for i in range(n):
        # Edge vector
        edge = hull[(i + 1) % n] - hull[i]
        angle = np.arctan2(edge[1], edge[0])

        cos_a, sin_a = np.cos(-angle), np.sin(-angle)
        rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        rotated = hull @ rot.T

        min_xy = rotated.min(axis=0)
        max_xy = rotated.max(axis=0)
        size = max_xy - min_xy
        area = size[0] * size[1]

        if area < min_area:
            min_area = area
            best_angle = np.degrees(angle)
            best_size = (size[0], size[1])
            # Corners in rotated space, then back to original
            corners_rot = np.array([
                [min_xy[0], min_xy[1]],
                [max_xy[0], min_xy[1]],
                [max_xy[0], max_xy[1]],
                [min_xy[0], max_xy[1]],
            ])
            inv_rot = np.array([[cos_a, sin_a], [-sin_a, cos_a]])
            best_rect = corners_rot @ inv_rot.T

    return best_rect, best_angle, best_size


def _convex_hull(points: np.ndarray) -> list[int]:
    """Andrew's monotone chain convex hull. Returns indices in CCW order."""
    n = len(points)
    if n <= 2:
        return list(range(n))

    indices = np.lexsort((points[:, 1], points[:, 0]))

    def cross(o, a, b):
        return (points[a][0] - points[o][0]) * (points[b][1] - points[o][1]) - \
               (points[a][1] - points[o][1]) * (points[b][0] - points[o][0])

    lower = []
    for idx in indices:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], idx) <= 0:
            lower.pop()
        lower.append(idx)

    upper = []
    for idx in reversed(indices):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], idx) <= 0:
            upper.pop()
        upper.append(idx)

    return lower[:-1] + upper[:-1]


def _crop_and_rotate(img: Image.Image, pred: dict) -> Image.Image:
    """Crop a single detection using segmentation polygon if available, else bbox."""
    points = pred.get("points")

    if points and len(points) >= 3:
        return _crop_polygon(img, points)

    # Fallback to axis-aligned bbox
    x, y = pred["x"], pred["y"]
    w, h = pred["width"], pred["height"]
    crop = img.crop((x - w / 2, y - h / 2, x + w / 2, y + h / 2))
    if crop.height > crop.width:
        crop = crop.rotate(90, expand=True)
    return crop


def _order_rect_corners(corners: np.ndarray) -> np.ndarray:
    """Reorder 4 corners to consistent TL, TR, BR, BL (clockwise from top-left).

    This ensures the affine transform produces a correctly oriented image
    regardless of which hull edge the min-area-rect algorithm selected.
    """
    # Sort by y (top two vs bottom two)
    ys = corners[:, 1]
    top_idx = np.argsort(ys)[:2]
    bot_idx = np.argsort(ys)[2:]

    # Among the top two, left has smaller x
    top = corners[top_idx]
    if top[0, 0] > top[1, 0]:
        top = top[::-1]
    tl, tr = top[0], top[1]

    # Among the bottom two, right has larger x
    bot = corners[bot_idx]
    if bot[0, 0] < bot[1, 0]:
        bot = bot[::-1]
    br, bl = bot[0], bot[1]

    return np.array([tl, tr, br, bl])


def _crop_polygon(img: Image.Image, points: list[dict]) -> Image.Image:
    """Crop using minimum-area rotated rectangle from segmentation polygon."""
    rect_corners, angle, (rect_w, rect_h) = _min_area_rect(points)

    # Reorder corners to TL, TR, BR, BL based on image-space positions
    corners = _order_rect_corners(rect_corners)
    tl, tr, br, bl = corners

    # Compute destination dimensions from actual corner distances
    dst_w = int(round(np.linalg.norm(tr - tl)))
    dst_h = int(round(np.linalg.norm(bl - tl)))
    if dst_w < 1 or dst_h < 1:
        # Degenerate — fall back to bbox
        pts_arr = np.array([[p["x"], p["y"]] for p in points])
        mn, mx = pts_arr.min(axis=0), pts_arr.max(axis=0)
        crop = img.crop((mn[0], mn[1], mx[0], mx[1]))
        if crop.height > crop.width:
            crop = crop.rotate(90, expand=True)
        return crop

    # Affine: map 3 source corners (TL, TR, BL) to destination
    src_pts = np.array([tl, tr, bl], dtype=np.float64)
    dst_pts = np.array([[0, 0], [dst_w, 0], [0, dst_h]], dtype=np.float64)

    # PIL's AFFINE transform maps destination->source coordinates
    # Solve for: src = A * dst  (i.e., given dst pixel, where to sample in src)
    A = np.column_stack([dst_pts, [1, 1, 1]])
    coeffs_x = np.linalg.solve(A, src_pts[:, 0])
    coeffs_y = np.linalg.solve(A, src_pts[:, 1])

    crop = img.transform(
        (dst_w, dst_h),
        Image.AFFINE,
        (coeffs_x[0], coeffs_x[1], coeffs_x[2],
         coeffs_y[0], coeffs_y[1], coeffs_y[2]),
        resample=Image.BICUBIC,
    )

    # Rotate vertical spines so text reads horizontally
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

        # Oriented bounding box from polygon, or axis-aligned bbox as fallback
        points = pred.get("points")
        if points and len(points) >= 3:
            rect_corners, _, _ = _min_area_rect(points)
            corners = _order_rect_corners(rect_corners)
            obb = [[round(float(c[0])), round(float(c[1]))] for c in corners]
        else:
            x, y = pred["x"], pred["y"]
            w, h = pred["width"], pred["height"]
            obb = [
                [round(x - w / 2), round(y - h / 2)],
                [round(x + w / 2), round(y - h / 2)],
                [round(x + w / 2), round(y + h / 2)],
                [round(x - w / 2), round(y + h / 2)],
            ]

        results.append({
            "index": i,
            "obb": obb,
            "confidence": pred["confidence"],
            "crop_b64": crop_b64,
        })

    log.info("Cropped %d book spines", len(results))
    return results
