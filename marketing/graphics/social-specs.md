---
title: ChatVibe AI Social Graphics Specifications
type: design-specs
brand:
  bg: "#0A0A0A"
  accent: "#E84025"
  text: "#F5F1EB"
  muted: "rgba(245,241,235,0.4)"
  font_display: Fraunces (italic, weight 900)
  font_body: DM Sans (weight 400-700)
---

# Social Graphics Specifications

## Brand System

| Token | Value |
|---|---|
| Background | `#0A0A0A` |
| Accent | `#E84025` (sharp orange-red) |
| Text primary | `#F5F1EB` (warm white) |
| Text muted | `rgba(245,241,235,0.40)` |
| Display font | Fraunces, italic, weight 900 |
| Body font | DM Sans, weight 400–700 |
| Border radius | 2–4px (sharp, not rounded) |
| Grid rule | Always asymmetric. Left-heavy or right-breakout. |

---

## Twitter/X Header (1500 × 500)

**Layout:** Horizontal, left-aligned content with right-side visual accent.

**Left zone (0–750px):**
- Y: 100px — Small label: `"POWERED BY OLLAMA"` in Fraunces, 14px, #E84025, letter-spacing 0.2em
- Y: 140px — Main headline in Fraunces italic 900: `"Image → Result"` at 64px, #F5F1EB
- Y: 215px — Second line: `"in 4.7s"` at 96px, color #E84025
- Y: 330px — Body in DM Sans 16px, muted: `"Local AI. Zero cloud. 100% private."`
- Y: 380px — GitHub link in DM Sans 13px: `"github.com/rafeyy-sxk"`

**Right zone (900–1500px):**
- Neural flow field particle animation screenshot (or static approximation)
- Low opacity (#E84025 at 6%) flowing particles on dark background
- Slight diagonal crop line from (750, 0) to (850, 500) in #E84025 at 15%

**Bottom strip (Y: 460–500):**
- Full width, #E84025 at 8% background
- Text: `"Built by Abdul Rafey · ChatVibe AI · v1.0.0"` — DM Sans 12px, muted

**Export:** PNG, no alpha, sRGB color profile

---

## Product Hunt Thumbnail (240 × 240)

**Layout:** Square, centered, bold.

**Background:** `#0A0A0A`

**Center element:**
- Large italic `"CV"` monogram in Fraunces 900, ~120px, #F5F1EB
- Orange-red diagonal rule behind it: 2px, from (20,220) to (220,20), #E84025

**Bottom-left:**
- `"ChatVibe AI"` in DM Sans 700, 14px, #F5F1EB
- `"< 5s"` in Fraunces 900, 20px, #E84025

**Border:** 1px solid rgba(232,64,37,0.2)

**Export:** PNG, 240×240, no alpha

---

## LinkedIn Banner (1584 × 396)

**Layout:** Ultra-wide, minimal, editorial.

**Left zone (0–700px):**
- Y: 80px — `"ChatVibe AI"` in Fraunces italic 900, 52px, #F5F1EB
- Y: 148px — `"Instant OCR + Local AI Analysis"` in DM Sans 600, 20px, muted
- Y: 200px — Divider line: 40px wide, 1px, #E84025
- Y: 220px — `"4.7s median · 100% local · $0/analysis"` in DM Sans 400, 14px, #E84025

**Center zone (700–1100px):**
- Three vertical stat columns:
  - `"< 5s"` / `"median analysis"` 
  - `"100%"` / `"local processing"`
  - `"$0"` / `"per analysis"`
- Each: Fraunces 900 56px for number, DM Sans 400 11px for label (muted, uppercase)

**Right zone (1100–1584px):**
- Neural flow particles (screenshot of hero-background.html)
- Fade to black at left edge (gradient: transparent → #0A0A0A, 100px)

**Export:** PNG, 1584×396, sRGB

---

## OG Image / Link Preview (1200 × 630)

**Layout:** 16:10 ratio, blog-card style.

**Top bar:**
- 8px tall, full width, solid #E84025

**Content area:**
- Padding: 64px all sides
- Y: 72px — `"ChatVibe AI"` label in DM Sans 700, 14px, #E84025, uppercase + letter-spacing
- Y: 110px — `"Image → Result in 4.7s"` in Fraunces italic 900, 72px, #F5F1EB, max-width 700px
- Y: 210px — `"Local Ollama AI. Zero cloud. 100% private."` in DM Sans 400, 22px, muted
- Y: 290px — Three stat pills (background: rgba(232,64,37,0.1), border: 1px solid rgba(232,64,37,0.25)):
  - `"< 5s median"` · `"100% local"` · `"$0 per analysis"`

**Bottom strip:**
- Y: 560px — `"Built by Abdul Rafey · github.com/rafeyy-sxk"` in DM Sans 400, 14px, muted

**Right accent:**
- API response mockup card (rotated -3deg, right-aligned):
  - Dark surface #141414, border rgba(232,64,37,0.15)
  - Shows: `{"status":"completed","processingMs":4712}`

**Export:** PNG, 1200×630, sRGB

---

## Generation Notes

All graphics should be generated using one of:
1. **Figma** — import brand tokens, use Auto Layout
2. **Canva** — custom dimensions, brand colors saved
3. **Node Canvas** (`npm i canvas`) — programmatic generation via script
4. **html2canvas** — screenshot the `hero-background.html` as a base layer

The `marketing/graphics/hero-background.html` file contains a working p5.js-equivalent 
particle system that can be screenshotted at any resolution for use as background elements.
