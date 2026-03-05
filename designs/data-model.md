# BookBeam — Data Model

## Entity Relationship

```
User (Clerk-managed)
 └── Reader Profile (1:N)
      ├── Scans (1:N)
      │    ├── detected_books jsonb: array with book_id refs ──▶ Book
      │    └── recommendation jsonb: ranked refs into detected_books
      └── Book History Entries (1:N)  ──▶  Book (shared catalog)
           reactions: jsonb emoji array on each entry
Book
```

---

## Tables

### app_user

Clerk handles auth. We store a minimal local record to own relational data.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| clerk_id | text | From Clerk webhook/sync |
| created_at | timestamptz | |

---

### reader_profile

Multiple per app_user (one parent account → many kid readers). Managed from Profile Picker + Profile screen.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → app_user |
| name | text | Display name |
| avatar_key | text | Key into predefined avatar library |
| age | smallint | 3–18 |
| grade | smallint | 0 (K) – 12 |
| gender | text | `M`/`F` or null |
| languages | text[] | Array of language codes, e.g. `{en, ru}` |
| interests | text[] | Free-form tags, e.g. `{dinosaurs, space, magic}` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### book

Shared catalog of known books. Populated by processing pipeline (metadata lookups) and LLM parsing from reading log entries. Deduplicated by ISBN when available.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| title | text | Not null |
| author | text | Nullable (unknown from OCR sometimes) |
| isbn | text | Nullable |
| cover_url | text | Nullable, from metadata API |
| cover_img | bytea | Nullable, raw cover image bytes if obtained |
| raw_metadata | jsonb | Nullable, full metadata API response dump |
| created_at | timestamptz | |

---

### scan

A photo of a bookshelf submitted by a reader + workflow pipeline it brings forth

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reader_profile_id | uuid | FK → reader_profile |
| image_url | text | Stored image path/URL |
| processing_task_id | uuid | |
| processing_task_started | timestampz | | 
| processing_status | text | `detecting` · `reading` · `looking_up` · `recommending` · `done` · `failed` |
| reader_comment | text | Nullable, editable — "What are you looking for today?" |
| detected_books | jsonb | Nullable, array of detected books from pipeline (see below) |
| recommendation | jsonb | Nullable, LLM ranked recommendations referencing detected_books (see below) |
| recommendation_summary | text | Nullable, LLM overall summary/intro text |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`detected_books` jsonb structure:**
```json
[
  {
    "index": 0,
    "book_id": "uuid",
    "confidence": 0.92,
    "spine_bbox": [x, y, w, h],
    "spine_img": "base64...",
    "raw_ocr_text": "Harry Potter and the..."
  }
]
```

**`recommendation` jsonb structure:**
```json
[
  { "book_index": 0, "rank": 1, "comment": "Perfect for you because..." },
  { "book_index": 2, "rank": 2, "comment": "You might also enjoy..." }
]
```
`book_index` references `detected_books[].index`. Overwritten on re-run.

---

### book_history_entry

A book in the reader's personal history. Source is either a scan pick or an LLM-parsed reading log entry.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reader_profile_id | uuid | FK → reader_profile |
| book_id | uuid | FK → book |
| source | text | `scan` · `reading_log` |
| source_id | uuid | Nullable — FK → scan.id when source=scan |
| comment | text | Nullable, freeform reader comment about the book |
| reactions | jsonb | Array of emoji strings, e.g. `["👍","🔥","❤️"]` — toggle on/off |
| status | text | `reading` · `finished` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Application-level dedup: one entry per book per reader (enforced in code, not DB).

---

## Predefined Enums / Constants (application-level)

**Scan statuses:** `uploading` → `detecting` → `reading` → `looking_up` → `recommending` → `done` | `failed`

**Book history sources:** `scan` · `reading_log`

**Book history statuses:** `reading` · `finished`

**Reaction emoji set** (predefined, extensible):
`👍` `👎` `❤️` `🔥` `😂` `😢` `😱` `🤔` `🤯` `💤` `😡`

---

## Notes

- **No recommendation history**: `scan.recommendation` jsonb is overwritten on re-run — no history of past recommendations.
- **Book deduplication**: ISBN is the primary dedup key. For books without ISBN (OCR-only, LLM-parsed), dedup by normalized title+author. Exact strategy TBD in processing pipeline.
- **Clerk sync**: Minimal — we just need `clerk_id` to link auth sessions to our `user` row. Webhook or on-first-login creation.
- **Images**: `scan.image_url` stores a path to object storage (S3/local volume for hackathon). Upload happens before processing begins.
