# Daycare Daily Report System — Design System

Working name: **Littlelog**. This is a demo portfolio project.
Open `design-system.html` in a browser to see every token and component rendered.

---

## 1. Design direction: "Warm Morning"

The app serves three very different people. The design has to work for all three:

| Who | Situation | What the design must do |
|---|---|---|
| **Teacher** | On the floor, one hand holding a child, 20 seconds free | Huge touch targets, one obvious action (record), almost no typing |
| **Parent** | At work, opens the report on their phone at 4:45 PM | Feel warm and personal, like a note from someone who knows their child |
| **Director** | At a desk, responsible for safety and licensing | Calm, dense, trustworthy; incidents impossible to miss |

**Personality:** warm, calm, trustworthy, quietly playful. It should feel like a well-run, sunlit classroom, not a toy store and not a hospital.

**What we avoid:**
- Rainbow "kiddie" UI, cartoon fonts, Comic-style rounded type
- Cold clinical blue/grey SaaS look
- Red anywhere except real safety signals (red means incident, nothing else)

---

## 2. Color

### Core palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBF7F0` (cream) | `#171412` | Page background |
| `--surface` | `#FFFFFF` | `#221E1B` | Cards, sheets |
| `--surface-2` | `#F4EEE4` | `#2B2622` | Inset areas, inputs, table stripes |
| `--border` | `#E7DFD2` | `#3A332E` | Dividers, card outlines |
| `--ink` | `#2A2522` | `#F3EEE7` | Primary text |
| `--ink-2` | `#6B625B` | `#B5ABA2` | Secondary text |
| `--ink-3` | `#9A9088` | `#8A8079` | Hints, timestamps |
| `--primary` | `#2F6F62` (deep sage) | `#6FB3A3` | Main actions, links, active nav |
| `--primary-soft` | `#E3F0EC` | `#1F3A34` | Selected states, primary tints |
| `--accent` | `#E8955A` (apricot) | `#F0A874` | Record button, warm highlights, parent greeting |
| `--accent-soft` | `#FCEBDD` | `#3D2A1D` | Accent tints |

### Status colors

| Token | Light | Use |
|---|---|---|
| `--success` | `#3E8E5A` | Sent, approved |
| `--warning` | `#C98A1B` | Pending review, `needs_review` names |
| `--danger` | `#C8412E` | Incidents, rejected, serious alert |
| `--danger-soft` | `#FBE6E2` | Incident card background |

### Log-entry category colors

Each entry type gets one hue so teachers can scan a child's day at a glance. Always paired with an icon and label; color alone never carries meaning.

| Type | Color | Soft bg | Icon |
|---|---|---|---|
| Meal | `#D9822B` | `#FBEBD9` | 🍎 bowl |
| Nap | `#5B6FB5` | `#E6E9F6` | 🌙 moon |
| Diaper / toilet | `#3C8E9A` | `#DDF0F2` | 💧 drop |
| Activity | `#8A5FB0` | `#EFE6F6` | 🎨 palette |
| Mood | `#C2A21A` | `#F7F0D2` | 🙂 face |
| Note | `#6B625B` | `#F0EBE4` | 📝 note |
| Incident | `#C8412E` | `#FBE6E2` | ⚠ triangle |

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | **Fraunces** (soft serif, `opsz` + `SOFT` axes) | Warmth and personality. Used for page titles, child names, parent report greeting |
| UI / body | **Plus Jakarta Sans** | Friendly geometric sans, very legible on small screens |
| Numbers / times | Plus Jakarta Sans with `font-variant-numeric: tabular-nums` | Times line up in nap/diaper lists |

### Type scale

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 40 / 44 | Fraunces 600 | Director dashboard hero numbers, parent greeting |
| `h1` | 30 / 36 | Fraunces 600 | Page titles |
| `h2` | 22 / 28 | Fraunces 600 | Section titles, child name on card |
| `h3` | 17 / 24 | Jakarta 700 | Card titles |
| `body` | 16 / 24 | Jakarta 400 | Default text (never smaller on mobile) |
| `body-sm` | 14 / 20 | Jakarta 500 | Secondary info, table cells |
| `caption` | 12 / 16 | Jakarta 600, +0.04em, uppercase | Labels, badges, eyebrows |

---

## 4. Spacing, shape, depth

- **Spacing scale (4px base):** 4, 8, 12, 16, 20, 24, 32, 40, 56, 72
- **Radius:** `sm 8px` (badges, inputs) · `md 14px` (buttons) · `lg 20px` (cards) · `xl 28px` (sheets, record panel) · `full` (avatars, pills, record button)
- **Shadows** (warm-tinted, never grey-blue):
  - `shadow-1`: `0 1px 2px rgba(60,40,20,.06), 0 1px 1px rgba(60,40,20,.04)` cards at rest
  - `shadow-2`: `0 6px 20px rgba(60,40,20,.10)` raised cards, menus
  - `shadow-3`: `0 16px 40px rgba(60,40,20,.16)` modals, bottom sheets
- **Touch targets:** minimum 48×48px everywhere; teacher primary actions 56px tall
- **Layout:** mobile max content width 480px; director desktop uses a 248px sidebar + fluid content (max 1280px)

---

## 5. Core components

| Component | Spec |
|---|---|
| **Button** | Primary (sage fill), Secondary (white + border), Ghost, Danger (red fill, incidents only). Heights 40 / 48 / 56. Radius 14 |
| **Record button** | 112px apricot circle, mic icon, "Hold to record" label below. While recording: pulsing ring, live timer, waveform bars, button turns deep red-orange `#D0663A` |
| **Child avatar** | Circle with initials on a pastel derived from the child's name. Photo shown only if `photo_consent = true` |
| **Entry chip / row** | Category color dot + icon + type label + detail + time (tabular, right-aligned). Swipe or tap to edit |
| **Child card (teacher)** | Avatar, name (Fraunces), room, small row of category icons showing what's logged today, "3 entries" count |
| **Needs-review card** | Warning-yellow left border, "Who is 'Sam'?" + child picker pills. Blocks sending until resolved |
| **Report card (parent)** | Cream paper look, Fraunces greeting "Hi! Emma had a great day today", entries as icon rows, teacher sign-off |
| **Incident card** | Danger-soft background, red left bar, status badge (Draft / Approved / Rejected), fields grid |
| **Serious alert banner** | Solid red, white text, phone icon, "Call parent now" button. Pinned to top of director dashboard |
| **Status badge** | Pill, caption type. Draft (grey), Pending (warning), Sent / Approved (success), Rejected / Incident (danger) |
| **Stat tile (director)** | Label (caption), big number (Fraunces display), small trend/context line |
| **Nav** | Teacher & parent: bottom tab bar (3–4 tabs). Director: left sidebar |

---

## 6. Voice & tone (UI copy)

- Talk like a kind, organized teacher: short, warm, specific.
- Parent reports: first name, positive framing, no jargon, emojis only as section icons.
- Incidents: calm and factual. Never cute. No emojis in incident reports.
- Privacy: other children are always "a friend", never named.
- Buttons say what happens: "Approve & send", "Approve incident", "Call parent".

---

## 7. Accessibility

- Text contrast at least 4.5:1 (all `--ink` tokens pass on `--bg` and `--surface`)
- Color is never the only signal: every category and status has an icon + text
- Record button also works by tap-to-start / tap-to-stop (holding is hard for some users)
- Respect `prefers-reduced-motion`: no pulse animation, static recording indicator
- Light and dark themes both supported
