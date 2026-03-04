"""BookBeam shelf processing worker.

Polls the scans table for scans with processing_status='detecting',
sends the shelf photo to GPT vision, extracts detected books and
generates recommendations, then updates the scan via the backend API.
"""

import base64
import json
import logging
import os
import time

import httpx
import psycopg2
from openai import OpenAI

DATABASE_URL = os.environ["DATABASE_URL"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
OPENAI_BASE_URL = os.environ["OPENAI_BASE_URL"]
API_BASE_URL = os.environ["API_BASE_URL"]
ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]
TEST_USER_ID = os.environ["TEST_USER_ID"]

POLL_INTERVAL_SECONDS = 5
UPLOADS_DIR = "/data/uploads"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("worker")

openai_client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

ADMIN_HEADERS = {
    "X-Admin-Key": ADMIN_API_KEY,
    "X-Admin-User-Id": TEST_USER_ID,
    "Content-Type": "application/json",
}

VISION_SYSTEM_PROMPT = """\
You are a children's librarian AI assistant for the BookBeam app.

You will be shown a photo of a bookshelf. Your job:
1. Identify ALL visible books — look at spines, covers, any readable text.
2. For each book, extract: title, author (if visible), and your confidence (0.0-1.0).
3. Then, given the reader's profile info, recommend the top 3 books from the shelf \
for this specific child, with a short kid-friendly explanation for each pick.
4. Write a brief overall recommendation summary (2-3 sentences, kid-friendly tone).

Respond ONLY with valid JSON matching this schema:
{
  "detected_books": [
    {
      "index": 0,
      "title": "Book Title",
      "author": "Author Name or null",
      "confidence": 0.85,
      "raw_ocr_text": "text you read from the spine"
    }
  ],
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "reason": "Short kid-friendly reason why this book is great for you!"
    }
  ],
  "recommendation_summary": "Hey there! I found some awesome books on this shelf..."
}

Rules:
- Include ALL books you can identify, even if partially visible.
- For author, use null if you truly cannot determine it.
- Confidence should reflect how sure you are about the identification.
- Recommendations must reference books from the detected_books list.
- Keep recommendation language fun and age-appropriate.
"""


def get_pending_scans():
    """Poll the database for scans waiting to be processed."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.image_url, s.reader_comment, s.reader_profile_id
                FROM scan s
                WHERE s.processing_status = 'detecting'
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


def api_get(path: str) -> dict:
    """GET request to the backend API with admin auth."""
    resp = httpx.get(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def api_post(path: str, body: dict) -> dict:
    """POST request to the backend API with admin auth."""
    resp = httpx.post(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


def api_patch(path: str, body: dict) -> dict:
    """PATCH request to the backend API with admin auth."""
    resp = httpx.patch(f"{API_BASE_URL}{path}", headers=ADMIN_HEADERS, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_reader_context(profile_id: str) -> str:
    """Fetch reader profile and history to provide context for recommendations."""
    profile = api_get(f"/api/profiles/{profile_id}")
    history = api_get(f"/api/profiles/{profile_id}/history")

    parts = []
    if profile.get("name"):
        parts.append(f"Reader name: {profile['name']}")
    if profile.get("birthYear"):
        parts.append(f"Birth year: {profile['birthYear']}")
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


def load_image_as_base64(image_url: str) -> tuple[str, str]:
    """Load image from uploads volume and return base64 + media type."""
    # image_url is like /uploads/abc123.jpg
    filename = image_url.removeprefix("/uploads/").lstrip("/")
    filepath = os.path.join(UPLOADS_DIR, filename)

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Image not found at {filepath}")

    ext = filepath.rsplit(".", 1)[-1].lower()
    media_type_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    media_type = media_type_map.get(ext, "image/jpeg")

    with open(filepath, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")

    return data, media_type


def _parse_llm_json(raw_text: str) -> dict:
    """Strip markdown fences and parse JSON from LLM response."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


def call_vision_api(image_b64: str, media_type: str, reader_context: str, reader_comment: str | None) -> dict:
    """Send the shelf image to GPT vision and parse the response. Retries once on malformed JSON."""
    user_message = f"Reader profile:\n{reader_context}"
    if reader_comment:
        user_message += f"\n\nThe reader says: \"{reader_comment}\""
    user_message += "\n\nPlease analyze the bookshelf photo and provide your response."

    messages = [
        {"role": "system", "content": VISION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_message},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{image_b64}",
                    },
                },
            ],
        },
    ]

    for attempt in range(2):
        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=4096,
            temperature=0.3,
        )

        raw_text = response.choices[0].message.content
        try:
            return _parse_llm_json(raw_text)
        except json.JSONDecodeError:
            if attempt == 0:
                log.warning("Malformed JSON from LLM, retrying (attempt %d)", attempt + 1)
                messages.append({"role": "assistant", "content": raw_text})
                messages.append({"role": "user", "content": "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."})
            else:
                raise ValueError(f"LLM returned invalid JSON after retry: {raw_text[:500]}")


def process_scan(scan_row: dict):
    """Process a single scan: detect books, upsert them, generate recommendations."""
    scan_id = scan_row["id"]
    image_url = scan_row["image_url"]
    reader_comment = scan_row["reader_comment"]
    profile_id = scan_row["reader_profile_id"]

    log.info("Processing scan %s (image: %s)", scan_id, image_url)

    # Step 1: Update status to 'reading'
    api_patch(f"/api/scans/{scan_id}", {"processing_status": "reading"})

    # Step 2: Load image
    image_b64, media_type = load_image_as_base64(image_url)
    log.info("Loaded image (%s, %d bytes base64)", media_type, len(image_b64))

    # Step 3: Get reader context for personalized recommendations
    reader_context = "No reader profile available."
    if profile_id:
        reader_context = get_reader_context(profile_id)

    # Step 4: Update status to 'looking_up' (calling the LLM)
    api_patch(f"/api/scans/{scan_id}", {"processing_status": "looking_up"})

    # Step 5: Call vision API (single call for detect + recommend)
    result = call_vision_api(image_b64, media_type, reader_context, reader_comment)
    log.info("Vision API returned %d detected books", len(result.get("detected_books", [])))

    # Step 6: Update status to 'recommending' while we upsert books
    api_patch(f"/api/scans/{scan_id}", {"processing_status": "recommending"})

    # Step 7: Upsert each detected book into the books table
    detected_books = result.get("detected_books", [])
    for i, detected in enumerate(detected_books):
        book_data = {
            "title": detected["title"],
            "author": detected.get("author"),
        }
        book_record = api_post("/api/books", book_data)
        detected_books[i]["book_id"] = book_record["id"]
        log.info("Upserted book: %s -> %s", detected["title"], book_record["id"])

    # Step 8: Final update — set detected_books, recommendation, summary, and status to 'done'
    recommendations = result.get("recommendations", [])
    recommendation_summary = result.get("recommendation_summary", "")

    api_patch(f"/api/scans/{scan_id}", {
        "processing_status": "done",
        "detected_books": detected_books,
        "recommendation": recommendations,
        "recommendation_summary": recommendation_summary,
    })

    log.info("Scan %s completed: %d books detected, %d recommendations",
             scan_id, len(detected_books), len(recommendations))


def main():
    """Main polling loop."""
    log.info("BookBeam worker starting...")
    log.info("API base: %s", API_BASE_URL)
    log.info("Poll interval: %ds", POLL_INTERVAL_SECONDS)

    while True:
        try:
            scans = get_pending_scans()
            if scans:
                log.info("Found %d pending scan(s)", len(scans))
                for scan_row in scans:
                    try:
                        process_scan(scan_row)
                    except Exception as exc:
                        scan_id = scan_row["id"]
                        log.error("Failed to process scan %s: %s", scan_id, exc, exc_info=True)
                        try:
                            api_patch(f"/api/scans/{scan_id}", {
                                "processing_status": "failed",
                                "recommendation_summary": f"Processing error: {exc}",
                            })
                        except Exception as patch_exc:
                            log.error("Failed to mark scan %s as failed: %s", scan_id, patch_exc)
        except Exception as exc:
            log.error("Poll cycle error: %s", exc, exc_info=True)

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
