# BookBeam — Screen Map

## Navigation Structure

**Auth Gate** (Clerk) → **Tab Navigator** (3 tabs)

```
┌─────────────────────────────────────────────────┐
│                  AUTH GATE                       │
│  ┌───────────┐    ┌──────────────────────────┐  │
│  │  Welcome   │───▶│  Sign In / Sign Up       │  │
│  │  Screen    │    │  (Clerk managed)         │  │
│  └───────────┘    └──────────────────────────┘  │
└────────────────────────┬────────────────────────┘
                         ▼
         ┌──── TAB NAVIGATOR ────┐
         │                       │
    ┌────┴────┐  ┌───────┐  ┌───┴────┐
    │  Scan   │  │ Books  │  │Profile │
    │   📷    │  │  📚   │  │  👤    │
    └────┬────┘  └───┬───┘  └───┬────┘
         │           │          │
         ▼           ▼          ▼
```

---

## Tab 1: Scan (Home / Primary Action)

### Screen 1.1 — Scan Home (list of past scans)
- Big "Scan a Shelf" CTA button at top
- List of recent scans as cards (thumbnail, date, book count, status)
- Each card tappable → Scan Detail

### Screen 1.2 — Camera (modal/fullscreen)
- Camera viewfinder with capture button
- Optional: gallery pick
- After capture → navigates to Scan Detail with "Processing..." state

### Screen 1.3 — Scan Detail (the core screen)
- Shelf photo at top (collapsible)
- Processing status indicator (detecting → reading → looking up → recommending)
- **Detected Books List** — each book as a card:
  - Cover thumbnail (from metadata lookup), title, author
  - "Take this one" button (→ adds to Book History)
- **Reader Comment** — editable text field ("What are you looking for today?")
- **LLM Recommendation Panel**:
  - Personalized recommendation text with reasoning
  - "Re-run" button to get a fresh recommendation
  - Highlighted "top pick" books from the shelf

---

## Tab 2: My Books (Book History)

### Screen 2.1 — Book History
- Sections: "Currently Reading" / "Finished" (or just a flat list for hackathon)
- Each book card shows:
  - Cover, title, author
  - Source tag: "From scan" or "Told us about"
  - Emoji reactions displayed as a row
- Tap a book → Book Detail
- "Tell us what you've read" button → Story Entry screen

### Screen 2.3 — Story Entry ("Tell us what you've read")
- Large freeform text area — prompt: "Tell us about books you've read! What did you like? What didn't you like?"
- **Microphone button for dictation** (encouraged — kids talk easier than type)
- Examples as placeholder/hints: "I read Harry Potter and loved the magic parts but it was a little scary..."
- Submit sends raw text to backend LLM which parses and returns:
  - Extracted books (title, author via metadata lookup)
  - Inferred reactions/sentiment per book
  - Reading status (finished, in progress)
- **Confirmation screen**: shows parsed results as editable cards before merging
  - Each book card: title, author, inferred reactions (editable)
  - User can remove incorrectly parsed books, adjust reactions
  - "Looks good!" confirms → merges into Book History

### Screen 2.2 — Book Detail (modal or push screen)
- Cover image, title, author, description
- **Reaction picker**: grid of predefined emojis, tap to add (multiple of same allowed)
- Current reactions shown as pill badges with counts
- "Remove from history" option

---

## Tab 3: Profile

### Screen 3.1 — Reader Profile
- Avatar (tap to change from predefined library — grid picker)
- Name (editable)
- Birth Year (picker)
- Gender (selector)
- Languages Spoken (multi-select chips)
- Interests (tag input or chips)

---

## Screen Summary

| # | Screen | Type |
|---|--------|------|
| 1 | Welcome / Splash | Auth gate |
| 2 | Sign In/Up | Clerk |
| 3 | Scan Home | Tab 1 - list |
| 4 | Camera | Modal |
| 5 | Scan Detail | Push from list |
| 6 | Book History | Tab 2 - list |
| 7 | Book Detail | Modal/push |
| 8 | Story Entry | Modal - dictation/text |
| 9 | Story Confirmation | Push from Story Entry |
| 10 | Profile | Tab 3 - form |

**10 screens total**

---

## Key UX Decisions

1. **Scan tab is the default/home tab** — the primary action should be front and center
2. **Scan Detail is the richest screen** — detected books + recommendations. Worth the most design effort
3. **Reactions are emoji-tap, not rating** — low friction for kids, playful, supports multiples
4. **Profile is a single scrollable form** — no sub-screens needed
5. **No recommendation history** — each scan's recommendation is live/current only
6. **"Tell us what you've read"** — kids dictate/type a freeform story about their reading. Backend LLM parses into structured book entries with inferred reactions. Confirmation step before merge into history
