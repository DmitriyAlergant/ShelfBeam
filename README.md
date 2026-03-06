# ShelfBeam

An app helping kids choose books to read from a library bookshelf. Snap a pic of a shelf, AI discovers the books and provides personalized recommendations based on reading history.

**Hackathon project — 2 days. Move fast, look great.**

## Prerequisites

- macOS with Apple Silicon (M1+)
- Docker & Docker Compose
- Python 3.11+ (for vllm-mlx OCR server on Apple Silicon)
- Node.js 18+
- Expo Go app on a physical device (optional — web emulator works too)

## Running Locally

### 1. Clone and configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

| Variable | Where to get it |
|----------|----------------|
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | Your OpenAI-compatible LLM endpoint (LiteLLM, OpenRouter, or direct OpenAI) |
| `ROBOFLOW_API_KEY` | Sign up at [app.roboflow.com](https://app.roboflow.com), get key from Settings > API |
| `CLERK_SECRET_KEY` / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional — auth bypass is enabled by default (`EXPO_PUBLIC_DEV_AUTH_BYPASS=true`) |

The `.env.example` defaults work for everything else (Postgres, MinIO, admin bypass, etc).

### 2. Start the vllm-mlx OCR server (Apple Silicon)

The pipeline uses PaddleOCR-VL for reading book spines. On Apple Silicon Macs, run it locally via [vllm-mlx](https://github.com/waybarrios/vllm-mlx) which provides an OpenAI-compatible API with continuous batching:

```bash
# Install (one-time)
pip install vllm-mlx

# Start the server (downloads model on first run, ~3GB)
vllm-mlx serve mlx-community/PaddleOCR-VL-1.5-bf16 \
  --port 8091 --host 0.0.0.0 --continuous-batching --max-tokens 256
```

The server loads the model and listens on `http://localhost:8091` with an OpenAI-compatible `/v1/chat/completions` endpoint. Keep this terminal open.

> **Alternative OCR backends:** Set `OCR_BACKEND=hf` in `.env` to use a HuggingFace Inference Endpoint instead (requires `HUGGINGFACE_API_KEY` and `HF_ENDPOINT_URL`). Set `OCR_BACKEND=llm` to use a Vision LLM via the OpenAI-compatible endpoint.

### 3. Start backend services

```bash
docker compose up -d
```

This starts Postgres, MinIO, Express API (port 3000), Python worker, and Astro landing page (port 4321).

### 4. Start the Expo app

```bash
# In a separate terminal (runs on host Mac, not Docker)
./expo.sh
```

- Press `w` for web browser (http://localhost:8081) — enable mobile viewport in DevTools
- Press `i` for iOS Simulator
- Scan QR with Expo Go on a physical device

> **Physical devices:** `localhost` won't reach your Mac. Set `EXPO_PUBLIC_API_URL=http://<your-mac-local-ip>:3000` in `.env` before starting Expo.

## Project Structure

```
ShelfBeam/
├── app-mobile/      # Expo + React Native app
├── app-backend/     # Express API + Drizzle ORM (BFF)
├── worker/          # Python pipeline (detect -> OCR -> normalize -> recommend)
├── landing/         # Astro landing page with QR codes
├── standalone/      # Standalone dev tools (test scripts, HF endpoint scripts)
├── designs/         # Screen maps, data model, design guidelines
├── docs/            # Deployment guides
├── docker-compose.yml
└── .env.example
```

## Deployment

Production runs on Railway (not Docker Compose). See [Railway Deployment Guide](./docs/railway-deploy.md).

## Design Docs

- [Data Model](./designs/data-model.md)
- [Design Guidelines](./designs/design-guidelines.md)
