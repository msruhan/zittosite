---
name: ZITTOSITE
description: Digital IMEI Activation Platform — infrastructure admin console for supervised IMEI operations.
currentDirection:
  name: "Infrastructure Admin Console"
  note: "Supersedes the earlier paper-counter direction. The product should feel like a serious operational system: dense, precise, ledger-like, and premium without oversized hero cards or decorative gradients."
  mode: "Operate"
  rules:
    - "Clarity, scanability, and status recognition beat visual spectacle."
    - "Use restrained dark rails, cool neutral surfaces, tight hairlines, tabular data, and a small number of high-confidence accents."
    - "Avoid AI dashboard fingerprints: cinematic hero cards, rainbow metric tiles, glass everywhere, glow halos, fake charts, and huge display type."
    - "Keep route labels, business copy, form fields, and status vocabulary stable unless explicitly requested."
colors:
  action: "#1E63FF"
  action-pressed: "#174FD1"
  action-deep: "#0E2F7D"
  action-wash: "#EAF1FF"
  surface: "#FBFCFE"
  ground: "#EEF2F7"
  mist: "#E5EAF1"
  hairline: "#C9D2DE"
  ink: "#111827"
  ink-soft: "#536070"
  ink-faint: "#8A95A3"
  nav-ink: "#D6DFEA"
  hold-wash: "#FEF9C3"
  hold-ink: "#854D0E"
  hold-edge: "#EAB308"
  cleared-wash: "#DCFCE7"
  cleared-ink: "#166534"
  cleared-edge: "#4ADE80"
  queued-wash: "#EDE9FE"
  queued-ink: "#5B21B6"
  queued-edge: "#A78BFA"
  working-wash: "#FEF3C7"
  working-ink: "#92400E"
  working-edge: "#FBBF24"
  refused-wash: "#FEE2E2"
  refused-ink: "#991B1B"
  refused-edge: "#F87171"
  void-wash: "#F1F5F9"
  void-ink: "#475569"
  void-edge: "#94A3B8"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2.15rem"
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.75rem"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: "1.6rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: "1.5rem"
  body:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.45rem"
  label:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.15rem"
  data:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  card: "12px"
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
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "10px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-pressed}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.action}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "10px 18px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  badge-status:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  nav-item-active:
    backgroundColor: "{colors.action-wash}"
    textColor: "{colors.action}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: ZITTOSITE

## Overview

**Creative North Star: "The Counter Slip"**

ZITTOSITE is a slip you are handed at a service window. One device number goes in. One Order ID comes back. From then on the only question is where that slip currently sits. The website is the counter surface and the status board, not a glowing dashboard and not an agency landing page.

The world is cold paper and one working blue. The room is lit like a municipal desk at noon: off-white ground, near-black ink, hairlines instead of shadow. Action Blue marks the next thing you can do. Status never borrows that blue. Status is a stamp with its own wash, ink, and edge.

Type is Atkinson Hyperlegible because the primary scene is a phone held in one hand, often at arm's length, while the visitor waits. Icons are Phosphor at regular weight so they sit at the same stroke as the hairlines.

**Key Characteristics:**

- Ticket-first: the Order ID is the most durable object on any order surface
- One working blue; every other color is a status stamp
- Hairline structure, no mesh, no orbs, no glass, no fake charts
- Tabular figures for identifiers, amounts, and timers
- Waiting is designed as carefully as success
- One light theme for the whole product, including login

## Colors

Restrained: neutrals plus one accent. The visitor came to operate.

### Primary

- **Action** (`#1453C7`): The only saturated blue. Primary button, active nav, current stepper step, interactive text. Never a status. Never a full-bleed tile fill.
- **Action Pressed** (`#0E3FA0`): Hover and active fill.
- **Action Wash** (`#E7F0FC`): Active nav fill, hovered table row, selected page number.
- **Action Deep** (`#0A2C72`): Focus-adjacent ink, never a background field.

### Neutral

- **Ground** (`#F1F3F6`): Page canvas.
- **Surface** (`#F8F9FB`): Cards, sidebar, inputs, dialogs. Not pure white.
- **Mist** (`#EBEEF2`): Table headers, disabled fills, skeletons.
- **Hairline** (`#D5DCE4`): Every 1px rule.
- **Ink** (`#141A22`): Headings, values, anything that must be read.
- **Ink Soft** (`#5C6774`): Labels, metadata, secondary description.
- **Ink Faint** (`#8B95A1`): Placeholders and disabled labels only.

### Status Stamps

Each stamp is a triplet: wash, ink, edge. Never split a triplet.

- **Hold Amber**: Waiting Payment
- **Cleared Green**: Paid, Done
- **Queued Violet**: Waiting Action
- **Working Amber**: In Process
- **Refused Red**: Rejected
- **Void Slate**: Cancel

### Named Rules

**The One Blue Rule.** Action means "act" or "now". A view carries at most one filled Action button.

**The Stamp Rule.** Status is never color alone and never a bare dot. Always a pill with text, wash, and a 1px edge.

**The Theme Lock.** The whole product is light paper. Login does not invert. Metric tiles do not invert. No mid-page dark panels.

**The Atmosphere Ban.** No mesh blobs, floating orbs, diagonal hatch decoration, sparkline costumes, or outer glows.

## Typography

**Face:** Atkinson Hyperlegible (400 / 700) via `next/font`. Chosen for the phone-in-one-hand reading scene, not as a generic grotesk.

**Character:** Regular for body and labels. Bold for titles, metrics, and ticket data. Two weights only. Numbers use tabular figures so columns and countdown digits do not jitter.

### Hierarchy

- **Display** (700, 1.75rem): One page title per screen.
- **Metric** (700, 1.5rem): Figures inside the metric strip.
- **Headline** (700, 1.25rem): Card titles and the Order ID on a ticket.
- **Title** (700, 1rem): Emphasized UI labels and primary buttons.
- **Body** (400, 0.9375rem): Nav, descriptions, table cells.
- **Label** (400, 0.75rem): Column headers and captions. Not tracked uppercase by default.
- **Data** (700, 0.9375rem, `tnum`): Order ID, IMEI, rupiah, countdown.

### Named Rules

**The Ticket Rule.** On a single-order surface, the Order ID is Headline or larger, never truncated, never abbreviated.

**The No-Jitter Rule.** Any number that changes while watched uses tabular figures.

**The Eyebrow Rule.** At most one small kicker per screen. Section titles do not wear tracked uppercase costumes.

## Layout

Fixed 240px sidebar on the left, scrolling content on Ground. Content caps at 1200px. Gutters 24px desktop, 16px mobile. Vertical rhythm is 4 / 8 / 12 / 16 / 24 / 32. More space above a heading than below it.

User portal: one primary ticket, then a metric strip, then the latest rows. Admin ledger: tighter cells, no decorative stage.

At 768px the sidebar becomes a left drawer. Stat strips wrap to two columns, then one. Tables scroll inside their region.

## Elevation & Depth

Flat at rest. A card is Surface against Ground plus a 1px Hairline. Shadow appears only when something leaves the page: dropdown, dialog, mobile drawer.

- **Resting:** none, or `0 1px 2px rgba(20,26,34,0.04)` if a card must separate from a matching ground
- **Lifted:** `0 4px 16px rgba(20,26,34,0.10)`
- **Overlay:** `0 8px 28px rgba(20,26,34,0.14)`

**The Flat-At-Rest Rule.** If it is always on the page, it gets Resting or nothing.

## Shapes

One radius system:

- 4px chips
- 8px inputs
- 10px buttons and nav items
- 12px cards and dialogs
- 999px status stamps only

No 24px soft dashboard cards. Icons are Phosphor regular, one family, no hand-rolled decorative marks except the brand shield.

## Components

### Buttons

- 10px radius, 44px tall.
- Primary: Action fill, Surface label. One per view.
- Hover: Action Pressed, 150ms.
- Active: `scale(0.97)` at 160ms on pointer devices.
- Secondary: Surface fill, 1px Action border, Action label.
- Ghost: Ink Soft, no fill.
- Danger: Refused Ink fill, Surface label.
- Loading: inline spinner, width held.

### Cards

- 12px radius, Surface, 1px Hairline, no atmosphere layer.
- Padding 20px. A card never contains another card.

### Metric strip

One paper object with two or four cells, separated by hairlines. Label, figure, optional caption. No icon disc, no sparkline, no gradient fill, no hover lift.

### Inputs

- Surface, 1px Hairline, 8px, 44px tall, label above.
- Focus: Action border + 3px Action ring at 18% alpha.
- Error: Refused edge and an error line that names the problem and the fix.

### Status Badge

Pill, Label type, 3px/10px, wash + ink + 1px edge. Indonesian product vocabulary.

### Tables

- Mist header, Label in Ink Soft.
- Rows separated by a bottom hairline only.
- Hover: Action Wash at 40%.
- Leading column is the identifier.

### Navigation

- 240px Surface column.
- Active item: Action Wash + Action label. No edge bar.
- Section heading is plain Body in Ink Soft, not a tracked banner.

### Progress Stepper and Countdown

Unchanged in job: vertical status board; countdown uses data figures and shifts to Working then Refused ink as time runs out.

## Do's and Don'ts

### Do

- Give every status a pill with text, wash, and edge.
- Set identifiers, amounts, and timers in tabular figures.
- Keep exactly one filled Action button per view.
- Design waiting states as fully as Done.
- Give pointer-triggered controls a `scale(0.97)` press.

### Don't

- Do not use mesh, orbs, glass, gradient text, or fake sparklines.
- Do not invert a section to dark or fill a metric tile with Action.
- Do not nest cards.
- Do not use Action for status, or a status color for a primary action.
- Do not put gray text on a colored ground.
- Do not mark active nav with an edge bar thicker than 1px.
- Do not write `transition: all`.
- Do not let a UI transition exceed 300ms except the 280ms drawer.
- Do not change routes, nav item labels, form field names, or business copy to chase a look.
