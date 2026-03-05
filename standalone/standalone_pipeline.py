"""Standalone BookBeam pipeline: image -> detection -> OCR -> recommendations.

Runs locally without Docker or the backend API. Reads reader profile + history
directly from the local Postgres DB. Does NOT create a scan entity.

Usage:
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid>
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid> --reader-comment "adventure books"
    python worker/src/standalone_pipeline.py path/to/shelf.jpg --reader-profile-id <uuid> -o results.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import date

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("standalone")


def _get_database_url() -> str:
    return os.environ["DATABASE_URL"]


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
    parser.add_argument("--stage", choices=["detect", "ocr", "normalize", "recommend"], help="Run a single pipeline stage")
    parser.add_argument("--input-json", help="Input JSON file from a previous stage (for --stage ocr, etc.)")
    parser.add_argument("--reader-profile-id", help="UUID of the reader_profile to load from the DB")
    parser.add_argument("--reader-comment", help="What the reader is looking for")
    parser.add_argument("--output", "-o", help="Write JSON results to this file instead of stdout")

    args = parser.parse_args()

    from pipeline import detect_books, normalize_books, ocr_crops, recommend_books, run_full_pipeline

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

    elif args.stage == "recommend":
        if not args.input_json:
            parser.error("--stage recommend requires --input-json (stage3 normalize output)")
        if not args.reader_profile_id:
            parser.error("--stage recommend requires --reader-profile-id")
        with open(args.input_json) as f:
            normalized_books = json.load(f)
        reader_context = get_reader_context_from_db(args.reader_profile_id)
        log.info("Reader context:\n%s", reader_context)
        result = recommend_books(normalized_books, reader_context, args.reader_comment)
        _output_result(result, args.output)

    else:
        # Full 4-stage pipeline via orchestrator
        if not args.image:
            parser.error("image path is required for full pipeline")
        if not args.reader_profile_id:
            parser.error("--reader-profile-id is required for full pipeline")
        if not os.path.isfile(args.image):
            print(f"Error: image file not found: {args.image}", file=sys.stderr)
            sys.exit(1)

        reader_context = get_reader_context_from_db(args.reader_profile_id)
        result = run_full_pipeline(args.image, reader_context, args.reader_comment)
        _output_result(result, args.output)


if __name__ == "__main__":
    main()
