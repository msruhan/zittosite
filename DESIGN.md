---
name: ZITTOSITE
description: Digital IMEI Activation Platform — order counter, status board, and operator ledger.
colors:
  action-blue: "#2563EB"
  action-blue-pressed: "#1D4ED8"
  action-blue-wash: "#EFF6FF"
  accent-sky: "#18BFFF"
  chart-blue-soft: "#93C5FD"
  chart-blue-mist: "#BFDBFE"
  counter-white: "#FFFFFF"
  ledger-mist: "#F9FAFB"
  hairline: "#E6EBF1"
  ink: "#111928"
  ink-soft: "#6B7280"
  ink-faint: "#9CA3AF"
  nav-ink: "#4B5563"
  metric-green: "#22AD5C"
  metric-orange: "#FF9C55"
  metric-red: "#F23030"
  hold-amber-wash: "#FEF9C3"
  hold-amber-ink: "#854D0E"
  hold-amber-edge: "#FDE047"
  cleared-green-wash: "#DCFCE7"
  cleared-green-ink: "#166534"
  cleared-green-edge: "#86EFAC"
  queued-violet-wash: "#EDE9FE"
  queued-violet-ink: "#5B21B6"
  queued-violet-edge: "#C4B5FD"
  working-amber-wash: "#FEF3C7"
  working-amber-ink: "#92400E"
  working-amber-edge: "#FCD34D"
  refused-red-wash: "#FEE2E2"
  refused-red-ink: "#991B1B"
  refused-red-edge: "#FCA5A5"
  void-slate-wash: "#F1F5F9"
  void-slate-ink: "#475569"
  void-slate-edge: "#CBD5E1"
typography:
  display:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.875rem"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: "1.75rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: "1.5rem"
    letterSpacing: "normal"
  body:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.375rem"
    letterSpacing: "normal"
  label:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "0.02em"
  data:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "5px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  "2xl": "16px"
  card: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.counter-white}"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-pressed}"
  button-secondary:
    backgroundColor: "{colors.counter-white}"
    textColor: "{colors.action-blue}"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "10px 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "10px 14px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.refused-red-ink}"
    textColor: "{colors.counter-white}"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "10px 20px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.counter-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "40px"
  metric-card:
    background: "counter-white + animated mesh washes + diagonal hatch"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px / 24px"
    border: "1px hairline"
    shadow: "resting"
  card-surface:
    backgroundColor: "{colors.counter-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
    atmosphere: "mesh blobs (action/status washes) + diagonal hatch"
  badge-status:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  nav-item-active:
    backgroundColor: "{colors.action-blue-wash}"
    textColor: "{colors.action-blue}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  table-header-cell:
    backgroundColor: "{colors.ledger-mist}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    padding: "10px 16px"
---

# Design System: ZITTOSITE

## Overview

**Creative North Star: "The Service Counter"**

ZITTOSITE is a counter you walk up to. You hand over one device number, you get back a ticket with a permanent number on it, and from then on the only question that matters is where that ticket currently sits. Every surface in this system is one of three things a real service counter has: the **ticket** you were handed, the **status board** you keep glancing at, and the **clerk's ledger** behind the glass. Nothing else needs to exist.

That is why the world is white paper and one working blue. The counter is bright and lit; the ink is near-black; the only saturated blue on screen is the thing you can act on right now. Status does not borrow that blue — status is a stamp, and stamps have their own colors: amber for held, violet for queued, green for cleared, red for refused, slate for void. A user who is waiting checks this screen five times an hour from a phone in one hand, so the stamp has to read from arm's length without being read carefully.

Depth is almost absent on purpose. Structure comes from hairline rules and faintly tinted fills, the way a printed form is structured — not from stacked shadow. Shadow is reserved for the two or three things that genuinely lift off the page: a dropdown, a modal, the mobile drawer. The system is calm because the data is not: order IDs, IMEI strings, rupiah amounts, and a payment countdown all live here — set in Satoshi with tabular figures so digits stay in their columns and never jitter.

**Key Characteristics:**

- Ticket-first: the `Order ID` is the most durable object on any order surface
- One working blue; every other color is a status stamp
- Hairline structure, tonal fills, shadow only for genuinely lifted layers
- Monospaced tabular figures for every identifier, amount, and timer
- Waiting is designed as carefully as success
- Mobile-first density; the phone is the primary reading scene

## Colors

A bright counter surface with one saturated working blue and six status stamps, each carrying its own wash, ink, and edge so a stamp is legible without relying on hue alone.

### Primary

- **Action Blue** (`#2563EB`): The only saturated blue on screen. It marks the one thing the visitor can do next (the filled primary button), the currently active navigation item, the current step on a progress stepper, and interactive text. It never marks a status.
- **Action Blue Pressed** (`#1D4ED8`): Hover and active fill for the primary button. Also the focus-ring hue at reduced alpha.
- **Action Blue Wash** (`#EFF6FF`): Tinted fill behind the active navigation item, the hovered table row, and the promotional "Buat Order Baru" panel's inner detail. Wide areas of wash are allowed; wide areas of Action Blue are not.

### Neutral

- **Counter White** (`#FFFFFF`): Page ground and card surface. The default; a card does not tint itself to prove it is a card.
- **Ledger Mist** (`#F8FAFC`): Table header rows, sidebar ground, disabled field fill, and skeleton bars. The faintest possible separation from Counter White.
- **Hairline** (`#E2E8F0`): Every border, divider, and table rule in the system, at exactly 1px.
- **Ink** (`#0F172A`): Headings, table values, and any number the visitor came to read.
- **Ink Soft** (`#64748B`): Field labels, column headers, metadata, timestamps, and secondary description.
- **Ink Faint** (`#94A3B8`): Placeholder text and disabled labels only. Never used for content a visitor must read.

### Status Stamps

Each stamp is a triplet: wash (fill), ink (text), edge (1px border). Never split a triplet across families.

- **Hold Amber** — wash `#FEF9C3`, ink `#854D0E`, edge `#FDE047`: `Waiting Payment`. The order exists but the counter has not been paid.
- **Cleared Green** — wash `#DCFCE7`, ink `#166534`, edge `#86EFAC`: `Paid` and `Done`. Money confirmed, or work finished.
- **Queued Violet** — wash `#EDE9FE`, ink `#5B21B6`, edge `#C4B5FD`: `Waiting Action`. Sitting in the admin queue, nobody has claimed it.
- **Working Amber** — wash `#FEF3C7`, ink `#92400E`, edge `#FCD34D`: `In Process`. A named admin holds this order right now.
- **Refused Red** — wash `#FEE2E2`, ink `#991B1B`, edge `#FCA5A5`: `Rejected`. An admin declined it.
- **Void Slate** — wash `#F1F5F9`, ink `#475569`, edge `#CBD5E1`: `Cancel`. Abandoned, expired, or withdrawn — deliberately the quietest stamp, because a void order is not news.

### Named Rules

**The One Blue Rule.** Action Blue means "act" or "now", nothing else. A single view carries at most one filled Action Blue button. If a second action wants the same weight, one of them is not primary.

**The Stamp Rule.** A status is never communicated by color alone and never by a bare dot. It is always a pill carrying its own text, its own wash, and its own 1px edge. Two statuses that share a wash (`Paid` and `Done` both use Cleared Green) are still told apart by their text, never by a shade nobody can name.

**The Tinted Secondary Rule.** On any tinted surface, secondary text is tinted from that surface's own hue at reduced lightness. Gray text on a colored ground is forbidden.

## Typography

**Display / UI / Data Font:** Satoshi (with `ui-sans-serif`, `system-ui`, `sans-serif`) — one face throughout, same as NextAdmin

**Character:** Satoshi carries the whole product the way NextAdmin does: medium for controls, bold for titles, black only when a number must dominate. Identifiers, amounts, timestamps, and the payment countdown stay on Satoshi with tabular figures (`tnum`) so columns align — never a separate monospace costume.

### Hierarchy

- **Display** (700, 1.75rem / 2.5rem, `-0.02em`): Page titles (NextAdmin heading-5). One per screen.
- **Metric** (700, 1.5rem / 1.875rem, `-0.02em`): Overview / stat numbers (NextAdmin heading-6).
- **Headline** (700, 1.375rem / 1.75rem, `-0.015em`): Card and section titles (NextAdmin body-2xlg).
- **Title** (500, 1rem / 1.5rem): Emphasized UI labels and denser headings.
- **Body** (500, 0.875rem / 1.375rem): Nav items, buttons, descriptions, table cells (NextAdmin body-sm).
- **Label** (500, 0.75rem / 1.25rem, `0.02em`): Table column headers and micro captions (NextAdmin body-xs).
- **Data** (500, 0.875rem, 1.4, `tnum`): Order IDs, IMEI, rupiah amounts, countdown, timestamps — Satoshi with tabular figures.

### Named Rules

**The Ticket Rule.** On any surface showing a single order, the `Order ID` is set in the data face at Headline size or larger, is never truncated, and is never abbreviated. It is the one string the visitor will read aloud on the phone to support.

**The No-Jitter Rule.** Any number that changes while the visitor is watching — the payment countdown above all — is set in the data face with tabular figures, so no digit change shifts the layout by a subpixel.

## Layout

A fixed 220px sidebar on the left with a scrolling content column to its right, on a page ground of Counter White. Content is capped at 1280px and gutters at 24px on desktop, 16px on mobile. The vertical rhythm is a single 4px-based scale (4 / 8 / 12 / 16 / 24 / 32), and a heading always carries more space above it than below, so a section reads as belonging to what follows it.

Density is deliberate per surface: the user portal breathes (20–24px card padding, four stat tiles across) because a user reads one order at a time; the Super Admin ledger tightens (10–16px cell padding, no card wrapper around tables) because a Super Admin scans hundreds of rows.

**Responsive behavior.** At `md` (768px) the sidebar leaves the layout and becomes a left-edge drawer over a dimmed page, reached from a topbar control; stat tiles drop from four columns to two, then to one below 480px; tables become horizontally scrollable within their own region, with the leading identifier column readable first, and the page itself never scrolls sideways. The phone is the primary scene for the user portal, so its layout is designed first and the desktop composition is the expansion.

## Elevation & Depth

This system is flat at rest. A card is defined by Counter White against Ledger Mist and a 1px Hairline border, not by shadow — the same way a printed form is structured by rules rather than by relief. Shadow appears only when an element genuinely leaves the page plane, and every shadow carries both an offset and a soft blur; a zero-offset colored halo is never used.

### Shadow Vocabulary

- **Resting** (`box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)`): Cards and stat tiles. Barely there; it separates a surface from the ground without implying the surface can be picked up.
- **Lifted** (`box-shadow: 0 4px 16px rgba(15,23,42,0.10)`): Dropdowns, popovers, select menus. Things that appeared just now and will disappear.
- **Overlay** (`box-shadow: 0 8px 32px rgba(15,23,42,0.14)`): Modal dialogs and the mobile drawer. The only shadow strong enough to read as "this is in front of everything".

### Named Rules

**The Flat-At-Rest Rule.** If an element is always on the page, it gets Resting or nothing. Only elements that can appear and disappear earn Lifted or Overlay.

## Shapes

Corners are gently curved but cards are soft on purpose: 5px on small chips, **14px on buttons**, 8px on inputs, 10px on nested panels, and **24px on every content card and metric tile**. The form language stays rectangular and calm; there are no cut corners. Icons are stroke-based so they sit at the same visual weight as the hairlines around them.

Borders are always exactly 1px in Hairline on every side that has one.

## Components

### Buttons

- **Shape:** Softly rounded (14px / `rounded-xl`), 44px tall, never full-width on desktop except inside a narrow form column.
- **Primary:** Action Blue fill, **Counter White** label and icon, 10px/20px padding. One per view.
- **Hover / Focus:** Fill deepens to Action Blue Pressed over 150ms; focus shows a 2px Action Blue ring at 35% alpha, offset 2px, and is never removed.
- **Active:** Scales to 0.97 over 160ms with an exponential ease-out. Every pressable element in the system does this — it is how the interface admits it heard the press.
- **Secondary:** Counter White fill, 1px Action Blue border, Action Blue label. Used for the second action in a pair and for "Saya Sudah Membayar".
- **Ghost:** No fill, Ink Soft label; for low-stakes actions like `Batal` in a modal.
- **Danger:** Refused Red Ink fill, white label; only for destructive record actions in the Super Admin ledger.
- **Loading:** Label is replaced by an inline spinner plus the present-progressive of the action ("Memproses…"), the button is disabled, and its width is held so the layout does not jump.

### Cards / Containers

- **Corner Style:** 24px (`rounded.card`) for content cards and metric tiles.
- **Background:** Counter White with a soft **card atmosphere**: slow-moving pastel mesh blobs (Action / Cleared / Working / chart blue washes only) plus a faint diagonal hatch that fades down the face. Atmosphere sits behind content; it never becomes a second surface or a frosted glass overlay.
- **Shadow Strategy:** Resting only (see Elevation & Depth).
- **Border:** 1px Hairline on all sides.
- **Internal Padding:** 20–28px. A card never contains another card.

### Metric Overview Card

Title row (bold Title + optional info hint + overflow control), a Display figure with an optional soft trend chip beside it, then a footer of comparison caption and a "Lihat detail →" link. No icon discs. The trend chip is a soft Cleared/Refused wash pill with a circular arrow glyph — not a status stamp. Atmosphere tone follows the metric's meaning.

### Inputs / Fields

- **Style:** Counter White fill, 1px Hairline border, 8px radius, 40px tall, label always rendered above the field as its own element.
- **Focus:** Border shifts to Action Blue and a 2px Action Blue ring at 30% alpha appears; the transition runs 150ms.
- **Error:** Border becomes Refused Red Edge, and a message in Refused Red Ink appears directly below the field naming both the problem and the fix.
- **Disabled:** Ledger Mist fill, Ink Faint label, cursor not-allowed.

### Status Badge

The system's signature component. An inline pill (999px) carrying uppercase Label type at 600 weight, 3px/10px padding, with its wash as fill, its ink as text, and its edge as a 1px border — the triplet from Colors. Badge text is the Indonesian status name in the product's own vocabulary. The badge is the single most-read element in the product, so it is the one place where a 1px border is non-negotiable: it holds the shape legible against both Counter White and Ledger Mist.

### Tables

- **Header:** Ledger Mist ground, Label type in Ink Soft, 10px/16px padding.
- **Rows:** Counter White, separated by a 1px Hairline bottom rule only. No vertical rules, no outer box, no zebra striping.
- **Hover:** Row ground shifts to Action Blue Wash at 40% over 150ms.
- **Leading column:** Always the identifier (`Order ID` or user name), set in the data face where it is an ID.
- **Empty and loading:** A table never renders as a bare header. Loading shows Ledger Mist skeleton bars at row height; empty shows a centered line naming what is missing plus the action that would fill it.

### Navigation

- **Style:** A vertical list on Ledger Mist ground, 220px wide, items at 9px/12px padding with an 18px stroke icon and a Title-weight label.
- **Default:** Ink Soft label, transparent ground.
- **Hover:** Ground becomes Counter White, label becomes Ink.
- **Active:** Ground becomes Action Blue Wash, label and icon become Action Blue at 600 weight. The active marker is a tinted fill, never a colored edge bar.
- **Mobile:** Below 768px the list moves into a left-edge drawer carrying the Overlay shadow over a page dimmed to 40%, sliding on the drawer curve.

### Progress Stepper

The order's status board, rendered vertically so each step can carry its own timestamp on the right. A completed step is a Cleared Green disc with a white check; the current step is a filled Action Blue disc with its label at 600 weight; a pending step is a Hairline ring on Counter White with an Ink Soft label. Steps are connected by a 2px vertical rule that is Cleared Green behind completed steps and Hairline ahead of the current one, so the visitor's eye finds "where am I" before reading a word.

### Payment Countdown

A single large figure in the data face with tabular figures, above the QR panel. It is Ink while there is plenty of time, shifts to Working Amber Ink under five minutes, and to Refused Red Ink under one minute; the digit itself changes with a 150ms vertical slide of 8px so the change is felt without being read. When it reaches zero the panel replaces itself with an expired state that names the next step, never a dead timer.

## Do's and Don'ts

### Do:

- **Do** give every status a pill carrying text, a 1px edge, and its own wash from the Colors triplets.
- **Do** set every identifier, amount, timestamp, and timer in the data face with tabular figures (`tnum`).
- **Do** mark the active navigation item with an Action Blue Wash fill and an Action Blue label.
- **Do** keep exactly one filled Action Blue button per view.
- **Do** design `Waiting Payment` and `Waiting Action` as fully as `Done` — they are what the visitor actually sees most.
- **Do** give every pressable element a `scale(0.97)` press response at 160ms.
- **Do** hold a button's width while it is loading, and hold a table's height while it is skeletoning.
- **Do** tint secondary text on the blue promotional panel from the blue hue, not from the gray ramp.

### Don't:

- **Don't** nest a card inside a card. If content needs its own frame inside a card, it needs a hairline divider instead.
- **Don't** mark the active navigation item with a colored left or right edge bar above 1px.
- **Don't** put gray text on any colored ground.
- **Don't** use Action Blue for a status, or a status color for an action.
- **Don't** use gradient text or frosted-glass overlays. Soft mesh blur and diagonal hatch are allowed only as **card atmosphere** behind content, using system washes — never as a full-screen effect.
- **Don't** animate an action the visitor triggers from the keyboard.
- **Don't** animate an element in from `scale(0)`; entrances start at `scale(0.95)` with opacity.
- **Don't** write `transition: all`; name the properties.
- **Don't** let any UI transition exceed 300ms, except the mobile drawer at 280ms and a deliberately slow hold-to-confirm.
- **Don't** render a table, list, or stat tile with no empty state and no loading state.
