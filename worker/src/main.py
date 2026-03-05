"""BookBeam shelf processing worker.

Polls the scans table for scans with processing_status='pending',
runs the 4-stage pipeline (detect -> OCR -> normalize -> recommend),
and updates the scan via the backend API.

Uses asyncio for concurrent scan processing.
"""

import asyncio
import base64
import io
import logging
import os
import uuid

import boto3
import httpx
from PIL import Image
import psycopg2

from pipeline import run_full_pipeline

DATABASE_URL = os.environ["DATABASE_URL"]
API_BASE_URL = os.environ["API_BASE_URL"]
ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]
TEST_USER_ID = os.environ["TEST_USER_ID"]
MAX_CONCURRENT_SCANS = int(os.environ["MAX_CONCURRENT_SCANS"])
S3_BUCKET = os.environ["S3_BUCKET"]

_s3_client = boto3.client(
    "s3",
    endpoint_url=os.environ["S3_ENDPOINT"],
    aws_access_key_id=os.environ["S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["S3_SECRET_KEY"],
)

POLL_INTERVAL_SECONDS = 5
STALE_TASK_TIMEOUT_SECONDS = 120

# Track the processing_task_id currently being worked on.
# After restart this is empty, so all stuck intermediate scans get recovered.
active_task_ids: set[str] = set()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("worker")

ADMIN_HEADERS = {
    "X-Admin-Key": ADMIN_API_KEY,
    "X-Admin-User-Id": TEST_USER_ID,
    "Content-Type": "application/json",
}

STAGE_TO_STATUS = {
    "detect": "detecting",
    "ocr": "reading",
    "normalize": "looking_up",
    "recommend": "recommending",
}


def get_pending_scans():
    """Poll the database for unclaimed scans waiting to be processed."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.image_url, s.reader_comment, s.reader_profile_id
                FROM scan s
                WHERE s.processing_status = 'pending'
                  AND s.processing_task_id IS NULL
                ORDER BY s.created_at ASC
                LIMIT 5
                """
            )
            rows = cur.fetchall()
            return [
                {
                    "id": str(row[0]),
                    "image_url": row[1],
                    "reader_comment": row[2],
                    "reader_profile_id": str(row[3]) if row[3] else None,
                }
                for row in rows
            ]
    finally:
        conn.close()


def claim_scan(scan_id: str) -> str | None:
    """Atomically claim a scan by setting processing_task_id. Returns task_id or None if already claimed."""
    task_id = str(uuid.uuid4())
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE scan
                SET processing_task_id = %s, processing_task_started = now()
                WHERE id = %s AND processing_task_id IS NULL
                RETURNING id
                """,
                (task_id, scan_id),
            )
            row = cur.fetchone()
            conn.commit()
            if row:
                return task_id
            return None
    finally:
        conn.close()


def recover_stale_scans():
    """Reset scans stuck in intermediate states whose task is no longer active."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, processing_task_id
                FROM scan
                WHERE (processing_status IN ('detecting', 'reading', 'looking_up', 'recommending')
                   OR (processing_status = 'pending' AND processing_task_id IS NOT NULL))
                  AND processing_task_started < now() - interval '%s seconds'
                """,
                (STALE_TASK_TIMEOUT_SECONDS,),
            )
            rows = cur.fetchall()
            for row in rows:
                stale_id, stale_task_id = str(row[0]), str(row[1]) if row[1] else None
                if stale_task_id in active_task_ids:
                    continue  # Still being worked on by this worker
                cur.execute(
                    """
                    UPDATE scan
                    SET processing_task_id = NULL, processing_status = 'pending'
                    WHERE id = %s
                    """,
                    (stale_id,),
                )
                log.info("Recovered stale scan %s (was task %s)", stale_id, stale_task_id)
            conn.commit()
    finally:
        conn.close()


class TaskOrphanedError(Exception):
    """Raised when the backend returns 409 — this task has been superseded."""


def sync_api_get(path: str) -> dict:
    """Synchronous GET request to the backend API with admin auth."""
    resp = httpx.get(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def sync_api_post(path: str, body: dict) -> dict:
    """Synchronous POST request to the backend API with admin auth."""
    resp = httpx.post(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


def sync_api_patch(path: str, body: dict) -> dict:
    """Synchronous PATCH request to the backend API. Raises TaskOrphanedError on 409."""
    resp = httpx.patch(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, json=body, timeout=30)
    if resp.status_code == 409:
        raise TaskOrphanedError(f"Task orphaned: {resp.json().get('error', 'task ID mismatch')}")
    resp.raise_for_status()
    return resp.json()


def get_reader_context(profile_id: str) -> str:
    """Fetch reader profile and history to provide context for recommendations."""
    profile = sync_api_get(f"/api/profiles/{profile_id}")
    history = sync_api_get(f"/api/profiles/{profile_id}/history")

    parts = []
    if profile.get("name"):
        parts.append(f"Reader name: {profile['name']}")
    if profile.get("age"):
        parts.append(f"Age: {'Adult' if profile['age'] == 99 else profile['age']}")
    if profile.get("grade") is not None:
        grade_val = profile["grade"]
        grade_display = "N/A" if grade_val == 99 else ("K" if grade_val == 0 else str(grade_val))
        parts.append(f"Grade: {grade_display}")
    if profile.get("interests"):
        parts.append(f"Interests: {', '.join(profile['interests'])}")
    if profile.get("languages"):
        parts.append(f"Languages: {', '.join(profile['languages'])}")
    if profile.get("notes"):
        parts.append(f"Notes from parent: {profile['notes']}")

    # history is grouped: {reading: [...], finished: [...]}
    all_entries = []
    if isinstance(history, dict):
        for entries in history.values():
            if isinstance(entries, list):
                all_entries.extend(entries)
    elif isinstance(history, list):
        all_entries = history

    if all_entries:
        read_titles = [
            entry.get("book", {}).get("title", "Unknown")
            for entry in all_entries
            if isinstance(entry, dict)
        ]
        if read_titles:
            parts.append(f"Books already read/reading: {', '.join(read_titles[:20])}")

    return "\n".join(parts) if parts else "No reader profile info available."


def load_image_as_base64(image_url: str) -> str:
    """Fetch image via backend proxy and return base64."""
    url = f"{API_BASE_URL}{image_url}"
    resp = httpx.get(url, headers=ADMIN_HEADERS, timeout=30)
    resp.raise_for_status()
    return base64.b64encode(resp.content).decode("utf-8")


def _process_scan_sync(scan_row: dict, task_id: str):
    """Process a single scan synchronously (runs in a thread).

    Uses the 4-stage pipeline: detect -> OCR -> normalize -> recommend.
    """
    scan_id = scan_row["id"]
    image_url = scan_row["image_url"]
    reader_comment = scan_row["reader_comment"]
    profile_id = scan_row["reader_profile_id"]

    log.info("Processing scan %s (task %s, image: %s)", scan_id, task_id, image_url)

    def patch_scan(body: dict) -> dict:
        body["processing_task_id"] = task_id
        return sync_api_patch(f"/api/scans/{scan_id}", body)

    def status_callback(stage_name: str):
        """Called by the pipeline orchestrator when a stage starts."""
        db_status = STAGE_TO_STATUS.get(stage_name)
        if db_status:
            patch_scan({"processing_status": db_status})

    # Load image as base64
    image_b64 = load_image_as_base64(image_url)
    img = Image.open(io.BytesIO(base64.b64decode(image_b64)))
    log.info("Loaded image %dx%d", img.width, img.height)

    # Get reader context for personalized recommendations
    reader_context = "No reader profile available."
    if profile_id:
        reader_context = get_reader_context(profile_id)

    # Run the full 4-stage pipeline
    result = run_full_pipeline(
        image_source=image_b64,
        reader_context=reader_context,
        reader_comment=reader_comment,
        is_base64=True,
        status_callback=status_callback,
    )

    detected_books = result.get("detected_books", [])
    log.info("Pipeline returned %d detected books", len(detected_books))

    # Upload crops to S3
    for i, detected in enumerate(detected_books):
        crop_b64 = detected.pop("crop_b64", None)
        if crop_b64:
            key = f"crops/{scan_id}/{i}.jpg"
            _s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=base64.b64decode(crop_b64),
                ContentType="image/jpeg",
            )
            detected_books[i]["crop_url"] = f"/uploads/{key}"
    log.info("Uploaded %d crops to S3", sum(1 for d in detected_books if d.get("crop_url")))

    # Upsert each detected book into the books table
    for i, detected in enumerate(detected_books):
        if not detected.get("title"):
            continue
        book_data = {
            "title": detected["title"],
            "author": detected.get("author"),
        }
        book_record = sync_api_post("/api/books", book_data)
        detected_books[i]["book_id"] = book_record["id"]

    # Final update — set detected_books, recommendation, summary, and status to 'done'
    recommendations = result.get("recommendations", [])
    recommendation_summary = result.get("recommendation_summary", "")

    log.info("Recommendations (%d):", len(recommendations))
    for rec in recommendations:
        log.info("  #%s [%d] %s — %s: %s",
                 rec.get("rank", "?"), rec.get("book_index", -1),
                 rec.get("title", "?"), rec.get("author", "?"),
                 rec.get("reason", ""))
    log.info("Summary: %s", recommendation_summary)

    patch_scan({
        "processing_status": "done",
        "detected_books": detected_books,
        "recommendation": recommendations,
        "recommendation_summary": recommendation_summary,
    })

    log.info("Scan %s completed: %d books detected, %d recommendations",
             scan_id, len(detected_books), len(recommendations))


async def process_scan(scan_row: dict, task_id: str):
    """Async wrapper that runs the synchronous pipeline in a thread."""
    await asyncio.to_thread(_process_scan_sync, scan_row, task_id)


async def main():
    """Main async polling loop with concurrent scan processing."""
    log.info("BookBeam worker starting...")
    log.info("API base: %s", API_BASE_URL)
    log.info("Poll interval: %ds, max concurrent: %d", POLL_INTERVAL_SECONDS, MAX_CONCURRENT_SCANS)

    active_tasks: set[asyncio.Task] = set()

    while True:
        try:
            # Recover any scans stuck from a previous crash/restart
            await asyncio.to_thread(recover_stale_scans)

            scans = await asyncio.to_thread(get_pending_scans)
            if scans:
                log.info("Found %d pending scan(s)", len(scans))
                for scan_row in scans:
                    if len(active_tasks) >= MAX_CONCURRENT_SCANS:
                        break

                    scan_id = scan_row["id"]
                    task_id = await asyncio.to_thread(claim_scan, scan_id)
                    if not task_id:
                        log.info("Scan %s already claimed, skipping", scan_id)
                        continue

                    active_task_ids.add(task_id)

                    async def _run(sr=scan_row, tid=task_id):
                        try:
                            await process_scan(sr, tid)
                        except TaskOrphanedError:
                            log.info("Scan %s task %s was orphaned (reprocessed), skipping", sr["id"], tid)
                        except Exception as exc:
                            log.error("Failed to process scan %s: %s", sr["id"], exc, exc_info=True)
                            try:
                                await asyncio.to_thread(
                                    sync_api_patch,
                                    f"/api/scans/{sr['id']}",
                                    {
                                        "processing_status": "failed",
                                        "processing_task_id": tid,
                                        "recommendation_summary": "Something went wrong processing this shelf. Please try again.",
                                    },
                                )
                            except TaskOrphanedError:
                                log.info("Scan %s was reprocessed, not marking as failed", sr["id"])
                            except Exception as patch_exc:
                                log.error("Failed to mark scan %s as failed: %s", sr["id"], patch_exc)
                        finally:
                            active_task_ids.discard(tid)

                    task = asyncio.create_task(_run())
                    active_tasks.add(task)

            # Cleanup completed tasks
            done = {t for t in active_tasks if t.done()}
            for t in done:
                # Surface any unhandled exceptions from tasks
                if t.exception():
                    log.error("Task raised unhandled exception: %s", t.exception())
            active_tasks -= done

        except Exception as exc:
            log.error("Poll cycle error: %s", exc, exc_info=True)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
