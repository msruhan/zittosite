# WhatsApp group notification (WAHA) — setup

When an invoice is paid, the API posts one message to a WhatsApp group through
a self-hosted [WAHA](https://waha.devlike.pro) container (`waha` service in
`docker-compose.prod.yml`, engine GOWS). Design:
`docs/superpowers/specs/2026-09-30-whatsapp-paid-notification-design.md`.

You need a WhatsApp number dedicated to ZITTOSITE (not a personal number).

## 1. Configure `.env` on the VPS

In `/opt/zittosite/.env`:

```bash
WAHA_API_KEY=<openssl rand -hex 32>
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=<openssl rand -base64 24>
WA_GROUP_CHAT_ID=            # filled in step 4
```

Deploy (push to `main`, or run `scripts/deploy.sh` on the server). With
`WAHA_API_KEY` set, `deploy.sh` adds the `waha` compose profile and the
container starts. Notifications stay off until `WA_GROUP_CHAT_ID` is set.

## 2. Pair the WhatsApp number

The dashboard only listens on the server's localhost. From your laptop:

```bash
ssh -L 3001:127.0.0.1:3001 root@<vps>
```

Open <http://localhost:3001/dashboard>, log in with the dashboard username and
password, connect with the `WAHA_API_KEY`, start session **`default`** and scan
the QR code with the dedicated number (WhatsApp → Linked devices). Wait until
the status is `WORKING`. The session is stored in the `waha_sessions` volume
and survives redeploys.

## 3. Add the number to the group

Add the dedicated number to the admin/operator WhatsApp group.

## 4. Find the group ID

With the tunnel still open:

```bash
curl -s -H "X-Api-Key: $WAHA_API_KEY" \
  "http://localhost:3001/api/default/groups" | jq '.[] | {id, name: .subject}'
```

(or use Swagger at <http://localhost:3001/>). Copy the group `id`, e.g.
`120363012345678901@g.us`, into `WA_GROUP_CHAT_ID` in `.env`, then restart the
API:

```bash
cd /opt/zittosite && docker compose -f docker-compose.prod.yml up -d api
```

## 5. Verify

Pay an order (or a bulk order); one message should appear in the group.
Delivery state is in the `whatsapp_notifications` table:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U zittosite -c "select status, attempts, last_error, sent_at from whatsapp_notifications order by created_at desc limit 5;"
```

## 6. Roamercheck status updates (optional)

Services whose **Jalur proses order** is *WhatsApp* are announced only in the
group (operators on Telegram get no card; Super Admins still do). The group's
processor bot (Roamercheck) replies to each announcement, and the API turns its
replies into order status changes:

| Roamercheck message | Order status |
|---|---|
| `📥 IMEI … masuk ke antrian …` / `⏳ IMEI *…* sedang diproses …` | in_process |
| `✅ *IMEI … BERHASIL* ✅` | done |
| `❌ *Ada IMEI nggak valid:*` + `• <imei>: <reason>` | rejected (reason copied) |

Enable it in `/opt/zittosite/.env` and redeploy:

```bash
WAHA_WEBHOOK_SECRET=<openssl rand -hex 32>
WA_PROCESSOR_NUMBER=6281319455208
```

`deploy.sh` then points WAHA's webhook at `http://api:4000/webhooks/waha`
(HMAC-SHA512 signed). Only messages in `WA_GROUP_CHAT_ID` from that number are
used; the sender's WhatsApp LID is resolved through WAHA. Replies are matched to
the invoice through the quoted announcement, falling back to the oldest active
WhatsApp-channel order with that IMEI. Outcomes are logged by
`WahaWebhookController`.

Do not post test announcements in the production group: Roamercheck processes
every "PEMBAYARAN DITERIMA" message.

## 7. WhatsApp Admin (react to update orders)

Services whose **Jalur proses order** is *WhatsApp Admin* post one card per
paid order to the admin group chosen on the service (e.g. *Admin Pemroses 1–4*).
Admins update the order by reacting to its card; the bot replies under the card
to confirm:

| Reaction | Effect |
|---|---|
| ⏳ or 🔄 | Order taken by the reacting admin → in_process |
| ✅ | Done (a waiting order is taken first) |
| ❌ | Rejected, paid amount refunded to the user's balance |

Only admins assigned to the service (or a Super Admin) can act. Reactions are
matched to admins by the **Nomor WhatsApp** set in Super Admin → Admin; LIDs
are resolved through WAHA. Removing a reaction changes nothing. These orders
are not sent to operators on Telegram.

Setup:

1. Create the admin WhatsApp group(s) and add the dedicated number.
2. `WAHA_WEBHOOK_SECRET` must be set (step 6); WAHA's webhook sends
   `message,message.reaction` (see `docker-compose.prod.yml`).
3. Fill in each admin's WhatsApp number, then set the service's channel to
   *WhatsApp Admin* and pick its group. The group list comes live from WAHA
   (every group the number is in, except `WA_GROUP_CHAT_ID`).

Reactions only count in the group the card was posted to.

Card delivery state is in `order_whatsapp_messages` (same retry policy as
below).

## Operations

- **Failed sends** are retried automatically (1, 2, 5, 10, then every 30 minutes,
  10 attempts total). After that the row is `failed` and an entry
  "Notifikasi WhatsApp gagal" appears in Super Admin → Log Aktivitas.
- **Session logged out** (status `SCAN_QR_CODE` / `FAILED` in the dashboard):
  repeat step 2. Rows queued meanwhile are sent once it is `WORKING` again, as
  long as they have attempts left.
- **Turn off:** clear `WA_GROUP_CHAT_ID` (stops sending) or `WAHA_API_KEY`
  (also stops the container on the next deploy).
- Never publish port 3001 or expose the dashboard through Caddy.
