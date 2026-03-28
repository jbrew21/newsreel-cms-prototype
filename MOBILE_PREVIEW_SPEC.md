# Newsreel Mobile App — Slide Preview Specification

This document is the authoritative reference for building a **pixel-faithful web preview** of how a Newsreel story slide looks in the iOS/Android app. It is written for Claude (or any developer) working inside the CMS codebase.

---

## Purpose

Authors in the CMS need to see exactly how their story will render on a phone before publishing. The preview should simulate a real phone screen (375×812 reference, ~iPhone 13 viewport) and show a single slide at a time with swipe/arrow navigation between slides.

---

## Data Shape (from `/api/stories/:id`)

A slide from the API has this shape:

```ts
interface CmsSlide {
  id: string
  slide_index: number
  slide_headline_1: string | null   // Bold title shown above body text
  slide_content_1: string | null    // Main body text
  slide_headline_2: string | null   // Second bold title (below body, rare)
  slide_content_2: string | null    // Alternate body text (used if content_1 absent)
  slide_quote: string | null        // Not shown in ContentSlide (QuoteSlide only)
  slide_media_source: string | null // Source credit label, top-left
  portrait_video: boolean           // If true + video media → fullscreen portrait mode
  media: Array<{
    role: "hero" | string
    url: string                     // Full resolved media URL
    media_type: "image" | "video"
  }>
  captions: Array<{ start: number; end: number; text: string }> | null
}

interface CmsStory {
  id: string
  title: string
  authors: CmsAuthor[]
  slides: CmsSlide[]
  // ...other fields
}

interface CmsAuthor {
  id: string
  first_name: string
  last_name: string | null
  avatar_url: string | null
  role: string | null
  organization: string | null
}
```

**Hero media selection:** use `media.find(m => m.role === "hero") ?? media[0]`

---

## Design Tokens (exact values from the app)

```
Colors:
  black:       #000000   ← slide background
  white:       #FFFFFF   ← headline + body text
  paper:       #F0F0F0   ← source label text
  lead:        #1F1F1F   ← avatar fallback bg
  newsreelRed: #FF6343   ← progress ring fill
  green:       #1AAD17   ← progress ring when complete
  ash:         #898989   ← disabled icon tint

Chat bubble background: rgba(30, 58, 95, 0.4)   ← dark blue glass
Chat bubble blur tint: "dark" (simulated with backdrop-filter: blur(30px))

Author badge background: rgba(0, 0, 0, 0.15)
Author badge blur: "dark" (same treatment)

Background overlay (over media): rgba(0,0,0,0.6) opacity
Background blur: intensity=10 (light blur, ~4px)

Fonts:
  Headlines: DMSans-SemiBold  (web fallback: "DM Sans", sans-serif, weight 600)
  Body text:  DMSans-Regular  (web fallback: "DM Sans", sans-serif, weight 400)
  Author name: DMSans-Regular weight 500

Font sizes (already scaled, use these directly):
  slideHeadline: 20.8px  (26 × 0.8), lineHeight: 27.2px  (34 × 0.8)
  slideContent:  16px    (20 × 0.8), lineHeight: 21.6px  (27 × 0.8)
  mediaSource:   12.5px,             lineHeight: 17.5px
  authorName:    12px

Spacing (use these for padding/margin):
  xs: 4px  sm: 8px  md: 16px  lg: 24px  xl: 32px

Border radius:
  chatBubble:   16px (lg)
  authorBadge:  20px (pill)
  avatar:       50% (circle)
```

---

## Slide Layout — Three Modes

### Mode A: Image Slide (media_type = "image")

```
┌─────────────────────────────┐  ← black background (#000)
│                             │
│  [blurred+dimmed bg image]  │  ← full screen, blur ~4px, overlay opacity 0.6
│                             │
│                             │
│  [top image — full width]   │  ← contains image, starts ~130px from top
│    (aspect ratio preserved, │    (below progress bar area ~70px + 60px gap)
│     resizeMode: contain)    │
│                             │
│                             │
│  ┌─────────────────────┐    │  ← chat bubble, bottom-left, max-width 87%
│  │  HEADLINE TEXT       │    │    glass: rgba(30,58,95,0.4) + backdrop-blur(30px)
│  │  body content here   │    │    borderRadius: 16px, padding: 16px
│  │  lorem ipsum dolor   │    │    shadow: 0 4px 8px rgba(0,0,0,0.4)
│  └─────────────────────┘    │
│                             │
│  [SOURCE LABEL]             │  ← top-left, below progress bar ~+8px
│  ╭──────────────────╮       │
│  │ 🖼 Author Name   │       │  ← bottom-left author badge pill, ~20px from bottom
│  ╰──────────────────╯       │
└─────────────────────────────┘
```

### Mode B: Video Slide (media_type = "video", portrait_video = false)

Identical layout to Mode A, except:
- Background: blurred looping video (muted) instead of blurred image
- Top media: `<video>` at `aspect-ratio: 16/9`, full width, `object-fit: cover`
- Show a static thumbnail / poster frame while video loads (show spinner)

### Mode C: Portrait Video Slide (media_type = "video", portrait_video = true)

```
┌─────────────────────────────┐  ← black background
│                             │
│                             │
│   VIDEO fills entire screen │  ← object-fit: cover, 100% w/h
│      (portrait aspect)      │
│                             │
│                             │
│  [SOURCE LABEL top-left]    │
│                             │
│░░░░░░░░ gradient ░░░░░░░░░│  ← LinearGradient bottom 70% of screen
│  ┌─────────────────────┐    │    transparent → rgba(0,0,0,0.6) → rgba(0,0,0,0.85)
│  │  HEADLINE           │    │  ← chat bubble inside gradient, same glass style
│  │  body content       │    │
│  └─────────────────────┘    │
│  ╭──────────────────╮       │
│  │ 🖼 Author Name   │       │  ← bottom-left, ~20px from bottom
│  ╰──────────────────╯       │
└─────────────────────────────┘
```

---

## Component Breakdown

### 1. Phone Frame (outer shell)
- Size: 375px wide × 812px tall (reference, scale to fit viewport)
- Background: `#000000`
- Overflow: hidden
- Optional: add a device bezel frame image around it for polish

### 2. Progress Bar (top of screen)
- Position: fixed at top, height ~7px
- `top = safeAreaTop + 56px` (approximate: treat as `top: 64px` for web)
- Shows slide progress: `(currentIndex + 1) / totalSlides` as a white bar on dark track
- Full width, no border radius

### 3. Source Label (`slide_media_source`)
- Only render if non-empty string
- Position: `absolute`, `left: 20px`, `top: ~78px` (below progress bar + 8px gap)
- Style: `font-size: 12.5px`, `color: #F0F0F0`, `font-family: "DM Sans"`, `font-weight: 400`
- No background, no border

### 4. Background Media
- `position: absolute`, fills entire slide below progress bar (`top: 64px, bottom: 0`)
- Image: `<img>` with `object-fit: cover`, `width: 100%, height: 100%`
- Video: `<video autoPlay loop muted playsInline>`, same sizing
- On top: `backdrop-filter: blur(4px)` + `background: rgba(0,0,0,0.6)` overlay div

### 5. Top Media (main visual)
- Position: absolute, `top: 130px` (below progress bar + generous gap)
- Full width: `width: 100%`
- Image: `<img style="width:100%; object-fit: contain">`, height auto from natural aspect ratio
- Video (landscape): `<video>` with `aspect-ratio: 16/9`, `width: 100%`, `object-fit: cover`
- Video (portrait/fullscreen): `position: absolute, inset: 0`, `object-fit: cover`

### 6. Chat Bubble (text content)
- Position: `absolute, bottom: 0, left: 0, right: 0`
- Inner alignment: `display: flex, flex-direction: column, justify-content: flex-end, align-items: flex-start, padding-bottom: 80px` (leave space for author badge)
- Horizontal padding: `16px` left/right

**Bubble box itself:**
```css
background: rgba(30, 58, 95, 0.4);
backdrop-filter: blur(30px);
-webkit-backdrop-filter: blur(30px);
border-radius: 16px;
padding: 16px;
max-width: 87%;
box-shadow: 0 4px 8px rgba(0,0,0,0.4);
margin-bottom: 16px;
```

**Headline** (`slide_headline_1` or `slide_headline_2`):
```css
font-size: 20.8px;
line-height: 27.2px;
font-weight: 600;
color: #FFFFFF;
margin-bottom: 16px;
font-family: "DM Sans", sans-serif;
```

**Body text** (`slide_content_1` or `slide_content_2`):
```css
font-size: 16px;
line-height: 21.6px;
font-weight: 400;
color: #FFFFFF;
text-align: left;
font-family: "DM Sans", sans-serif;
```

**Logic:**
- If `slide_content_1` exists → show `slide_headline_1` (if any) + `slide_content_1` as body
- Else if `slide_content_2` exists → show `slide_headline_2` (if any) + `slide_content_2` as body
- If both headlines exist (rare), render: headline1 → content → spacer → headline2

### 7. Author Badge
- Position: `absolute, left: 20px, bottom: 20px`
- Max-width: 70% of slide width

**Pill container:**
```css
display: flex;
flex-direction: row;
align-items: center;
padding: 6px 10px;
border-radius: 20px;
background: rgba(0, 0, 0, 0.15);
backdrop-filter: blur(30px);
-webkit-backdrop-filter: blur(30px);
box-shadow: 0 2px 4px rgba(0,0,0,0.2);
```

**Avatar(s):**
- Size: 28px × 28px, `border-radius: 50%`
- Multiple authors: overlap by 30% (`left: index * 28px * 0.3`)
- Total avatar group width: `28 + (count-1) * 8.4px`
- `margin-right: 8px` from name
- Fallback (no avatar_url): dark grey circle `#1F1F1F` with white initials, `font-size: 16px, font-weight: 600`

**Name text:**
```css
font-size: 12px;
font-weight: 500;
color: #FFFFFF;
font-family: "DM Sans", sans-serif;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```
- 1 author: `"First Last"`
- 2+ authors: `"First Last and N others"`

---

## Slide Navigation Controls (outside the phone frame)

- Left/right arrow buttons OR dots indicator below the phone
- Show current slide index: `slide X of N`
- Keyboard: left/right arrow keys

---

## What NOT to Show in the Preview

These elements exist in the real app but should be **omitted from the preview** (they are interactive controls, not content):

- AI button (bottom-center)
- Mute / CC / Share action buttons (right side)
- Story progress ring
- Social media sticker icons
- Translation button
- Whisper captions overlay
- Story intro slide, completion slide, quiz slide, poll slide (these are separate slide types — only show `ContentSlide` equivalent)

---

## Slide Type Routing

The CMS `slides` array contains only content slides. In the app, additional slide types are prepended/appended:
- **Intro slide** (index 0 in app) — NOT in CMS slides array, skip
- **Content slides** — these are the CMS slides, show them
- **Quiz/Poll slides** — shown after content, handled by separate app components

For the preview, **only render CMS content slides** in order of `slide_index`.

---

## Reference: How Data Fields Map to UI

| API Field | UI Element | Notes |
|---|---|---|
| `slide_media_source` | Source label, top-left | Hidden if empty/null |
| `media[hero].url` + `media_type` | Background + top media | First item if no hero role |
| `portrait_video: true` | Video fills fullscreen | Only applies when media_type=video |
| `slide_headline_1` | Bold title in bubble | Shown above content_1 |
| `slide_content_1` | Body text in bubble | Primary content field |
| `slide_headline_2` | Second bold title | Below content_1, rare |
| `slide_content_2` | Alternate body | Used when content_1 absent |
| `authors[0].avatar_url` | Circular avatar in badge | Initials fallback if null |
| `authors[0].first_name + last_name` | Name text in badge | Truncated with ellipsis |
| `captions` | Not shown in preview | Realtime whisper captions only |

---

## Implementation Notes for CMS

- The preview component lives entirely client-side — fetch story from `/api/stories/:id`
- Use `next/image` with `unoptimized` for media or plain `<img>` tags
- `backdrop-filter: blur()` requires the parent to have `overflow: hidden` to work correctly
- Scale the phone frame down on smaller screens using `transform: scale()` on the outer container
- Font: import "DM Sans" from Google Fonts (`weights: 400, 500, 600`) or use system sans-serif fallback
- The slide container should be `position: relative, overflow: hidden` to contain absolute children
