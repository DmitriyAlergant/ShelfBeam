"""Compare PaddleOCR-VL vs EasyOCR on all sample images."""

import base64
import io
import json
import time
import sys

from PIL import Image


def load_crops_from_stage1(json_path: str) -> list[dict]:
    with open(json_path) as f:
        data = json.load(f)
    return [
        {"index": item["index"], "crop_b64": item["crop_b64"]}
        for item in data
        if "crop_b64" in item
    ]


def run_paddleocr_vl(crops, model, processor, config):
    from mlx_vlm import generate
    from mlx_vlm.prompt_utils import apply_chat_template

    prompt_text = "Extract all text visible in this image. Return only the text, nothing else."
    results = []
    total_time = 0

    for crop in crops:
        img = Image.open(io.BytesIO(base64.b64decode(crop["crop_b64"])))
        tmp_path = f"/tmp/paddleocr_crop_{crop['index']}.jpg"
        img.save(tmp_path)

        formatted = apply_chat_template(processor, config, prompt_text, num_images=1)

        t0 = time.time()
        output = generate(model, processor, formatted, [tmp_path], max_tokens=256, verbose=False)
        elapsed = time.time() - t0
        total_time += elapsed

        results.append({
            "index": crop["index"],
            "text": output.text.strip(),
            "time_s": round(elapsed, 2),
        })

    return results, total_time


def run_easyocr(crops):
    from pipeline.stage_ocr import ocr_crops
    t0 = time.time()
    results = ocr_crops(crops)
    elapsed = time.time() - t0
    return results, elapsed


def main():
    samples = [
        "standalone/test-outputs/stage1_one_shelf_example.json",
        "standalone/test-outputs/stage1_adult-books-1-shelf.json",
        "standalone/test-outputs/stage1_kids-books-2-shelves.json",
    ]

    # Load PaddleOCR-VL model once
    print("Loading PaddleOCR-VL model...")
    from mlx_vlm import load
    from mlx_vlm.utils import load_config
    model_name = "mlx-community/PaddleOCR-VL-1.5-bf16"
    model, processor = load(model_name)
    config = load_config(model_name)
    print("Model loaded.\n")

    all_results = {}

    for sample_path in samples:
        name = sample_path.split("stage1_")[1].replace(".json", "")
        crops = load_crops_from_stage1(sample_path)
        # Test on first 5 crops of each sample for speed
        test_crops = crops[:5]
        print(f"=== {name} ({len(crops)} total, testing {len(test_crops)}) ===")

        # PaddleOCR-VL
        print("\n  PaddleOCR-VL:")
        paddle_results, paddle_time = run_paddleocr_vl(test_crops, model, processor, config)
        for r in paddle_results:
            text_preview = r["text"][:80].replace("\n", " | ")
            print(f"    [{r['index']}] ({r['time_s']}s): {text_preview}")
        print(f"    Total: {paddle_time:.1f}s, Avg: {paddle_time/len(test_crops):.2f}s")

        # EasyOCR
        print("\n  EasyOCR:")
        easy_results, easy_time = run_easyocr(test_crops)
        for r in easy_results:
            text_preview = r["ocr_text"][:80]
            print(f"    [{r['index']}]: {text_preview}")
        print(f"    Total: {easy_time:.1f}s, Avg: {easy_time/len(test_crops):.2f}s")

        all_results[name] = {
            "paddleocr_vl": {
                "results": paddle_results,
                "total_time": round(paddle_time, 1),
                "avg_time": round(paddle_time / len(test_crops), 2),
            },
            "easyocr": {
                "results": [{"index": r["index"], "text": r["ocr_text"]} for r in easy_results],
                "total_time": round(easy_time, 1),
                "avg_time": round(easy_time / len(test_crops), 2),
            },
        }
        print()

    out_path = "standalone/test-outputs/ocr_comparison.json"
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"Full comparison saved to {out_path}")


if __name__ == "__main__":
    sys.path.insert(0, "standalone")
    main()
