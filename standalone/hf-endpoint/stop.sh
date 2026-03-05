#!/usr/bin/env bash
set -euo pipefail

# Pause the HF Inference Endpoint (stops billing, keeps config).
# Reads HF_ENDPOINT_NAME and HUGGINGFACE_API_KEY from .env

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../../.env"

: "${HUGGINGFACE_API_KEY:?Set HUGGINGFACE_API_KEY in .env}"
: "${HF_ENDPOINT_NAME:?Set HF_ENDPOINT_NAME in .env}"

python3 - "$HF_ENDPOINT_NAME" "$HUGGINGFACE_API_KEY" << 'PYEOF'
import sys
from huggingface_hub import HfApi

name, token = sys.argv[1], sys.argv[2]
api = HfApi(token=token)

ep = api.get_inference_endpoint(name)
print(f"Endpoint: {ep.name} | Status: {ep.status}")

if ep.status in ("scaledToZero", "paused"):
    print("Already stopped.")
    sys.exit(0)

print("Pausing endpoint...")
ep.pause()
print("Endpoint paused. No further billing.")
PYEOF
