#!/usr/bin/env bash
set -euo pipefail

# Upload PaddleOCR-VL-1.5 fork with custom handler to HuggingFace
# Usage: HF_TOKEN=hf_xxx ./deploy.sh

: "${HF_TOKEN:?Set HF_TOKEN}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_REPO="PaddlePaddle/PaddleOCR-VL-1.5"
DST_REPO="SPGremlin/PaddleOCR-VL-1.5"

python3 - "$SCRIPT_DIR" "$SRC_REPO" "$DST_REPO" "$HF_TOKEN" << 'PYEOF'
import os, sys, shutil
from huggingface_hub import HfApi

script_dir, src, dst, token = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
api = HfApi(token=token)

print(f"Downloading {src}...")
local_dir = api.snapshot_download(src)
print(f"Downloaded to: {local_dir}")

shutil.copy(os.path.join(script_dir, "handler.py"), os.path.join(local_dir, "handler.py"))
shutil.copy(os.path.join(script_dir, "requirements.txt"), os.path.join(local_dir, "requirements.txt"))
print("Added handler.py and requirements.txt")

print(f"Uploading to {dst}...")
api.upload_folder(
    folder_path=local_dir,
    repo_id=dst,
    repo_type="model",
    ignore_patterns=[".cache*"],
)
print(f"Done! https://huggingface.co/{dst}")
PYEOF
