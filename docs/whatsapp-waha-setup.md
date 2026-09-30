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
