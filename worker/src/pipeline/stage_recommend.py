"""Stage 4: LLM-based personalized book recommendations from normalized book list + reader context."""

import json
import logging
import os
from datetime import datetime, timezone

import boto3

from .utils import create_openai_client, llm_call_with_json_retry

log = logging.getLogger("pipeline.recommend")

RECOMMEND_PROMPT = """\
You are a children's librarian AI assistant for the BookBeam app.

You have a list of books detected on a library bookshelf. Your job is to recommend \
the best books for this specific reader based on their profile, reading history, and \
the books available on the shelf. 

Reader profile:
{reader_context}
{reader_comment_section}
Books detected on the shelf:
{books_json}

Instructions:
- Pick up to 5 books from the list that are the best fit for this reader, as a ranked recommendation.
- For each pick, provide a short, fun, kid-friendly (if the reader is a child) reason why it's great for them.
- Write a brief overall recommendation summary (2-3 sentences, age-appropriate tone).
- Only recommend books from the provided list. Reference them by their index.
- If no books are a good fit, return an empty recommendations list and say so in the summary.
- It is OK to recommend less then 5 books. Presumably the reader is in a library and they can move on and scan another shelf.
- Consider the reader's age, interests, languages, and reading history when making picks.
- The reader's history may include emoji reactions and comments. The reader was given these emojis to express how they felt about each book: 👍 👎 ❤️ 🔥 😂 😢 😱 🤔 🤯 💤 😡. Use their reactions and comments to understand their tastes.
- Avoid recommending books the reader has already read or is currently reading (listed in their history).

Respond with ONLY valid JSON matching this schema:
{{
  "recommendations": [
    {{
      "book_index": 0,
      "rank": 1,
      "comment": "Short kid-friendly reason why this book is great for you!"
    }}
  ],
  "recommendation_summary": "Hey there! I found some awesome books on this shelf... (reword as needed)"
}}
"""


_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=os.environ["S3_ENDPOINT"],
            aws_access_key_id=os.environ["S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        )
    return _s3_client


def _dump_request_to_s3(scan_id: str, request_body: dict):
    """Dump the full recommendation request body to S3 for diagnostics."""
    bucket = os.environ["S3_BUCKET"]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"diagnostics/{scan_id}/recommend_request_{timestamp}.json"
    payload = json.dumps(request_body, indent=2, ensure_ascii=False)
    _get_s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=payload.encode("utf-8"),
        ContentType="application/json",
    )
    log.info("Dumped recommendation request to s3://%s/%s", bucket, key)


def recommend_books(
    normalized_books: list[dict],
    reader_context: str,
    reader_comment: str | None = None,
    openai_client=None,
    model: str | None = None,
    scan_id: str | None = None,
) -> dict:
    """Generate personalized recommendations from normalized books + reader context."""
    if openai_client is None:
        openai_client = create_openai_client()
    if model is None:
        model = os.environ["RECOMMENDATION_MODEL"]

    # Filter to only books with identified titles
    identified_books = [b for b in normalized_books if b.get("title")]
    log.info("Recommending from %d identified books (of %d total), model=%s",
             len(identified_books), len(normalized_books), model)

    if not identified_books:
        log.warning("No identified books to recommend from")
        return {
            "recommendations": [],
            "recommendation_summary": "I couldn't identify any books on this shelf. Try taking a clearer photo!",
        }

    books_json = json.dumps(
        [{"index": b["index"], "title": b["title"], "author": b.get("author")} for b in identified_books],
        indent=2,
        ensure_ascii=False,
    )

    reader_comment_section = ""
    if reader_comment:
        reader_comment_section = f'\nThe reader says: "{reader_comment}"\n'

    prompt = RECOMMEND_PROMPT.format(
        reader_context=reader_context,
        reader_comment_section=reader_comment_section,
        books_json=books_json,
    )

    messages = [{"role": "user", "content": prompt}]
    llm_kwargs = {"max_tokens": 2048, "temperature": 0.5}

    # Dump full request body to S3 for diagnostics
    if scan_id:
        _dump_request_to_s3(scan_id, {
            "model": model,
            "messages": messages,
            **llm_kwargs,
        })

    parsed = llm_call_with_json_retry(
        openai_client,
        model=model,
        messages=messages,
        **llm_kwargs,
    )

    recommendations = parsed.get("recommendations", [])
    summary = parsed.get("recommendation_summary", "")

    log.info("Got %d recommendations", len(recommendations))
    return {
        "recommendations": recommendations,
        "recommendation_summary": summary,
    }
