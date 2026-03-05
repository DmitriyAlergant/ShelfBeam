"""FastAPI server for PaddleOCR-VL-1.5 inference on HuggingFace Inference Endpoints."""

import base64
import io
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field
from transformers import AutoModelForImageTextToText, AutoProcessor

MODEL_ID = "/repository"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

PROMPTS = {
    "ocr": "OCR:",
    "table": "Table Recognition:",
    "formula": "Formula Recognition:",
    "chart": "Chart Recognition:",
    "spotting": "Spotting:",
    "seal": "Seal Recognition:",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelManager:
    def __init__(self):
        self.model: Optional[AutoModelForImageTextToText] = None
        self.processor: Optional[AutoProcessor] = None

    async def load(self):
        if self.model is not None:
            return
        start = time.perf_counter()
        logger.info(f"Loading model from {MODEL_ID} on {DEVICE} with {DTYPE}")
        self.processor = AutoProcessor.from_pretrained(MODEL_ID)
        self.model = (
            AutoModelForImageTextToText.from_pretrained(
                MODEL_ID, dtype=DTYPE
            )
            .to(DEVICE)
            .eval()
        )
        logger.info(f"Model loaded in {(time.perf_counter() - start) * 1000:.0f}ms")

    async def unload(self):
        if self.model is not None:
            self.model.to("cpu")
            del self.model
            self.model = None
        if self.processor is not None:
            del self.processor
            self.processor = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


model_manager = ModelManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await model_manager.load()
    try:
        yield
    finally:
        await model_manager.unload()


app = FastAPI(lifespan=lifespan)


class OCRRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded image")
    task: str = Field("ocr", description="Task: ocr, table, chart, formula, spotting, seal")
    max_new_tokens: int = Field(4096, ge=1, le=8192)


class OCRResponse(BaseModel):
    text: str


@app.get("/health")
def health():
    if model_manager.model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "ok"}


@app.post("/", response_model=list[OCRResponse])
def infer(request: OCRRequest) -> list[OCRResponse]:
    if model_manager.model is None or model_manager.processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    image_bytes = base64.b64decode(request.image)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    if request.task == "spotting":
        orig_w, orig_h = image.size
        if orig_w < 1500 and orig_h < 1500:
            image = image.resize((orig_w * 2, orig_h * 2), Image.Resampling.LANCZOS)

    max_pixels = 2048 * 28 * 28 if request.task == "spotting" else 1280 * 28 * 28
    prompt = PROMPTS.get(request.task, "OCR:")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    model_inputs = model_manager.processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
        images_kwargs={
            "size": {
                "shortest_edge": model_manager.processor.image_processor.min_pixels,
                "longest_edge": max_pixels,
            }
        },
    ).to(DEVICE)

    start = time.perf_counter()
    with torch.no_grad():
        outputs = model_manager.model.generate(
            **model_inputs, max_new_tokens=request.max_new_tokens
        )
    duration_ms = (time.perf_counter() - start) * 1000

    text = model_manager.processor.decode(
        outputs[0][model_inputs["input_ids"].shape[-1] : -1]
    )
    logger.info(f"OCR task={request.task} duration={duration_ms:.0f}ms len={len(text)}")

    return [OCRResponse(text=text)]
