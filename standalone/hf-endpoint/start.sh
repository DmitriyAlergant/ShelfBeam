#!/usr/bin/env bash
set -euo pipefail

# Wake up the HF Inference Endpoint and wait until it's running.
# Reads HF_ENDPOINT_NAME and HUGGINGFACE_API_KEY from .env

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../../.env"

: "${HUGGINGFACE_API_KEY:?Set HUGGINGFACE_API_KEY in .env}"
: "${HF_ENDPOINT_NAME:?Set HF_ENDPOINT_NAME in .env}"

python3 - "$HF_ENDPOINT_NAME" "$HUGGINGFACE_API_KEY" << 'PYEOF'
import sys, time
from huggingface_hub import HfApi

name, token = sys.argv[1], sys.argv[2]
api = HfApi(token=token)

ep = api.get_inference_endpoint(name)
print(f"Endpoint: {ep.name} | Status: {ep.status} | URL: {ep.url}")

if ep.status == "running":
    print("Already running.")
    sys.exit(0)

if ep.status in ("scaledToZero", "paused"):
    print("Resuming endpoint...")
    ep.resume()
elif ep.status == "failed":
    print("Endpoint failed — attempting resume...")
    ep.resume()

for i in range(60):
    ep = api.get_inference_endpoint(name)
    print(f"  [{i * 10}s] {ep.status}")
    if ep.status == "running":
        print(f"\nEndpoint running at {ep.url}")
        sys.exit(0)
    if ep.status == "failed":
        print("\nEndpoint failed to start. Check logs on HF dashboard.")
        sys.exit(1)
    time.sleep(10)

print("\nTimeout waiting for endpoint.")
sys.exit(1)
PYEOF
