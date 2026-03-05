"""Custom handler for PaddleOCR-VL-1.5 on HuggingFace Inference Endpoints."""

import base64
import io
from typing import Any

import torch
from PIL import Image
from transformers import AutoModelForCausalLM, AutoProcessor


PROMPTS = {
    "ocr": "OCR:",
    "table": "Table Recognition:",
    "formula": "Formula Recognition:",
    "chart": "Chart Recognition:",
    "spotting": "Spotting:",
    "seal": "Seal Recognition:",
}


class EndpointHandler:
    def __init__(self, path: str = ""):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # T4 doesn't support bfloat16 natively, use float16
        dtype = torch.float16 if device == "cuda" else torch.float32

        self.model = (
            AutoModelForCausalLM.from_pretrained(
                path, torch_dtype=dtype, trust_remote_code=True
            )
            .to(device)
            .eval()
        )
        self.processor = AutoProcessor.from_pretrained(path, trust_remote_code=True)

    def __call__(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        inputs_data = data.get("inputs", data)

        # Accept either a single input or a batch
        if isinstance(inputs_data, dict):
            inputs_data = [inputs_data]

        results = []
        for item in inputs_data:
            image_b64 = item.get("image", "")
            task = item.get("task", "ocr")
            max_tokens = item.get("max_new_tokens", 4096)

            image_bytes = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Spotting task upscaling (per official recommendation)
            if task == "spotting":
                orig_w, orig_h = image.size
                if orig_w < 1500 and orig_h < 1500:
                    try:
                        resample = Image.Resampling.LANCZOS
                    except AttributeError:
                        resample = Image.LANCZOS
                    image = image.resize((orig_w * 2, orig_h * 2), resample)

            max_pixels = 2048 * 28 * 28 if task == "spotting" else 1280 * 28 * 28
            prompt = PROMPTS.get(task, "OCR:")

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]

            model_inputs = self.processor.apply_chat_template(
                messages,
                add_generation_prompt=True,
                tokenize=True,
                return_dict=True,
                return_tensors="pt",
                images_kwargs={
                    "size": {
                        "shortest_edge": self.processor.image_processor.min_pixels,
                        "longest_edge": max_pixels,
                    }
                },
            ).to(self.model.device)

            with torch.no_grad():
                outputs = self.model.generate(**model_inputs, max_new_tokens=max_tokens)

            text = self.processor.decode(
                outputs[0][model_inputs["input_ids"].shape[-1] : -1]
            )
            results.append({"text": text})

        return results
