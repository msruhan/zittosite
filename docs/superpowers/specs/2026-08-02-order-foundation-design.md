# ZITTOSITE Order Foundation — Design

**Date:** 2026-08-02  
**Status:** Approved (rekomendasi opsi 1: invoice + mark-paid)  
**Depends on:** Auth/Security foundation, Telegram Phase 1 (linking + `creditBalance` unused for payment here)

## Goal

Ganti mock order di portal **user** dengan API NestJS + PostgreSQL nyata. Payment gateway belum aktif: invoice QRIS placeholder + endpoint simulasi **mark-paid**. Setelah lunas, order masuk `waiting_action` (siap antrean admin di fase berikutnya).

## Approach

**Invoice + mark-paid** (bukan potong `creditBalance`).  
`creditBalance` tetap untuk `/saldo` bot dan top-up nanti; pembayaran order mengikuti model PRODUCT (invoice / QRIS).

## Scope

### In

1. Prisma: `Service`, `Order`, `PaymentInvoice`, `OrderActivityLog`, `OrderResult` (model siap, belum diisi Done)
2. Nest module order + services list
3. Dev/simulasi `POST .../mark-paid`
4. Lazy expire invoice + cancel order saat dibaca
5. Wire web user: dashboard, buat order, bayar, status, detail, riwayat, layout chip (data dari API)
6. Seed services + beberapa order contoh untuk user seed

### Out

- Admin Terima / Tolak / Done (Telegram atau web)
- Gateway QRIS nyata / webhook
- Bot `/order`, `/riwayat`
- Notifikasi Telegram order baru
- Claim API
- Super Admin order/service CRUD API (halaman admin tetap mock)

## Data model

### Service

| Field | Notes |
| --- | --- |
| id | cuid |
| code | Unique stable key, e.g. `activation`, `register`, `check`, `unlock` |
| name, description | |
| price | Int (Rp) |
| estimate | string display e.g. `1–3 jam` |
| active | Boolean |
| timestamps | |

### Order

| Field | Notes |
| --- | --- |
| id | cuid (internal) |
| orderId | Public unique: `ZT` + `YYMMDD` + 4-digit daily seq (e.g. `ZT2608020001`) |
| userId, serviceId | FK |
| channel | `web` \| `telegram` — fase ini selalu `web` dari portal |
| imei | 15 digit |
| notes | optional |
| status | enum below |
| price | Int snapshot at create (respect `User.customPrice` for activation service) |
| assignedAdminId | null until accept (later) |
| startedAt, completedAt | null until later phases |
| timestamps | |

### PaymentInvoice

| Field | Notes |
| --- | --- |
| id / invoiceId | public invoice id (e.g. `INV-…`) |
| orderId | FK, one active invoice per order at a time |
| amount | = order.price |
| paymentChannel | `qris_placeholder` |
| paymentReference | null until gateway |
| paymentStatus | `pending` \| `paid` \| `failed` \| `expired` \| `cancelled` |
| expiredAt | create + 30 minutes |
| paidAt | |
| gatewayPayload | Json? optional |

### OrderActivityLog

- orderId, status, note, actor (display string), createdAt  
- Written on: create, mark-paid, cancel, expire

### OrderResult

- Fields aligned with `apps/web/src/lib/types.ts`  
- Unused in this phase (no Done flow yet)

### Status enums

Order: `waiting_payment` → `paid` → `waiting_action` → (`in_process` → `done` later)  
Exits: `rejected`, `cancel`

Payment: `pending`, `paid`, `failed`, `expired`, `cancelled`

### Status flow (this phase)

```text
POST /orders
    → order waiting_payment + invoice pending + activity

POST .../mark-paid
    → invoice paid; order paid then waiting_action
    → two activity rows: status `paid`, then `waiting_action`
    → only if waiting_payment + invoice pending

GET detail/list (lazy)
    → if invoice pending && now > expiredAt
    → invoice expired; order cancel + activity

POST .../cancel
    → only waiting_payment; invoice cancelled; order cancel
```

**Pricing rule:** If `User.customPrice` is set and `Service.code === "activation"`, use customPrice; else `service.price`. Snapshot onto `Order.price`.

**Concurrency:** Reject create if user already has an order in `waiting_payment`.

## API

All user routes: `UserAuthGuard` + cookie.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/services` | Active services + `effectivePrice` for current user |
| `POST` | `/orders` | Body: `{ serviceId, imei, notes? }` → order + invoice |
| `GET` | `/orders` | Query: `q?` search orderId / imei; list for current user |
| `GET` | `/orders/:orderId` | Detail by public `orderId`; include service, invoice, activity, result null |
| `POST` | `/orders/:orderId/cancel` | Cancel if `waiting_payment` |
| `POST` | `/orders/:orderId/mark-paid` | Simulate payment (dev / placeholder UI) |

Response shapes should mirror `Order`, `OrderDetail`, `Service`, `PaymentInvoice`, `OrderActivityLog` in `apps/web/src/lib/types.ts` (ISO date strings).

**IMEI validation:** `/^\d{15}$/`.

**Authz:** Non-owner orderId → `404` (no existence leak).

## Web (user portal)

Replace mock reads/writes on:

- `/app` layout user chip / counts as needed from `/me` + `/orders`
- `/app/dashboard`
- `/app/order` (create) → `POST /orders` → redirect bayar
- `/app/order/[orderId]/bayar` — QRIS placeholder, countdown from `expiredAt`, button **Simulasikan pembayaran** → `mark-paid`, poll status optional
- `/app/order/[orderId]/status`, `/app/order/[orderId]`
- `/app/riwayat`

Keep mock: admin panel pages, user claim, profil telegram handle from mock if `/me` incomplete (prefer extend `/me` lightly if needed for name/username only — already exists).

## Seed

- Services: Aktivasi IMEI (150_000), Registrasi IMEI Baru (185_000), Cek Status IMEI (35_000), Buka Blokir IMEI (275_000, inactive)
- Sample orders for `fajri` across statuses so dashboard/riwayat nonempty
- Existing users keep `creditBalance` from Telegram phase seed (orthogonal)

## Error handling

| Case | Response |
| --- | --- |
| Inactive service | 400 |
| Invalid IMEI | 400 |
| Existing waiting_payment | 409 |
| mark-paid wrong state | 400; if already paid/waiting_action return current detail (idempotent OK) |
| cancel wrong state | 400 |
| Not found / other user | 404 |

## Testing focus (manual)

1. Login user → list services with custom price for `siti.aminah` if applicable  
2. Create order → waiting_payment + invoice  
3. Bayar page countdown + simulate pay → waiting_action  
4. Cancel unpaid order  
5. Expire path (shorten expiredAt in DB or wait) → cancel on next GET  
6. Riwayat / detail / dashboard from API  

## Success criteria

User can complete create → simulate pay → see `waiting_action` on status/detail/riwayat entirely from Postgres, without mock-data for those screens.

## Follow-ups (not this spec)

- Admin Telegram accept/reject/done + notify  
- Real payment gateway webhook replacing mark-paid  
- Bot `/order` / `/riwayat`  
- Admin web order API  
