"""Standalone BookBeam pipeline: image -> detection -> OCR -> recommendations.

Runs locally without Docker or the backend API. Reads reader profile + history
directly from the local Postgres DB. Does NOT create a scan entity.

Usage:
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid>
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid> --reader-comment "adventure books"
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid> -o results.json
"""

import argparse
import base64
import json
import logging
import mimetypes
import os
import sys
from datetime import date

import psycopg2
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("standalone")


def _get_openai_client() -> OpenAI:
    return OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ["OPENAI_BASE_URL"],
    )


def _get_database_url() -> str:
    return os.environ.get("STANDALONE_DATABASE_URL") or os.environ["DATABASE_URL"].replace("@postgres:", "@localhost:")

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


def get_reader_context_from_db(profile_id: str) -> str:
    """Fetch reader profile and book history directly from the local Postgres DB."""
    conn = psycopg2.connect(_get_database_url())
    try:
        with conn.cursor() as cur:
            # Fetch reader profile
            cur.execute(
                """
                SELECT name, birth_year, gender, languages, interests, notes
                FROM reader_profile
                WHERE id = %s
                """,
                (profile_id,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Reader profile not found: {profile_id}")

            name, birth_year, gender, languages, interests, notes = row

            parts = []
            if name:
                parts.append(f"Reader name: {name}")
            if birth_year:
                parts.append(f"Age: ~{date.today().year - birth_year}")
            if interests:
                parts.append(f"Interests: {', '.join(interests)}")
            if languages:
                parts.append(f"Languages: {', '.join(languages)}")
            if notes:
                parts.append(f"Notes from parent: {notes}")

            # Fetch book history (titles of books already read/reading)
            cur.execute(
                """
                SELECT b.title
                FROM book_history_entry bhe
                JOIN book b ON b.id = bhe.book_id
                WHERE bhe.reader_profile_id = %s
                ORDER BY bhe.created_at DESC
                LIMIT 20
                """,
                (profile_id,),
            )
            history_rows = cur.fetchall()
            if history_rows:
                titles = [r[0] for r in history_rows]
                parts.append(f"Books already read/reading: {', '.join(titles)}")

            return "\n".join(parts) if parts else "No reader profile info available."
    finally:
        conn.close()


def load_image(image_path: str) -> tuple[str, str]:
    """Read a local image file and return (base64_data, media_type)."""
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")

    return data, mime_type


def _parse_llm_json(raw_text: str) -> dict:
    """Strip markdown fences and parse JSON from LLM response."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


def call_vision_api(image_b64: str, media_type: str, reader_context: str, reader_comment: str | None) -> dict:
    """Send the shelf image to the LLM vision API. Retries once on malformed JSON."""
    user_message = f"Reader profile:\n{reader_context}"
    if reader_comment:
        user_message += f'\n\nThe reader says: "{reader_comment}"'
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
        log.info("Calling vision API (attempt %d)...", attempt + 1)
        response = _get_openai_client().chat.completions.create(
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
                log.warning("Malformed JSON from LLM, retrying...")
                messages.append({"role": "assistant", "content": raw_text})
                messages.append({"role": "user", "content": "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."})
            else:
                raise ValueError(f"LLM returned invalid JSON after retry: {raw_text[:500]}")


def run_pipeline(image_path: str, reader_context: str, reader_comment: str | None) -> dict:
    """Full pipeline: load image -> call vision API -> return results."""
    log.info("Loading image: %s", image_path)
    image_b64, media_type = load_image(image_path)
    log.info("Image loaded (%s, %d bytes base64)", media_type, len(image_b64))

    log.info("Reader context:\n%s", reader_context)

    result = call_vision_api(image_b64, media_type, reader_context, reader_comment)
    log.info("Detected %d books, %d recommendations",
             len(result.get("detected_books", [])),
             len(result.get("recommendations", [])))

    return result


def _output_result(result: dict, output_path: str | None):
    """Write result JSON to file or stdout."""
    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    if output_path:
        with open(output_path, "w") as f:
            f.write(output_json)
        log.info("Results written to %s", output_path)
    else:
        print(output_json)


def main():
    parser = argparse.ArgumentParser(
        description="Standalone BookBeam pipeline: image -> book detection -> recommendations"
    )
    parser.add_argument("image", nargs="?", help="Path to a bookshelf photo (jpg/png)")
    parser.add_argument("--stage", choices=["detect", "ocr", "normalize"], help="Run a single pipeline stage")
    parser.add_argument("--input-json", help="Input JSON file from a previous stage (for --stage ocr, etc.)")
    parser.add_argument("--reader-profile-id", help="UUID of the reader_profile to load from the DB")
    parser.add_argument("--reader-comment", help="What the reader is looking for")
    parser.add_argument("--output", "-o", help="Write JSON results to this file instead of stdout")

    args = parser.parse_args()

    from pipeline import detect_books, normalize_books, ocr_crops

    if args.stage == "detect":
        if not args.image:
            parser.error("--stage detect requires an image path")
        if not os.path.isfile(args.image):
            print(f"Error: image file not found: {args.image}", file=sys.stderr)
            sys.exit(1)
        result = detect_books(args.image)
        _output_result(result, args.output)

    elif args.stage == "ocr":
        if args.input_json:
            with open(args.input_json) as f:
                crops = json.load(f)
        elif args.image:
            log.info("No --input-json provided, running detection first...")
            crops = detect_books(args.image)
        else:
            parser.error("--stage ocr requires --input-json or an image path")
        result = ocr_crops(crops)
        _output_result(result, args.output)

    elif args.stage == "normalize":
        if not args.input_json:
            parser.error("--stage normalize requires --input-json (stage2 OCR output)")
        with open(args.input_json) as f:
            ocr_results = json.load(f)
        result = normalize_books(ocr_results)
        _output_result(result, args.output)

    else:
        # Full legacy pipeline
        if not args.image:
            parser.error("image path is required for full pipeline")
        if not args.reader_profile_id:
            parser.error("--reader-profile-id is required for full pipeline")
        if not os.path.isfile(args.image):
            print(f"Error: image file not found: {args.image}", file=sys.stderr)
            sys.exit(1)

        reader_context = get_reader_context_from_db(args.reader_profile_id)
        result = run_pipeline(args.image, reader_context, args.reader_comment)
        _output_result(result, args.output)


if __name__ == "__main__":
    main()
