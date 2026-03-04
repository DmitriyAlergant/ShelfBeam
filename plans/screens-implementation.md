# Screens Implementation Plan

> **Pre-req**: `plans/scaffolding.md` complete — DB migrated, backend running on :3000, Expo project bootstrapped with folders created.

---

## Task 1: DiceBear Avatars — Avataaars Style

Set up DiceBear avatar generation so every screen that shows a reader profile has a unique cartoon avatar from day one.

- [x] **Install `@dicebear/core` + `@dicebear/avataaars`** in `app-mobile`. These generate SVGs client-side — no external API calls needed.
- [x] **Avatar component**: create a reusable `<DiceBearAvatar seed={string} size={number} />` component that renders an Avataaars SVG via `react-native-svg`. The `seed` is the `avatar_key` stored on the reader profile.
- [x] **Avatar picker widget**: a reusable picker that shows a grid of ~6 random avatar options + a "Randomize" button to shuffle them. Returns the selected seed. This widget will be used in profile creation and profile editing.
- [x] **Validate**: render avatars in a test screen, confirm different seeds produce different avatars, confirm SVGs render cleanly at various sizes (32, 64, 128).
- [x] **Polish**: smooth transition when randomizing, consistent sizing across all placements (picker card, header icon, profile form).

---

## Task 2: Mobile Shell — Navigation, Auth Gate & Profile Picker

Partially already done, but needs a revision to adhere to Design Guidelines that were created later.

Get the app running end-to-end: open app → sign in → pick a reader → land on tabs. No real content yet, just the skeleton that every subsequent task plugs into.

- [x] **Design** the visual language: define a `theme.ts` with colors, spacing, typography, and shared component primitives (Button, Card, Avatar, ScreenWrapper). Kid-friendly palette — bright but not garish.
- [x] **Root layout** (`app/_layout.tsx`): ClerkProvider + SafeAreaProvider + slot. Auth gate that redirects unauthenticated users to `(auth)` group.
- [x] **Auth screens** (`app/(auth)/sign-in.tsx`, `sign-up.tsx`): Clerk `<SignIn>` / `<SignUp>` components with BookBeam branding (logo, tagline, background color).
- [x] **User sync hook**: on first successful sign-in, call `POST /api/users/sync` to create the `app_user` record. Store the `appUserId` in React context.
- [x] **Profile Picker screen** (`app/(auth)/profile-picker.tsx`): fetch `GET /api/profiles`, render avatar cards + "Add New Reader" card. Tapping a profile stores `activeProfileId` in context and navigates to `(main)`.
- [x] **Quick-add profile modal**: minimal form (name + avatar grid) → `POST /api/profiles`. Returns to picker with new card visible.
- [x] **Tab navigator** (`app/(main)/(tabs)/_layout.tsx`): three tabs — Scan, My Books, Profile — with icons and labels. Each tab shows a placeholder screen with the tab name.
- [x] **Top bar profile switcher**: persistent header component across all tabs showing current reader avatar+name; tap opens a bottom sheet to switch reader.
- [x] **Validate**: launch in iOS Simulator, sign in with Clerk test user, create a profile, land on tabs, switch profiles. Confirm backend receives sync + profile calls (curl / logs).
- [x] **Polish**: transitions, loading states, error handling for network failures on sync/profile calls.

---

## Task 3: Backend APIs — Scans, Books, History & File Upload

Build every backend endpoint the remaining screens need. Validate each with curl before moving on.

- [x] **Design API contract**: document request/response shapes for all new endpoints below. Align with existing Drizzle schema and JSONB structures from `data-model.md`.
- [x] **Image upload**: `POST /api/scans/upload` — accept multipart image, save to `/data/uploads/` volume, return `image_url` path. Wire volume mount in `docker-compose.yml`.
- [x] **Scan CRUD**:
  - `POST /api/scans` — create scan record (reader_profile_id, image_url, reader_comment), set status `detecting`.
  - `GET /api/scans` — list scans for active reader profile, newest first.
  - `GET /api/scans/:id` — full scan detail including detected_books and recommendation.
  - `PATCH /api/scans/:id` — update processing_status, detected_books, recommendation (used by worker and re-run).
- [x] **Book CRUD**:
  - `POST /api/books` — upsert by ISBN or title+author normalization. Return existing or new book record.
  - `GET /api/books/:id` — single book detail.
- [x] **Book history**:
  - `GET /api/profiles/:profileId/history` — list history entries joined with book data, grouped by status.
  - `POST /api/profiles/:profileId/history` — add book to history (book_id, source, status).
  - `PATCH /api/profiles/:profileId/history/:entryId` — update reactions array or status.
  - `DELETE /api/profiles/:profileId/history/:entryId` — remove entry.
- [x] **Reading log parsing** (stub): `POST /api/reading-log/parse` — accepts freeform text, returns mock parsed books array for now (real LLM integration deferred to Task 5). Shape: `[{title, author, inferred_status, inferred_reactions}]`.
- [x] **Profile update**: `PATCH /api/profiles/:id` — update all reader profile fields (name, avatar, birth_year, gender, languages, interests, notes).
- [x] **Static file serving**: serve `/data/uploads/` as static route so mobile app can display shelf images.
- [x] **Validate every endpoint** with curl: create scan → upload image → verify file on disk → get scan → add book → add to history → update reactions → parse reading log stub. Log all calls.
- [x] **Error handling review**: ensure all routes return consistent error shapes `{error: string}`, and no swallowed exceptions.

---

## Task 4: Scan Flow Screens — Camera, Scan Home & Scan Detail

The hero flow of the app. User takes a photo, sees detected books, gets recommendations.

- [x] **Scan Home screen** (`app/(main)/(tabs)/scan.tsx`): fetch `GET /api/scans`, render a FlatList of scan cards (thumbnail, date, book count, status badge). "Scan a Shelf" FAB button. Empty state illustration for first-time users.
- [x] **Camera modal** (`app/(main)/camera.tsx`): `expo-camera` for capture + `expo-image-picker` for gallery. Preview captured image with retake/use buttons. On "use" → upload image via `POST /api/scans/upload`, then `POST /api/scans` → navigate to Scan Detail.
- [x] **Scan Detail screen** (`app/(main)/scan-detail.tsx`): the richest screen.
  - Collapsible shelf photo at top.
  - Processing status indicator — animated stepper: detecting → reading → looking_up → recommending → done. Poll `GET /api/scans/:id` every 2s while not `done`.
  - Detected books list: cover thumbnail (or spine crop), title, author, confidence badge, "Take this one" button → `POST /api/profiles/:id/history`.
  - Reader comment input field at top ("What are you looking for today?") — sends `PATCH /api/scans/:id`.
  - LLM recommendation panel: card with personalized text, "Re-run" button that triggers `PATCH /api/scans/:id` to reset recommendation status.
- [x] **API integration layer**: create `lib/api.ts` with typed fetch wrappers for all scan/book endpoints. Include auth token from Clerk session.
- [x] **Validate**: full flow in Simulator — tap FAB → take photo → see it upload → scan created → scan detail shows processing states → mock some detected books via curl PATCH → verify they render → tap "Take this one" → confirm history entry created.
- [x] **Polish**: skeleton loaders while fetching, pull-to-refresh on scan home, smooth animations on status stepper, haptic feedback on "Take this one".

---

## Task 5: My Books & Profile Screens — History, Reading Log & Reader Profile

Complete the remaining two tabs and all their sub-screens.

- [x] **Book History screen** (`app/(main)/(tabs)/books.tsx`): two sections — "Currently Reading" and "Finished". Each card shows cover, title, author, source tag ("From scan" / "Logged by you"), emoji reaction row. "Tell us what you've read" button at top.
- [x] **Book Detail modal** (`app/(main)/book-detail.tsx`): full cover image, title, author, description (from raw_metadata), emoji reaction picker (toggle grid of ~12 emojis), reading status toggle (reading ↔ finished). Changes save immediately via `PATCH /api/profiles/:id/history/:entryId`.
- [x] **Reading Log Entry screen** (`app/(main)/reading-log-entry.tsx`): large text input area with placeholder "Tell us about books you've been reading...". Microphone icon (triggers OS dictation via `textContentType`). Submit button → `POST /api/reading-log/parse` → navigate to Reading Log Confirmation.
- [x] **Reading Log Confirmation screen** (`app/(main)/reading-log-confirmation.tsx`): render parsed results as editable cards (title, author, status dropdown, reaction chips). "Looks good!" button → batch `POST /api/books` + `POST /api/profiles/:id/history` for each → navigate back to Book History.
- [x] **Reader Profile screen** (`app/(main)/(tabs)/profile.tsx`): scrollable form with avatar grid picker, name input, birth year picker, gender selector, languages multi-select chips, interests tag input, freeform notes textarea. Auto-save on blur or explicit "Save" button → `PATCH /api/profiles/:id`.
- [x] **Validate**: add books via reading log entry flow end-to-end → confirm they appear in history → tap a book → see detail → toggle emoji reactions → verify PATCH calls. Edit profile fields → verify persistence.
- [x] **Polish**: empty states for history, keyboard-avoiding views on forms, smooth sheet animations for book detail modal, reaction emoji animations.

## Task 5.5: Re-validate API routes

- [x] Retest and revalidate all previously implemented API routes via ADMIN_API_KEY auth bypass

## Task 6: Reading Log Parsing via LLM

Wire up real LLM-powered reading log parsing so the "Tell us what you've read" flow works end-to-end.

- [x] **Design prompt**: craft a system prompt that extracts structured book data from freeform kid input — title, author (if mentioned), reading status, inferred emotional reactions. Output as JSON array.
- [x] **Replace stub in `POST /api/reading-log/parse`**: call gpt-5.2 via OpenAI SDK (using `OPENAI_API_KEY`, `OPENAI_BASE_URL` from env). Retry once on malformed JSON response.
- [x] **Validate**: test with varied inputs via curl — "I read Harry Potter and it was amazing", "me and mom finished Diary of a Wimpy Kid, started Percy Jackson" — confirm parsed output is sensible.
- [x] **Wire to frontend**: confirm Reading Log Entry → Reading Log Confirmation → Book History flow works end-to-end with real parsing.
- [x] **Polish**: handle LLM timeouts gracefully (return error, don't hang), tune prompt for better extraction quality.

---

## Task 7: Processing Pipeline Stub — Shelf Image → Book Recommendations

Rudimentary stub: send the entire shelf photo to gpt-5.2 vision, get back detected books + recommendations in a single call. Implemented as a standalone Python worker.

- [ ] **Design**: define the JSON contract the worker writes into `scan.detected_books` and `scan.recommendation`. Define the LLM prompt — "Here is a photo of a bookshelf. Identify all visible books (title, author). Then recommend the top 3 for a kid with these interests: {interests}." Response schema with retry on parse failure.
- [ ] **Python worker**: standalone container that polls `scans` table for `processing_status = 'detecting'`. For each: fetch the image, call gpt-5.2 vision API, parse response, upsert books into `books` table, update `scan.detected_books` + `scan.recommendation`, set status to `done`.
- [ ] **Docker Compose**: add `worker` service, mount source for hot reload, pass `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `DATABASE_URL` from env. Mount `/data/uploads/` volume (shared with app-backend).
- [ ] **Validate on `sample-images/`**: place 2-3 real bookshelf photos in `sample-images/`, create scans pointing to them via curl, watch worker pick them up and process. Verify detected books and recommendations make sense.
- [ ] **Polish**: error recovery — if LLM call fails, set status to `error` with message (not silent). Add basic logging. Frontend "Re-run" button resets status to `detecting` so worker re-processes.

