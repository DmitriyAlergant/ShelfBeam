# Railway Deployment Guide

## Prerequisites

- Railway account (https://railway.app)
- Railway CLI installed (`brew install railway` or `npm i -g @railway/cli`)
- GitHub repo connected to Railway
- EAS CLI installed (`npm i -g eas-cli`) and logged in (`eas login`)

## 1. Create Railway Project

```bash
railway login
railway init          # create new project
railway link          # link to existing project
```

## 2. Add Services

In the Railway dashboard, create:

1. **Postgres** — add a Postgres plugin. Provides `DATABASE_URL` automatically.
2. **app-backend** — connect to GitHub repo
   - Root directory: `app-backend/`
   - Builder: Dockerfile
3. **worker** — connect to GitHub repo
   - Root directory: `worker/`
   - Builder: Dockerfile

## 3. Configure Environment Variables

Reference template: `.env.railway`

### app-backend

```bash
railway variables set --service app-backend \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  CLERK_SECRET_KEY='sk_...' \
  ADMIN_API_KEY='<generate-random-key>' \
  TEST_USER_ID='<clerk-user-id>' \
  S3_ENDPOINT='${{Bucket.ENDPOINT}}' \
  S3_BUCKET='${{Bucket.BUCKET}}' \
  S3_ACCESS_KEY='${{Bucket.ACCESS_KEY_ID}}' \
  S3_SECRET_KEY='${{Bucket.SECRET_ACCESS_KEY}}' \
  S3_FORCE_PATH_STYLE=false \
  OPENAI_API_KEY='...' \
  OPENAI_BASE_URL='...' \
  PORT=3000
```

`LANDING_QR_URL` is set after EAS setup (step 5).

### worker

```bash
railway variables set --service worker \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  API_BASE_URL='http://app-backend.railway.internal:3000' \
  ADMIN_API_KEY='<same-as-backend>' \
  TEST_USER_ID='<same-as-backend>' \
  OPENAI_API_KEY='...' \
  OPENAI_BASE_URL='...'
```

The worker talks to app-backend via Railway's internal network (`*.railway.internal`).

## 4. Generate Public URL

```bash
railway domain --service app-backend
# Output: https://app-backend-production-XXXX.up.railway.app
```

## 5. EAS Setup (Expo Mobile App)

### First-time project setup

```bash
cd app-mobile
eas login
eas init              # creates project, writes projectId to app.json
eas channel:create preview
```

### Publish to EAS

```bash
cd app-mobile
EXPO_PUBLIC_API_URL=https://app-backend-production-XXXX.up.railway.app \
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
EXPO_PUBLIC_DEV_AUTH_BYPASS=false \
  npx eas update --branch preview --non-interactive --message "initial"
```

The `EXPO_PUBLIC_*` env vars override `.env` values and get baked into the JS bundle at build time.

### Set the QR code landing URL

```bash
railway variables set --service app-backend \
  "LANDING_QR_URL=exp://u.expo.dev/<PROJECT_ID>?channel-name=preview&runtime-version=1.0.0"
```

This URL is stable — new `eas update` publishes are picked up automatically without changing it.

## 6. GitHub Actions CI

The workflow `.github/workflows/eas-update.yml` auto-publishes to EAS on merge to `main` (when `app-mobile/` changes).

Required GitHub secrets/variables:

```bash
gh secret set EXPO_TOKEN --body "<token-from-expo.dev-account-settings>"
gh variable set EXPO_PUBLIC_API_URL --body "https://app-backend-production-XXXX.up.railway.app"
gh variable set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --body "pk_test_..."
```

## Gotchas

- **Drizzle migrations**: `app-backend/drizzle/meta/` must be committed to git. Without `_journal.json`, the backend crashes on startup. It was previously gitignored — if re-creating the repo, ensure it stays tracked.
- **Worker timing**: The worker polls Postgres directly. If it starts before app-backend finishes migrations, it will error on missing tables. It retries on its poll loop, so a restart or brief wait resolves it.
- **EAS env vars**: `eas update` bundles JS locally and inlines `EXPO_PUBLIC_*` from whichever `.env` file Expo loads. Always pass production values explicitly (via env vars or `--environment` flag) to avoid baking in local dev URLs.
- **Railway branch**: Railway deploys from whichever branch you configure. Use `railway variables` or the dashboard to switch between branches.
