# BookBeam

An app helping kids choose books to read from a library bookshelf. Snap a pic of a shelf, AI discovers the books and provides personalized recommendations based on reading history.

**Hackathon project — 2 days. Move fast, look great.**

## How It Works

1. Parent creates an account (Clerk auth), adds reader profiles for their kids
2. Kid (or parent) snaps a photo of a library bookshelf
3. AI pipeline: object detection → OCR → metadata lookup → personalized LLM recommendations
4. Kid picks books → tracks reading history with emoji reactions
5. Future scans get better recommendations based on history

## Tech Stack

| Component | Tech |
|-----------|------|
| Mobile App | Expo Go + React Native |
| Backend (BFF) | Express + Drizzle ORM |
| Auth | Clerk |
| Database | Postgres |
| Processing Pipeline | Python workers |
| LLM | API endpoint (provided) |

## Local Development

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) and/or Android Emulator
- ngrok (for real-device testing)

### Running Locally

```bash
# 1. Start backend services
cp .env.example .env   # fill in required values
docker compose up

# 2. Start Expo (separate terminal, on host Mac — not in Docker)
cd mobile
npx expo start
```

- Press `i` for iOS Simulator, `a` for Android Emulator
- Scan QR with Expo Go app on a real device

### Real Device Testing

```bash
# Expo tunnel (exposes dev server to real devices)
npx expo start --tunnel

# BFF tunnel (separate terminal)
ngrok http 3000
```

Set the ngrok BFF URL in your `.env` / app config so the mobile app can reach the API from a real device.

### Testing

```bash
# BFF API tests
cd bff && npm test

# Python pipeline tests
cd worker && pytest
```

## Project Structure

```
BookBeam/
├── mobile/          # Expo + React Native app
├── bff/             # Express API (Backend for Frontend)
├── worker/          # Python processing pipeline
├── designs/         # Screen maps, data model docs
├── docker-compose.yml
└── .env.example
```

## Design Docs

- [Screen Map](./designs/screen-map.md) — all 11 screens
- [Data Model](./designs/data-model.md) — Postgres schema
