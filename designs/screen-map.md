# BookBeam — Screen Map

## Navigation Structure

**Auth Gate** (Clerk) → **Profile Picker** → **Tab Navigator** (3 tabs)

```
┌─────────────────────────────────────────────────┐
│                  AUTH GATE                       │
│  ┌───────────┐    ┌──────────────────────────┐  │
│  │  Welcome   │───▶│  Sign In / Sign Up       │  │
│  │  Screen    │    │  (Clerk managed)         │  │
│  └───────────┘    └──────────────────────────┘  │
└────────────────────────┬────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │   Who's Reading?    │
              │                     │
              │  [Avatar] [Avatar]  │
              │   Emma     Jake     │
              │                     │
              │      [ + New ]      │
              └─────────┬───────────┘
                        ▼
┌───────────────────────────────────────────────┐
│  TOP BAR: [Avatar+Name ▼]           [Log out] │
│  ─────────────────────────────────────────────│
│         ┌──── TAB NAVIGATOR ────┐             │
│         │                       │             │
│    ┌────┴────┐  ┌───────┐  ┌───┴────┐        │
│    │  Scan   │  │ Books  │  │Profile │        │
│    │   📷    │  │  📚   │  │  👤    │        │
│    └────┬────┘  └───┬───┘  └───┬────┘        │
└─────────┴───────────┴───────────┴─────────────┘
```

### Profile Switcher (persistent top bar)
- Shows active reader's **avatar + name** in top-left of every screen
- Tap to open dropdown/bottom sheet: list of reader profiles + "Add reader" option
- Switching profiles reloads all tab data for the selected reader
- On first login (no profiles yet) → forced into "Who's Reading?" picker which redirects to Profile creation

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
- "Tell us what you've read" button → Reading Log Entry screen

### Screen 2.3 — Reading Log Entry ("Tell us what you've read")
- Large freeform text area — prompt: "Tell us about books you've read! What did you like? What didn't you like?"
- **Microphone entry suyggested** (use built-in OS dictation)
- Examples as placeholder/hints: "I read Harry Potter and loved the magic parts but it was a little scary..."
- Submit sends raw text to backend LLM which parses and returns:
  - Extracted books (title, author via metadata lookup)
  - Inferred reactions/sentiment per book
  - Reading status (finished, in progress)
- **Reading Log Confirmation screen**: shows parsed results as editable cards before merging
  - Each book card: title, author, inferred reactions (editable)
  - User can remove incorrectly parsed books, adjust reactions
  - "Looks good!" confirms → merges into Book History

### Screen 2.2 — Book Detail (modal or push screen)
- Cover image, title, author, description
- **Reaction picker**: grid of predefined emojis, tap to toggle on/off
- Active reactions shown as highlighted pills
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
- Freeform note

---

## Screen Summary

| # | Screen | Type |
|---|--------|------|
| 1 | Welcome / Splash | Auth gate |
| 2 | Sign In/Up | Clerk |
| 3 | Who's Reading? (Profile Picker) | Post-auth gate / switcher |
| 4 | Scan Home | Tab 1 - list |
| 5 | Camera | Modal |
| 6 | Scan Detail | Push from list |
| 7 | Book History | Tab 2 - list |
| 8 | Book Detail | Modal/push |
| 9 | Reading Log Entry | Modal - dictation/text |
| 10 | Reading Log Confirmation | Push from Reading Log Entry |
| 11 | Profile | Tab 3 - form |

**11 screens total**

---

## Key UX Decisions

1. **Scan tab is the default/home tab** — the primary action should be front and center
2. **Scan Detail is the richest screen** — detected books + recommendations. Worth the most design effort
3. **Reactions are emoji toggle, not rating** — low friction for kids, playful, tap to add/remove
4. **Profile is a single scrollable form** — no sub-screens needed
5. **No recommendation history** — each scan's recommendation is live/current only
6. **"Tell us what you've read"** — kids dictate/type a freeform reading log about their reading. Backend LLM parses into structured book entries with inferred reactions. Confirmation step before merge into history
