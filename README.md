# ShelfBeam

An app helping kids choose books to read from a library bookshelf. Snap a pic of a shelf, AI discovers the books and provides personalized recommendations based on reading history.

**Hackathon project — 2 days. Move fast, look great.**

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- iOS Simulator (Xcode) and/or Expo Go on a physical device

## Running Locally

```bash
# 1. Configure environment
cp .env.example .env

# 2. Fill in Clerk keys, LLM endpoint, Roboflow key, and OCR backend settings

# 3. Start backend services (Postgres, MinIO, Express API, Worker, Landing)
docker compose up

# 4. Start Expo (separate terminal, on host Mac — not in Docker)
./expo.sh
```
- Press `i` for iOS Simulator, `a` for Android Emulator
- Scan QR with Expo Go app on a real device

### Physical Device

When running on a physical device via Expo Go, `localhost` won't reach your Mac. Update `.env`:

```
EXPO_PUBLIC_API_URL=http://<your-mac-local-ip>:3000
```

Then restart Expo (`npx expo start --clear`) so it picks up the new value.

## Pipeline

The worker runs a 4-stage pipeline on each scanned bookshelf image:

1. **Detect** — Roboflow object detection model (`fyp-obb-mnsh3/9`) finds individual book spines
2. **OCR** — Extracts text from each crop. Backends: `hf` (HuggingFace PaddleOCR-VL endpoint, recommended), `llm` (Vision LLM), `mlx` (local PaddleOCR-VL), `easyocr`
3. **Normalize** — LLM cleans up OCR text into structured title/author (`gemini-3-flash-preview`)
4. **Recommend** — LLM generates personalized recommendations based on reader profile (`gpt-5.2`)

All LLM calls go through an OpenAI-compatible proxy (e.g. LiteLLM) configured via `OPENAI_BASE_URL`.

## Testing

```bash
# Backend API tests
cd app-backend && npm test

# Python pipeline tests
cd worker && pytest
```

## Project Structure

```
ShelfBeam/
├── app-mobile/      # Expo + React Native app
├── app-backend/     # Express API + Drizzle ORM (BFF)
├── worker/          # Python pipeline (detect → OCR → normalize → recommend)
├── landing/         # Astro landing page with QR codes
├── designs/         # Screen maps, data model, design guidelines
├── docs/            # Deployment guides
├── docker-compose.yml
└── .env.example
```

## Deployment

Production runs on Railway (not Docker Compose). See [Railway Deployment Guide](./docs/railway-deploy.md).

## Design Docs

- [Screen Map](./designs/screen-map.md)
- [Data Model](./designs/data-model.md)
- [Design Guidelines](./designs/design-guidelines.md)
