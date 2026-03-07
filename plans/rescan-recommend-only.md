# Re-scan: Recommend-Only for Successful Scans

## Context
When a user re-scans a previously successful scan, the entire 4-stage pipeline (detect → OCR → normalize → recommend) re-runs from scratch. This is wasteful — the books on the shelf haven't changed, only the reader context or comment may have. For successful scans, re-scan should only re-run the recommendation stage (~1 API call vs 4 stages of processing).

## Changes

### 1. Worker: Save `detected_books` to DB after pipeline completes
**File:** `worker/src/main.py` (~line 370)

Add `detected_books` (stripped of `crop_b64` to avoid bloating the DB) to the final `patch_scan` call. The crops are already uploaded to S3 separately.

### 2. Add `pending_recommend` status to the pipeline
**Files to update:**
- `worker/src/main.py` — `get_pending_scans()` query: also fetch scans with `processing_status = 'pending_recommend'`, and include `detected_books` in the SELECT
- `worker/src/main.py` — `_process_scan_sync()`: if status is `pending_recommend`, skip stages 1-3, reconstruct normalized books from stored `detected_books`, run only stage 4 (recommend)
- `worker/src/main.py` — `STAGE_TO_STATUS` and stale recovery: add `pending_recommend` awareness

### 3. Frontend: Use `pending_recommend` for re-scan of done scans
**File:** `app-mobile/app/(main)/(tabs)/scan-detail.tsx` (~line 332)

In `rerunRecommendation()`: change the status sent from `"pending"` to `"pending_recommend"` — only for scans that completed successfully (status was `"done"`).

### 4. Frontend: Handle `pending_recommend` in status display
**File:** `app-mobile/app/(main)/(tabs)/scan-detail.tsx` (~line 22-31)

Map `pending_recommend` to same display as `recommending` or show a "Refreshing recommendations..." state. The workflow stepper should jump to step 4.

### 5. Backend: Allow `pending_recommend` as valid status
**File:** `app-backend/src/routes/scans.ts` (~line 135)

Ensure PATCH endpoint accepts `pending_recommend` as a valid `processing_status` value (it likely already does since there's no validation, but verify).

## Key Files
- `worker/src/main.py` — main processing loop + scan handler
- `worker/src/pipeline/orchestrator.py` — pipeline stages (reference only, no changes needed — we'll call `recommend_books` directly)
- `worker/src/pipeline/stage_recommend.py` — recommendation stage
- `app-mobile/app/(main)/(tabs)/scan-detail.tsx` — re-scan trigger + status display
- `app-backend/src/db/schema.ts` — schema (no changes, `detected_books` JSONB already exists)
- `app-backend/src/routes/scans.ts` — PATCH endpoint

## Verification
1. Do a fresh scan → verify `detected_books` is now saved in DB (check via MCP SQL)
2. Hit re-scan on a completed scan → verify worker picks it up as `pending_recommend`
3. Verify worker skips stages 1-3 and only runs recommend
4. Verify new recommendations appear correctly in the UI
5. Verify fresh scans (new uploads) still run the full pipeline
6. Verify stale recovery handles `pending_recommend` correctly
