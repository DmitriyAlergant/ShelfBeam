# BookBeam

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

# 2. Fill in Clerk keys and LLM endpoint

# 3. Start backend services (Postgres + Express API)
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

## Testing

```bash
# Backend API tests
cd app-backend && npm test

# Python pipeline tests (when available)
cd worker && pytest
```

## Project Structure

```
BookBeam/
├── app-mobile/      # Expo + React Native app
├── app-backend/     # Express API + Drizzle ORM
├── designs/         # Screen maps, data model, design guidelines
├── docker-compose.yml
└── .env.example
```

## Design Docs

- [Screen Map](./designs/screen-map.md)
- [Data Model](./designs/data-model.md)
- [Design Guidelines](./designs/design-guidelines.md)
