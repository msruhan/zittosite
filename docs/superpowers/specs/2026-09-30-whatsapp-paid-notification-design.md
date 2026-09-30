# WhatsApp Paid-Order Group Notification — Design

**Date:** 2026-09-30
**Status:** Approved (pending spec review)

## Goal

When a user's payment is confirmed, ZITTOSITE posts **one message to a
WhatsApp group** (admins/operators), alongside the existing Telegram
notifications. Messages are sent by a dedicated WhatsApp number through a
self-hosted **WAHA** (WhatsApp HTTP API) container, modelled on CeirBot's
WAHA integration but with a delivery queue and retries.

## Decisions

| Topic | Decision |
|---|---|
| Destination | One WhatsApp group, set by `WA_GROUP_CHAT_ID` (`...@g.us`) |
| Granularity | One message per paid **invoice** (a bulk of N IMEIs = one message listing all N) |
| Content | Order IDs + IMEIs, service, customer username, order channel, total paid, paid time (WIB) |
| Configuration | Env only; QR pairing through the WAHA dashboard over an SSH tunnel (no admin UI) |
| Reliability | Persisted queue row per invoice, immediate send + background retry, capped attempts |
| Hosting | Own `waha` container in the ZITTOSITE production stack (not shared with CeirBot) |
| Telegram | Unchanged; WhatsApp is independent of Telegram success/failure |

Out of scope: admin UI for WhatsApp, WhatsApp messages to customers, incoming
WhatsApp messages / bot commands, notifications for other events.

## Infrastructure

### `docker-compose.prod.yml`

New service `waha`, behind compose profile `waha`:

- Image `devlikeapro/waha` pinned to an explicit version tag (no `latest`).
- `WHATSAPP_DEFAULT_ENGINE=GOWS` (no Chromium, low RAM).
- Networks: `internal` only. The API reaches it at `http://waha:3000`.
- Port `127.0.0.1:3001:3000` (localhost only, for the dashboard via SSH
  tunnel; 3000 is taken by `web`).
- Named volume `waha_sessions:/app/.sessions` so pairing survives redeploys.
- `restart: unless-stopped`.
- Environment is passed by **compose interpolation from the single server
  `.env`** (no separate `.env.waha`, because the deploy rsync runs with
  `--delete` and would remove it; and no `env_file: .env`, so the container
  never sees DB/JWT secrets):
  - `WAHA_API_KEY: ${WAHA_API_KEY}`
  - `WAHA_DASHBOARD_USERNAME: ${WAHA_DASHBOARD_USERNAME}`
  - `WAHA_DASHBOARD_PASSWORD: ${WAHA_DASHBOARD_PASSWORD}`
  - No `WHATSAPP_HOOK_*` (send-only; no inbound webhook).

### `scripts/deploy.sh`

Append `waha` to `COMPOSE_PROFILES` only when `WAHA_API_KEY` is non-empty in
`.env` (reusing `env_value`). A server without WAHA config keeps deploying
exactly as today. Combined with `tls` as a comma-separated list.

### Env vars (API, added to `.env.example` and `.env.production.example`)

| Var | Purpose |
|---|---|
| `WAHA_BASE_URL` | `http://waha:3000` in prod |
| `WAHA_API_KEY` | Sent as `X-Api-Key`; also configures the WAHA container |
| `WAHA_SESSION` | Session name, default `default` |
| `WA_GROUP_CHAT_ID` | Target group JID, e.g. `120363012345678901@g.us` |
| `WAHA_DASHBOARD_USERNAME` / `WAHA_DASHBOARD_PASSWORD` | Dashboard basic auth (container only) |
| `WAHA_MOCK` | `1` = log the message instead of calling WAHA (local dev) |

`whatsappConfig()` in `config/env.ts` returns `null` (feature off) unless
either:

- `WAHA_BASE_URL`, `WAHA_API_KEY` and `WA_GROUP_CHAT_ID` are all set, or
- `WAHA_MOCK=1`; then the other vars are optional and `WA_GROUP_CHAT_ID`
  defaults to `mock@g.us`.

`validateStartupEnv`:

- throws if `WAHA_MOCK` is on with `NODE_ENV=production`;
- warns in production when the feature is off.

### One-time setup runbook (`docs/whatsapp-waha-setup.md`)

1. Add the env vars to the server `.env`; deploy (the `waha` container starts).
2. SSH tunnel `ssh -L 3001:127.0.0.1:3001 <vps>`; open
   `http://localhost:3001/dashboard`, log in, start session `default`, scan
   the QR with the dedicated ZITTOSITE WhatsApp number until `WORKING`.
3. Add that number to the admin WhatsApp group.
4. Find the group JID via `GET /api/default/groups` (dashboard Swagger) and put
   it in `WA_GROUP_CHAT_ID`; redeploy or `docker compose up -d api`.
5. Verify with a simulated/real payment.

## Backend (`apps/api/src/whatsapp/`)

| Unit | Responsibility |
|---|---|
| `waha.client.ts` | `sendText(chatId, text) → { messageId }`. `POST {base}/api/sendText` body `{ session, chatId, text }`, header `X-Api-Key`, `AbortSignal.timeout(15_000)`. Non-2xx / network error → `WahaApiError(code, detail)`. Mock mode logs and returns a fake id. Mirrors `SayabayarClient`. |
| `whatsapp-messages.ts` | Pure `paidInvoiceGroupText(input)` producing WhatsApp-markdown text. |
| `whatsapp-notify.service.ts` | `enqueuePaidInvoice(tx, invoiceRowId)` (inside the settle transaction) and `deliver(notificationId)` (claim → send → record). Never throws to callers. |
| `whatsapp-retry.service.ts` | `setInterval` 60 s sweeper (copy of `OrderExpiryService` pattern: `unref`, `running` guard, cleared on destroy) that calls `deliver` for due rows. |
| `whatsapp.module.ts` | Provides the above; imported by `OrdersModule`. No dependency on Telegram modules. |

### Data model

New table `whatsapp_notifications` (model `WhatsappNotification`):

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `invoiceId` | String, unique | FK → `PaymentInvoice.id`, `onDelete: Cascade` |
| `kind` | String | `invoice_paid` (only value for now) |
| `chatId` | String | Group JID at enqueue time |
| `text` | Text | Rendered at enqueue time (snapshot at payment) |
| `status` | enum `WhatsappNotificationStatus` | `pending` / `sending` / `sent` / `failed` |
| `attempts` | Int, default 0 | |
| `nextAttemptAt` | DateTime | Index with `status` |
| `sentAt` | DateTime? | |
| `wahaMessageId` | String? | |
| `lastError` | String? | Truncated to 500 chars |
| `createdAt` / `updatedAt` | DateTime | |

Unique `invoiceId` makes enqueue idempotent.

### Flow

1. **Enqueue.** In `OrdersService.settleInvoice`, inside the existing
   transaction after the orders move to `waiting_action`, call
   `whatsappNotify.enqueuePaidInvoice(tx, invoiceRowId)` when
   `whatsappConfig()` is non-null. It loads the invoice's orders (with
   service name, user username, channel) and the invoice (`amountDue ??
   amount`, `paidAt`), renders the text and inserts a `pending` row with
   `nextAttemptAt = now`. A settle that is a no-op (invoice not pending)
   enqueues nothing.
2. **Immediate send.** After the transaction commits,
   `void whatsappNotify.deliver(row.id)` next to the existing Telegram calls.
3. **Claim.** `deliver` claims the row with `updateMany` where
   `status = pending AND nextAttemptAt <= now` → `sending`. If it claims
   nothing, it returns (another worker has it, or it is not due).
4. **Send.** Call `waha.sendText(chatId, text)`.
   - Success → `sent`, `sentAt`, `wahaMessageId`, `attempts + 1`.
   - Failure → `attempts + 1`, `lastError`; if `attempts < 10` →
     `pending` with `nextAttemptAt = now + backoff(attempts)`, else `failed`
     and audit event `notify.whatsapp_failed` (invoice ID, attempts, last
     error).
   - Backoff after attempt n: 1, 2, 5, 10 minutes, then 30 minutes for every
     later attempt (roughly 3.5 hours to exhaust 10 attempts).
5. **Sweep.** Every 60 s the retry service selects up to 20 rows with
   `status = pending AND nextAttemptAt <= now` and calls `deliver` for each,
   sequentially. On startup it also resets rows stuck in `sending` for more
   than 5 minutes back to `pending` (crash recovery).

`deliver` is also skipped (row left `pending`) when `whatsappConfig()` is
`null` at send time, so removing config pauses sending without data loss.

### Message format

```
✅ *PEMBAYARAN DITERIMA*
──────────────
👤 User: *budi123*
🛒 Via: Web
💰 Total: *Rp 150.000*
🕒 Dibayar: 30 Sep 2026, 14:05 WIB

📦 *Unlock IMEI Premium* (3 order)
1. `ORD-000123` · `356789012345678`
2. `ORD-000124` · `356789012345679`
3. `ORD-000125` · `356789012345680`
```

- A bulk invoice always has one service; the header uses that service name.
  If orders ever span services, orders are grouped under one `📦` header per
  service.
- `Via` maps `OrderChannel`: `web` → `Web`, `telegram` → `Telegram`.
- Rupiah uses `id-ID` grouping; time is formatted in `Asia/Jakarta`.
- User-supplied strings (username, service name) have WhatsApp markdown
  characters (`*`, `_`, `~`, `` ` ``) stripped so they cannot break formatting.

### Audit

Add `notify.whatsapp_failed` to `ACTIVITY_EVENTS` under a new category
`notification`, label "Notifikasi WhatsApp gagal", with `orderId` set to the
invoice's first Order ID so it shows up in order searches. Successful sends
are not audited.

## Testing

- Unit (`node:test`, like `imei-list.test.ts`):
  - `paidInvoiceGroupText`: single order, bulk of 6, Rupiah and WIB formatting,
    markdown-character stripping.
  - `backoff(n)` schedule and the 10-attempt cap.
  - `whatsappConfig()`: off when any required var is missing, on with mock.
- Local manual (`WAHA_MOCK=1`, `PAYMENT_SIMULATION=1`): pay a single and a bulk
  order → one `sent` row per invoice, message text in the API log; Telegram
  flow unchanged.
- Failure path: `WAHA_MOCK` off and `WAHA_BASE_URL=http://127.0.0.1:1` →
  payment still succeeds, row goes `pending` with growing `nextAttemptAt`;
  after pointing to a working target the sweeper sends it.
- Optional: run the real WAHA container locally, pair a test number and send
  to a test group.
- `npm run typecheck`, lint and tests pass; `docker compose -f
  docker-compose.prod.yml config` is valid with and without the `waha` profile.
