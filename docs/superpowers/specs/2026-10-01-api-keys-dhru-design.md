# Design: API keys with a Dhru Fusion compatible endpoint

**Date:** 2026-10-01
**Status:** Approved

## Goal

Users with API access create API keys and connect their own website or Dhru
Fusion panel to this platform. Orders placed through the API are paid from the
user's balance and processed by operators exactly like web orders. Status is
read back by polling (Dhru standard) and pushed by a signed webhook.

References: <https://ceirgo.id/docs/compatibility/dhru> and the NexusServer
implementation (`src/app/api/index.php/route.ts`).

## Decisions

- Dhru Fusion compatible API only; no separate REST API.
- Super Admin enables API access per user (`users.api_enabled`); the user then
  creates and revokes their own keys in the portal.
- Balance only. An order is accepted only when the balance covers it; otherwise
  `Insufficient balance`. No QRIS for API orders.
- Webhooks are part of this phase: one endpoint per user.
- Lives in the existing NestJS API as a new module; orders go through
  `OrdersService.createOrder` with `channel: "api"`, so pricing, ledger, test
  flag, Telegram fan-out, operator queue, refunds and statistics are reused.

## Data

- `users.api_enabled` boolean, default false.
- `OrderChannel` gains `api`.
- `api_keys`: id, user_id, name, key_prefix (unique), key_hash (SHA-256),
  last_used_at, revoked_at, created_at. Max 5 active keys per user.
- `orders.api_key_id` → `api_keys.id`, nullable, `ON DELETE SET NULL`.
- `webhook_endpoints`: id, user_id (unique), url, secret, is_active,
  failure_count, last_status, last_delivery_at, timestamps.
- `webhook_deliveries`: id, endpoint_id, order_id, event, payload, status
  (`pending` | `success` | `failed`), attempts, next_attempt_at, response_code,
  last_error, timestamps. Unique (endpoint_id, order_id, event).

Key format: `al_live_<48 hex>`. Only the hash and the first 16 characters
(prefix, used for lookup) are stored. The full key and the webhook secret are
shown once at creation/regeneration and never returned again.

## Endpoint

`POST /api/index.php`, alias `POST /api/dhru`, form-urlencoded or multipart.
Fields: `username`, `apiaccesskey`, `action`, `requestformat` (JSON; XML is
accepted but answered as JSON), `parameters` (XML `<PARAMETERS>…</PARAMETERS>`
or JSON). Flat fields `ID`, `SERVICEID`, `IMEI` are accepted too; `parameters`
wins on conflicts.

Authentication: look up the key by prefix, compare hashes with
`timingSafeEqual`, then require `username` = key owner's username, key not
revoked, user active and `api_enabled`. Every failure returns
`Authentication failed`. `last_used_at` is written at most once per minute.

Responses always use HTTP 200:

- Success: `{"SUCCESS":[{…}],"apiversion":"8.2"}`
- Error: `{"ERROR":[{"MESSAGE":"…","FULL_DESCRIPTION":"…"}],"apiversion":"8.2"}`

Status mapping: `waiting_payment`, `paid`, `waiting_action` → 0;
`in_process` → 1; `rejected`, `cancel` → 3; `done` → 4.

| Action (aliases) | Behaviour |
|---|---|
| `accountinfo` | `AccoutInfo`: `credit` (formatted IDR), `creditraw`, `currency: "IDR"`, `username` |
| `imeiservicelist` (`getservices`) | `LIST` grouped by category; each service has `SERVICEID`, `SERVICENAME`, `CREDIT` (user's price via `resolveUserPrice`), `TIME`, `INFO`. Active services only |
| `placeimeiorder` (`placeorder`) | Validate IMEI with the existing validator, create the order paid by balance, return `REFERENCEID` (order id) and `MESSAGE` |
| `placeimeiorderbulk` | Up to 50 items. Balance must cover the whole batch or nothing is created. Per-item `REFERENCEID` or `ERROR` |
| `orderstatus` (`getimeiorder`, `getserverorder`) | `STATUS`, `CODE` (result), `COMMENTS` (reason). Looked up by `id` **and** `userId` |
| `orderstatusbulk` | Up to 100 ids, each scoped to the user |

Standard messages: `Authentication failed`, `API access disabled`,
`Insufficient balance`, `Invalid IMEI`, `Service not found`, `Order not found`,
`Unsupported action`, `Too many requests`, `Internal error`. Internal errors are
logged; clients never see stack traces.

Rate limits per key: 60 requests/minute overall, 20 order placements/minute.

## Webhooks

- Outbox scanner every 30 s: API orders in `done`, `rejected` or `cancel`
  whose owner has an active endpoint and no delivery for that event get a
  `pending` delivery. Final states are set from several paths (Telegram
  operator, Roamercheck, admin web, cancel); scanning covers all of them.
- Events: `order.completed`, `order.rejected`, `order.cancelled`.
- Payload: `event`, `referenceId`, `imei`, `service`, `status` (Dhru code),
  `code`, `comments`, `completedAt`.
- Headers: `X-Timestamp`, `X-Signature: sha256=<HMAC-SHA256(secret,
  timestamp + "." + body)>`.
- Delivery: 10 s timeout, no redirects. 2xx = success. Retries at 1 m, 5 m,
  15 m, 1 h, 6 h, then `failed`. 10 consecutive failures pause the endpoint
  (`is_active = false`); the portal shows the status.
- URL rules: HTTPS only; hostname resolved and rejected if any address is
  private, loopback, link-local or otherwise non-public. Checked on save and on
  every delivery.
- Only orders finished after the endpoint was created are delivered.
- "Kirim test" sends a `ping` event synchronously and reports the result.

## API (portal)

User (requires `api_enabled`):

- `GET /api-keys`, `POST /api-keys` (name → returns full key once),
  `DELETE /api-keys/:id` (revoke).
- `GET /webhook`, `PUT /webhook` (url, isActive), `POST /webhook/secret`
  (regenerate, returns secret once), `POST /webhook/test`,
  `GET /webhook/deliveries` (latest 50).

Super Admin: `POST/PATCH /admin/users` accept `apiEnabled`.

Activity log: `api.key.created`, `api.key.revoked`, `api.access.toggled`,
`api.webhook.updated`.

## Web

- User page `/app/api` (nav "API Access", shown only when `apiEnabled`):
  endpoint URL and username, key list with create/revoke and a one-time key
  display, webhook settings with secret, test button and recent deliveries,
  short docs with cURL examples and the status table.
- Users page: "Akses API" toggle in the user form; API tag in the table.
- Admin order table and detail: "API" channel tag.

## Testing

- Unit: response envelope, status mapping, XML/JSON/flat parameter parsing, key
  hash and verify, webhook signature, URL validation, retry schedule.
- Integration: wrong username, revoked key and disabled access all fail;
  `orderstatus` on another user's order returns `Order not found`; bulk with
  insufficient balance creates nothing.
- Manual: cURL against staging and a Dhru Fusion panel as client.
- API and web typecheck and lint.
