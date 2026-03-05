# Multi-Stage Pipeline Refactor

## Context

Currently the worker sends a full shelf photo to GPT-4.1-mini vision in a single call, which does detection + OCR + recommendations all at once. This limits accuracy and control. We're refactoring into a 4-stage pipeline:

1. **Object Detection** — Roboflow `open-shelves/9` model detects book bounding boxes
2. **OCR** — Extract text from each cropped book spine (EasyOCR on CPU preferred, DocTR API as fallback)
3. **Normalize** — Small LLM normalizes garbled OCR into `{title, author}` (one call per book)
4. **Recommend** — Full LLM generates personalized recommendations from all detected books + reader context

Currently operating on `standalone/standalone_pipeline.py`, later when it is ready we will merge with/rfactor with the main "worker".

## New File Structure

```
standalone/
├── pipeline/
│   ├── __init__.py          # Exports run_full_pipeline + individual stage functions
│   ├── utils.py             # _parse_llm_json(), create_openai_client(), load_image_to_pil()
│   ├── stage_detect.py      # Roboflow object detection + Pillow crop
│   ├── stage_ocr.py         # EasyOCR (or DocTR fallback) per crop
│   ├── stage_normalize.py   # LLM normalize OCR text -> {title, author} (1 call per book)
│   ├── stage_recommend.py   # Full LLM recommendations (text-only, no image)
│   └── orchestrator.py      # Chains all 4 stages, accepts status_callback
├── standalone_pipeline.py   # Refactored: imports orchestrator, adds --stage/--input-json CLI flags
```

## Implementation Steps

### Step 1: Detection Stage

[x] Create `worker/src/pipeline/utils.py`
- Move `_parse_llm_json()` here (currently duplicated in main.py + standalone_pipeline.py - refactor)
- `create_openai_client()` — reads `OPENAI_API_KEY`, `OPENAI_BASE_URL` from env
- `load_image_to_pil(source, is_base64=False)` — returns PIL.Image from file path or base64 string

[x] Create `worker/src/pipeline/stage_detect.py`
- `detect_books(image_path_or_b64, is_base64=False) -> list[dict]`
- Uses `InferenceHTTPClient` (from `inference_sdk`) with `ROBOFLOW_API_KEY`
- Model: `open-shelves/9` on `https://serverless.roboflow.com`
- Crops each detection using Pillow: `left = x - w/2, top = y - h/2, right = x + w/2, bottom = y + h/2`
- All detected spines should be rotated left 90 degrees. Or if (IF) you can easily detect the principle longitudal orientation of leaning books and rotate it accordingly. Assume the spines read Top to Bottom (read correct when leaned left)
- Returns: `[{"bbox": {...}, "confidence": float, "crop_b64": str}, ...]`

[x] **Test**: Run standalone `--stage detect` on a sample shelf images from `./sample-images`, save output JSONs, tune parameters if needed.


### Step 2: Benchmark EasyOCR vs Roboflow Doctr
- `pip3 install easyocr` and time init + readtext on a a few sample (detected) spines.
- If init < 30s and per-image < 1s on CPU (assuming relatively narrow 40x240 image, scaled), use EasyOCR as primary OCR
- If too slow, fall back to DocTR HTTP API (`POST https://infer.roboflow.com/doctr/ocr`)
- Test both, compare quality and performance on all detected spines from sample-images
- Decision drives `stage_ocr.py` implementation and `requirements.txt` deps

### Step 3: Detection Stage
[ ] Create `worker/src/pipeline/stage_ocr.py`
- `ocr_crops(crops: list[dict]) -> list[dict]`
- EasyOCR path: `easyocr.Reader(['en'], gpu=False)`, call `readtext()` on each crop
- DocTR path (if EasyOCR too slow): POST to `https://infer.roboflow.com/doctr/ocr?api_key=<key>`
- Combine OCRed text from all detected regions to make one string per spine
- Process each spine in parallel (up to X concurrency), collect results
- 1 retry attempt on failure

[ ] **Test**: Run `--stage ocr --input-json stage1.json`

[ ] Iterate on known samples see what can be improved given the models we have

### Step 4: Normalization Stage

[ ] Create a script
- `normalize_book(ocr_text: str, openai_client, model: str) -> dict`
- One LLM call per up to 10 books using `OCR_NORMALIZE_MODEL` env var which shall be gemini-3.1-flash-lite-preview, or gpt-4.1-mini, or gpt-5-nano.
- Given raw OCR text, return `{"title": str, "author": str|null}`. But in small batches.

[ ]  **Test**: Run `--stage normalize --input-json stage2.json`

[ ] Iterate on known samples see what can be improved. Compare models.

### Step 5: `worker/src/pipeline/stage_recommend.py`
[ ] Create a script
 `recommend_books(normalized_books: list[dict], reader_context: str, reader_comment: str|None) -> dict`
- Uses `RECOMMENDATION_MODEL` env var, text-only (no images). Default to gpt-5.2.
- Prompt includes:
    -   User profile details
    -   User reading history details
    -   Books in the current scan
    -   Reader comment/note/wish for the current scan, if available.
- Returns: `{"recommendations": [...], "recommendation_summary": str}`, up to 5 picks not more

[ ] **Test**: Run `--stage recommend --input-json stage3.json --reader-profile-id <uuid>`


### Step 6: `worker/src/pipeline/orchestrator.py`
[ ] Create a script
- `run_full_pipeline(image_source, reader_context, reader_comment, is_base64=False, status_callback=None) -> dict`
- Calls stages 1→4 in sequence
- `status_callback(stage_name)` — optional hook for progress reporting
- Assembles final result matching existing schema: `{detected_books, recommendations, recommendation_summary}`

[ ] Test end to end

### Step 7: Refactor `standalone_pipeline.py`
- Now a CLI wrapper for the created orchestrator and stages