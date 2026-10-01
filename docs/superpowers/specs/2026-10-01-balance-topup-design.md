# Topup saldo user (QRIS) — design

## Goal

Users add balance themselves by paying a SayaBayar QRIS, from the website or the
Telegram bot. The balance is credited automatically once the gateway reports the
payment, then used at checkout like any other balance.

## Decisions

- Payment: SayaBayar QRIS only, same 60-minute invoice lifetime as orders.
  `PAYMENT_SIMULATION` follows the same simulated path as orders.
- Channels: website (`/app/topup`) and Telegram (`/topup`, menu button).
- Amount: quick picks Rp50.000 / 100.000 / 250.000 / 500.000 or a custom whole
  Rupiah amount between Rp10.000 and Rp5.000.000.
- One pending topup per user; asking again returns the pending one.
- Notifications on success: the user (Telegram, if linked) and every Super Admin
  on Telegram. No WhatsApp group message.

## Data

`payment_invoices` gains:

- `purpose` enum `InvoicePurpose` (`order` default, `topup`).
- `user_id` (nullable FK to users): owner of a topup invoice, which has no orders.

Topup invoice ids are `TP<yymmdd><seq4>` (Asia/Jakarta). A paid topup writes a
`balance_entries` row with reason `topup` and ref key `topup:<invoiceRowId>`, so
a repeated webhook can never credit twice.

## Flow

1. `POST /topups { amount }` validates the amount, returns the pending topup if
   any, otherwise creates the SayaBayar invoice and a `topup` PaymentInvoice.
2. The existing SayaBayar webhook calls `OrdersService.confirmGatewayPayment` /
   `closeGatewayInvoice`; both delegate to `TopupService` when
   `purpose = topup`.
3. Paid: verify `amount` equals the invoice amount, then in one transaction mark
   the invoice paid (also when it had already expired — the money arrived) and
   credit the balance. Notify user and Super Admins, audit `balance.topup_paid`.
4. Expired / cancelled: mark the invoice closed; no balance change.
5. `POST /topups/:id/check` ("Saya sudah bayar") nudges SayaBayar and pulls the
   status, or simulates payment in simulation mode.
6. The order expiry sweep also expires overdue pending topups.

`TopupService` lives in the orders module and does not depend on
`OrdersService`; `OrdersService` delegates to it.

## API (user auth)

- `GET /topups` — `{ pending, history }` (last 10).
- `POST /topups` — create or return pending.
- `GET /topups/:invoiceId` — one topup (owner only, expiry applied).
- `POST /topups/:invoiceId/check` — confirm / simulate.
- `POST /topups/:invoiceId/cancel` — cancel a pending topup.

## Website

- User nav gets **Topup**; the dashboard Saldo tile links to `/app/topup`.
- `/app/topup`: current balance, amount picks + custom input, pending topup
  banner, recent topups.
- `/app/topup/[invoiceId]`: QRIS, countdown, "Saya sudah bayar", cancel. Polls
  until paid, then returns to `/app/topup` with a success toast.
  `PaymentPanel` is generalised to take its poll/confirm endpoints.

## Telegram

- `/topup` command and "💳 Topup" button in the member menu and saldo screen.
- Amount buttons (`top:amt:<n>`) plus "Nominal lain" which opens a text session.
- QRIS sent as a photo with "Batalkan topup" (`top:cancel:<id>`).
- A pending topup is shown again instead of creating a new one.

## Audit

`balance.topup_created`, `balance.topup_paid` (category `payment`).

## Testing

Unit tests for amount parsing and the topup invoice id format; manual check of
webhook idempotency through `applyBalance` ref keys.
