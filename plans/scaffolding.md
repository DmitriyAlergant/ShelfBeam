# Plan: BookBeam Scaffolding with Auth & Initial Screens

## Context
BookBeam is a greenfield hackathon app — no source code exists yet. We need to stand up the full project skeleton: Expo frontend with Clerk auth, Express backend with Drizzle ORM, and Docker Compose for local dev. The goal is a working auth flow and navigable screen structure.

## 1. Expo Frontend App (`/app-mobile/`)

### Setup
- `npx create-expo-app` with TypeScript template
- Install dependencies: `@clerk/clerk-expo`, `expo-router`, `expo-secure-store`, `react-native-screens`, `react-native-safe-area-context`
- Configure `app.json` with scheme for deep linking

### Auth (Clerk)
- `ClerkProvider` wrapping the app in `_layout.tsx`
- Token cache using `expo-secure-store`
- Auth gate: redirect unauthenticated users to sign-in
- Sign-in / Sign-up screens using Clerk's `useSignIn` / `useSignUp` hooks (simple email+password or OAuth for hackathon)

### Navigation (expo-router file-based)
```
app/
  _layout.tsx          → ClerkProvider + root layout
  (auth)/
    _layout.tsx        → Stack for auth screens
    sign-in.tsx        → Sign in screen
    sign-up.tsx        → Sign up screen
  (main)/
    _layout.tsx        → Auth guard + check for active profile
    profile-picker.tsx → "Who's Reading?" screen
    (tabs)/
      _layout.tsx      → Bottom tab navigator
      index.tsx        → Scan Home (Tab 1)
      books.tsx        → My Books (Tab 2)
      profile.tsx      → Profile (Tab 3)
```

### Initial Screens (placeholder UI, styled nicely)
- **Welcome/Sign-In**: Clerk-managed auth with BookBeam branding
- **Profile Picker**: "Who's Reading?" with avatar cards + "Add New" button (placeholder data)
- **Tab screens**: Minimal placeholder content with proper tab icons

## 2. Express Backend (`/app-backend/`)

### Setup
- Express + TypeScript
- Drizzle ORM + `drizzle-kit` for migrations
- `pg` driver for PostgreSQL
- Clerk middleware for JWT verification (`@clerk/express`)

### Schema (Drizzle)
- All tables from `designs/data-model.md`: `app_user`, `reader_profile`, `book`, `scan`, `book_history_entry`
- Generate initial migration

### Initial Routes
- `POST /api/users/sync` — create/find app_user from Clerk session (called on first login)
- `GET /api/profiles` — list reader profiles for current user
- `POST /api/profiles` — create reader profile
- Health check endpoint

### Env Vars
- All required, no defaults (per AGENTS.md rules)
- `DATABASE_URL`, `CLERK_SECRET_KEY`, `PORT`

## 3. Docker Compose (`docker-compose.yml`)

- **postgres**: PostgreSQL 16, volume-mounted data
- **app-backend**: Express app, mounts `./app-backend` for hot reload, depends on postgres
- **Expo runs locally** (Expo Go on phone/simulator — not containerized)

## 4. Config Files
- `.env.example` with all required vars documented
- Root `package.json` with workspace scripts if needed
- `.gitignore` updates for node_modules, expo, etc.

## Verification
1. `docker compose up` → Postgres + Express server start
2. `cd app-mobile && npx expo start` → Expo dev server
3. Open in Expo Go → Clerk sign-in screen appears
4. Sign in → Profile Picker screen shows
5. Backend health check: `curl http://localhost:3000/api/health`
6. Backend user sync: authenticated request creates user record
