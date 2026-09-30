# Bulk Order — Design

**Date:** 2026-09-30
**Status:** Approved (pending spec review)

## Goal

A user can submit up to **6 IMEIs** for one service in a single order action,
on the website and in the Telegram bot. Each IMEI becomes its own order, but
all of them are paid together with **one QRIS** whose amount is
`quantity × price`.

## Decisions

| Topic | Decision |
|---|---|
| Order shape | One order per IMEI (own Order ID, taken/done/rejected individually by admins) |
| Payment | One invoice (one SayaBayar QRIS) covering every order in the bulk |
| Channels | Website and Telegram bot |
| Max IMEIs | 6 per bulk (single IMEI stays valid) |
| Price | `quantity × effective price` (per-user custom price still applies); no bulk discount |
| Notes | One notes value, copied to every order in the bulk |
| Pending rule | Still at most one unpaid invoice per user; a bulk counts as one |

## Data model

`PaymentInvoice` moves from 1:1 to 1:N with `Order`.

- Add `Order.invoiceId String? @map("invoice_row_id")` → `PaymentInvoice.id`
  (`onDelete: SetNull`), indexed.
- Migration backfills `orders.invoice_row_id` from `payment_invoices.order_id`,
  then drops `payment_invoices.order_id` and its unique constraint.
- `PaymentInvoice` gains `orders Order[]`; `Order.invoice` stays the relation
  name so existing `include: { invoice: true }` call sites keep working.
- `invoice.amount` is the bulk total. `order.price` stays the per-IMEI price.
- Invoice number: `INV-<first orderId>`.

## Backend (`apps/api`)

### Parsing and validation (shared helper `orders/imei-list.ts`)

- Input: raw text (bot) or `string[]` (web). Split on newlines, strip
  non-digits per line, drop empty lines.
- Each entry must be exactly 15 digits. Errors report the 1-based line number:
  `Baris 2: IMEI harus 15 digit (saat ini 14).`
- Duplicates inside one submission are rejected:
  `Baris 4: duplikat dengan baris 1.`
- Count must be 1–6: `Maksimal 6 IMEI per order.`

### `POST /orders`

- Accepts `imeis: string[]`; legacy `imei: string` is treated as `[imei]`.
- Creates N orders (sequential Order IDs) plus one invoice in one transaction,
  after creating one SayaBayar invoice for `N × price`.
- Response: the first order, unchanged shape. The bulk is visible through
  `invoice.orders` (see Serializer).

### Invoice-wide state changes

Every path that settles or closes an invoice updates **all** orders on it:

- `settleInvoice` (webhook paid, manual sync, simulation): all orders →
  `paid` → `waiting_action`, activity log per order, `notifyNewOrder` per order.
- `closeGatewayInvoice` / `ensureNotExpired` / `expireOverdueOrders`: all
  orders → `cancel`; the user gets one expiry notice listing the Order IDs.
- `cancelOrder` (user, before payment): cancels the invoice and every order on it.
- `adminCancelOrder`: if the invoice is still pending, cancels the invoice and
  every order on it; if already paid, cancels only that order (manual refund flag).
- Late payment logging applies to every order on the invoice.

### Serializer

`invoice` on an order gains `orders: Array<{ orderId, imei, status }>` so the
payment page and bot can list the bulk.

## Website (`apps/web`)

### `/app/order` — `CreateOrderForm`

- IMEI field becomes a `Textarea` (one IMEI per line), live-parsed with the same
  rules as the backend.
- Hint: `3 IMEI valid · maksimal 6`. Per-line errors listed under the field;
  submit is blocked while any error exists.
- Total row: `3 × Rp 150.000` on the left detail, `Rp 450.000` emphasised.
- Submit sends `imeis`, then routes to `/app/order/<first orderId>/bayar`.

### `/app/order/[orderId]/bayar` — payment panel

- Shows the invoice total (unchanged) plus, when the invoice has more than one
  order, a compact list of Order ID + IMEI for every order in the bulk.
- Cancel button copy for bulks: `Batalkan semua (3 order)`.

## Telegram bot

- The IMEI prompt accepts several lines in one message, same rules and limit.
- Validation errors reply with the per-line messages and keep the session so
  the user can resend.
- Success reply: one QRIS for the total, caption lists each Order ID + IMEI.
- The admin "ORDER BARU" card stays one card per order.

## Out of scope

- CSV/file upload.
- Bulk discounts.
- Mixing services within one bulk.

## Testing

- Unit tests for `imei-list.ts` (valid, invalid length, duplicates, >6, blank lines).
- Service-level checks: bulk create totals, settle → all orders queued,
  expiry/cancel → all orders cancelled, admin cancel after paid → one order.
- Manual: web form with 1 and 3 IMEIs (simulation mode), payment page list,
  bot multi-line message.
