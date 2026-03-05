"""Benchmark PaddleOCR-VL-1.5 via MLX-VLM on sample spine crops."""

import base64
import io
import json
import time
import sys

from PIL import Image


def load_crops_from_stage1(json_path: str) -> list[dict]:
    """Load crops from a stage1 detection output JSON."""
    with open(json_path) as f:
        data = json.load(f)
    return [
        {"index": item["index"], "crop_b64": item["crop_b64"]}
        for item in data
        if "crop_b64" in item
    ]


def crop_b64_to_pil(crop_b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(crop_b64)))


def main():
    # Load model
    print("Loading PaddleOCR-VL-1.5-bf16 model...")
    t0 = time.time()

    from mlx_vlm import load, generate
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config

    model_name = "mlx-community/PaddleOCR-VL-1.5-bf16"
    model, processor = load(model_name)
    config = load_config(model_name)

    load_time = time.time() - t0
    print(f"Model loaded in {load_time:.1f}s")

    # Load test crops
    test_file = "standalone/test-outputs/stage1_one_shelf_example.json"
    if len(sys.argv) > 1:
        test_file = sys.argv[1]

    crops = load_crops_from_stage1(test_file)
    print(f"Loaded {len(crops)} crops from {test_file}")

    # Test on first 5 crops to evaluate quality and speed
    num_test = min(8, len(crops))
    print(f"\nTesting on {num_test} crops...")

    prompt = "Extract all text visible in this image. Return only the text, nothing else."

    results = []
    total_time = 0

    for i, crop in enumerate(crops[:num_test]):
        img = crop_b64_to_pil(crop["crop_b64"])

        # Save temp image for mlx-vlm
        tmp_path = f"/tmp/paddleocr_test_crop_{i}.jpg"
        img.save(tmp_path)

        t1 = time.time()

        formatted = apply_chat_template(
            processor, config, prompt, num_images=1
        )
        output = generate(
            model, processor, formatted, [tmp_path],
            max_tokens=256, verbose=False
        )

        elapsed = time.time() - t1
        total_time += elapsed

        text = output.text.strip()
        results.append({
            "index": crop["index"],
            "text": text,
            "time_s": round(elapsed, 2),
        })

        print(f"  [{crop['index']}] ({elapsed:.2f}s): {text[:100]}")

    print(f"\n--- Summary ---")
    print(f"Model load time: {load_time:.1f}s")
    print(f"Avg per crop: {total_time / num_test:.2f}s")
    print(f"Total inference: {total_time:.1f}s for {num_test} crops")

    # Save results
    out_path = "standalone/test-outputs/paddleocr_vl_benchmark.json"
    with open(out_path, "w") as f:
        json.dump({
            "model": model_name,
            "load_time_s": round(load_time, 1),
            "avg_per_crop_s": round(total_time / num_test, 2),
            "total_inference_s": round(total_time, 1),
            "num_crops_tested": num_test,
            "results": results,
        }, f, indent=2)
    print(f"Results saved to {out_path}")


if __name__ == "__main__":
    main()
