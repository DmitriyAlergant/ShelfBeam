"""ShelfBeam multi-stage pipeline."""

from .orchestrator import run_full_pipeline
from .stage_detect import detect_books
from .stage_normalize import normalize_books
from .stage_ocr import ocr_crops
from .stage_recommend import recommend_books
from .utils import create_openai_client, load_image_to_pil
