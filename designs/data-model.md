# BookBeam — Data Model

## Entity Relationship

```
User (Clerk-managed)
 └── Reader Profile (1:1)
      ├── Scans (1:N)
      │    ├── Scan Books (1:N)  ──▶  Book (shared catalog)
      │    └── recommendation jsonb: ranked scan_books with comments
      └── Book History Entries (1:N)  ──▶  Book (shared catalog)
           reactions: jsonb emoji array on each entry
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

One per user. Editable from Profile screen.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → app_user, unique |
| name | text | Display name |
| avatar_key | text | Key into predefined avatar library |
| birth_year | smallint | e.g. 2015 |
| gender | text | `M`/`F` or null |
| languages | text[] | Array of language codes, e.g. `{en, ru}` |
| interests | text[] | Free-form tags, e.g. `{dinosaurs, space, magic}` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### book

Shared catalog of known books. Populated by processing pipeline (metadata lookups) and LLM parsing from story entries. Deduplicated by ISBN when available.

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
| recommendation | jsonb | Nullable, LLM output — ranked scan_book refs with per-book comments (see below) |
| recommendation_summary | text | Nullable, LLM overall summary/intro text |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`recommendation` jsonb structure:**
```json
[
  { "scan_book_id": "uuid", "rank": 1, "comment": "Perfect for you because..." },
  { "scan_book_id": "uuid", "rank": 2, "comment": "You might also enjoy..." }
]
```
Overwritten on re-run.

---

### scan_book

Books detected in a scan. Join between scan and book catalog.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| scan_id | uuid | FK → scan |
| book_id | uuid | FK → book |
| confidence | real | Detection/OCR confidence 0.0–1.0 |
| spine_bbox | jsonb | Nullable, bounding box coordinates on original image |
| spine_img  | binary | image bytes from the detected spine bbox |
| raw_ocr_text | text | Raw text extracted from spine — useful for debugging |
| created_at | timestamptz | |

---

### book_history_entry

A book in the reader's personal history. Source is either a scan pick or an LLM-parsed story entry.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reader_profile_id | uuid | FK → reader_profile |
| book_id | uuid | FK → book |
| source | text | `scan` · `story` |
| source_id | uuid | Nullable — FK → scan.id when source=scan |
| reactions | jsonb | Array of emoji strings, e.g. `["👍","👍","🔥","❤️"]` — dupes allowed |
| status | text | `reading` · `finished` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Application-level dedup: one entry per book per reader (enforced in code, not DB).

---

## Predefined Enums / Constants (application-level)

**Scan statuses:** `uploading` → `detecting` → `reading` → `looking_up` → `recommending` → `done` | `failed`

**Book history sources:** `scan` · `story`

**Book history statuses:** `reading` · `finished`

**Reaction emoji set** (predefined, extensible):
`👍` `👎` `❤️` `🔥` `😂` `😢` `😱` `🤔` `🤯` `💤` `😡`

---

## Notes

- **No recommendation history**: `scan.recommendation` jsonb is overwritten on re-run — no history of past recommendations.
- **Book deduplication**: ISBN is the primary dedup key. For books without ISBN (OCR-only, LLM-parsed), dedup by normalized title+author. Exact strategy TBD in processing pipeline.
- **Clerk sync**: Minimal — we just need `clerk_id` to link auth sessions to our `user` row. Webhook or on-first-login creation.
- **Images**: `scan.image_url` stores a path to object storage (S3/local volume for hackathon). Upload happens before processing begins.
