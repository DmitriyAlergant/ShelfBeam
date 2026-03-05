"""Simple HTTP server wrapping PaddleOCR-VL via MLX-VLM for local OCR inference.

Run: python3 standalone/mlx_ocr_server.py
Endpoint: POST /ocr with JSON body {"image_b64": "<base64 encoded image>"}
Returns: {"text": "extracted text"}

Designed for Apple Silicon Macs. Add to docker compose as a host-network
service or run standalone alongside the worker.
"""

import base64
import io
import json
import logging
import os
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler

from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("mlx-ocr-server")

# Global model state
_model = None
_processor = None
_config = None


def _load_model():
    global _model, _processor, _config
    if _model is not None:
        return

    from mlx_vlm import load
    from mlx_vlm.utils import load_config

    model_name = os.environ["MLX_OCR_MODEL"]
    log.info("Loading model %s ...", model_name)
    _model, _processor = load(model_name, trust_remote_code=True)
    _config = load_config(model_name, trust_remote_code=True)
    log.info("Model loaded.")


def _ocr_image(image_b64: str) -> str:
    from mlx_vlm import generate
    from mlx_vlm.prompt_utils import apply_chat_template

    img = Image.open(io.BytesIO(base64.b64decode(image_b64)))

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        img.save(f, format="JPEG")
        tmp_path = f.name

    try:
        prompt = "Extract all text visible in this image. Return only the text, nothing else."
        formatted = apply_chat_template(_processor, _config, prompt, num_images=1)
        output = generate(
            _model, _processor, formatted, [tmp_path],
            max_tokens=256, verbose=False
        )
        return output.text.strip()
    finally:
        os.unlink(tmp_path)


class OCRHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/ocr":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            image_b64 = body["image_b64"]

            text = _ocr_image(image_b64)

            response = json.dumps({"text": text})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(response.encode())
        except Exception:
            log.exception("OCR request failed")
            error_response = json.dumps({"error": "OCR processing failed"})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(error_response.encode())

    def log_message(self, format, *args):
        log.info(format, *args)


def main():
    _load_model()
    port = int(os.environ["MLX_OCR_PORT"])
    server = HTTPServer(("0.0.0.0", port), OCRHandler)
    log.info("MLX OCR server listening on port %d", port)
    server.serve_forever()


if __name__ == "__main__":
    main()
