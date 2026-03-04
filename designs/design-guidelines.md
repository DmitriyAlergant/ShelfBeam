# BookBeam — Design Guidelines

## Concept: "Magic Library"

A book discovery app that feels like stepping into an enchanted bookshop — not a sterile EdTech dashboard. Think **Wes Anderson meets a modern children's museum**: warm, tactile, slightly fantastical, but clean enough to feel premium.

---

## Aesthetic: Warm Maximalism with Paper Texture

Not flat. Not skeuomorphic. Something in between — **layered, tactile, with depth**. Cards feel like they're cut from thick stock paper. Backgrounds have subtle grain and warmth. Elements overlap and cast soft shadows like a pop-up book unfolding.

**Key words:** Tactile. Layered. Warm. Playful-but-smart. Storybook-modern.

---

## Typography

| Role | Font | Why |
|------|------|-----|
| **Display / Headers** | **Fredoka** (Google Fonts) | Rounded, bouncy, unmistakably playful — but legible and modern. Not babyish. |
| **Body / UI** | **Nunito** (Google Fonts) | Rounded sans-serif that pairs perfectly. Friendly readability at all sizes. |
| **Accent / Badges** | **Fredoka SemiBold** uppercase, tracked out | For tags, status pills, tab labels |

Both are free, both work great in React Native via expo-font.

---

## Color Palette

Built around a **warm cream base** (not white!) with rich, saturated accents that pop like book covers on a wooden shelf.

| Token | Hex | Role |
|-------|-----|------|
| `--bg-cream` | `#FFF8F0` | Primary background — warm, papery |
| `--bg-warm` | `#F5EDE3` | Card backgrounds, secondary surfaces |
| `--shelf-brown` | `#8B6914` | Warm wood tone — nav bars, dividers, grounding elements |
| `--beam-yellow` | `#FFD234` | **Primary action color** — the "beam" of light. CTAs, highlights, scan button |
| `--page-teal` | `#2EC4B6` | Secondary accent — success states, recommendations, "top pick" |
| `--spine-coral` | `#FF6B6B` | Tertiary accent — reactions, alerts, love/heart states |
| `--ink-dark` | `#2D2319` | Primary text — rich dark brown, not pure black |
| `--ink-medium` | `#7A6B5D` | Secondary text, placeholders |
| `--ink-light` | `#B8A99A` | Disabled, tertiary text |
| `--shadow` | `rgba(45,35,25,0.08)` | Warm shadow tone (never cool gray) |

**Rule:** Never use pure white (`#FFF`) or pure black (`#000`). Everything stays warm.

---

## Visual Language

### Cards & Surfaces
- **Rounded corners:** `16px` for cards, `12px` for buttons, `24px` for modals
- **Layered depth:** Cards sit on surfaces with `4-8px` warm shadows — feels like paper stacked on a desk
- **Subtle paper grain:** A faint noise texture overlay on main backgrounds (CSS or a tiled PNG at 3-5% opacity)

### The "Beam"
The app's signature visual — a **warm golden glow/spotlight effect** that appears:
- Behind the scan button (pulsing soft glow)
- As a radial gradient behind recommended books ("beamed" = spotlighted)
- On the processing screen as a sweeping light animation
- This is the *one thing* people will remember

### Illustrations & Empty States
- **No stock illustrations.** Use oversized emoji or simple geometric book shapes built from colored rectangles (like abstract book spines)
- Empty states: a stack of colorful rectangles (book spines) with the beam shining on them

### Avatars
- Predefined set of **animal characters reading books** (owl, fox, cat, bear, bunny, dragon, etc.)
- Rendered in a consistent flat-with-depth style — think Duolingo character quality
- Each has a dominant color that becomes that reader's accent

### Animations & Motion
- **Page transitions:** Horizontal slide with slight scale (books sliding off a shelf)
- **Card entry:** Staggered fade-up, 50ms delay between items — like books appearing one by one
- **Scan button:** Persistent subtle pulse glow on the beam-yellow
- **Processing states:** A sweeping golden light beam moves left-to-right across the card, looping
- **Reactions:** Bounce-scale on tap (spring physics via `react-native-reanimated`)
- **Tab switches:** Crossfade, not slide

### Status & Processing
The scan pipeline (`detecting → reading → looking_up → recommending → done`) gets a **storybook progress** treatment:
- Horizontal stepper with small book icons
- Active step has the golden beam glow
- Completed steps get a warm checkmark
- Each step has a kid-friendly label: "Finding books..." → "Reading spines..." → "Learning about them..." → "Picking favorites..."

---

## Spacing & Layout

| Token | Value |
|-------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `24px` |

**Generous padding inside cards** (`20-24px`). Kids need bigger tap targets and breathing room. Minimum touch target: `44x44px`.

---

## Component Signatures

| Component | Distinctive Detail |
|-----------|-------------------|
| **Scan Button** | Oversized circle, beam-yellow, golden glow aura, camera icon |
| **Book Card** | Slight rotation (1-2°) on alternating cards, like casually placed on a table |
| **Recommendation Card** | Golden border-left or beam glow behind it — "spotlighted" |
| **Reaction Pills** | Emoji in a rounded warm-bg pill, bounces on select, highlighted with coral border |
| **Tab Bar** | Warm brown top border, cream background, active tab has beam-yellow underline |
| **Profile Avatar** | Circular with a thick beam-yellow ring when active |

---

## Summary — The 3 Things That Make It Memorable

1. **The Beam** — golden spotlight glow as the recurring visual motif everywhere
2. **Warm paper world** — cream/brown/grain textures that feel like a cozy library, never sterile
3. **Books as physical objects** — cards that feel like they have weight, slight rotations, stacked shadows, spine-like color bars
