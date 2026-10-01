# Dhru Supplier (Project-AL as API consumer) — Design

Date: 2026-10-01
Status: approved

## Goal

Let Project-AL forward orders of selected services to an upstream Dhru Fusion
panel (e.g. CeirBot, or any Dhru-compatible supplier) and complete them
automatically from the supplier's status. Together with the existing inbound
Dhru endpoint (`2026-10-01-api-keys-dhru-design.md`) and CeirBot's new inbound
endpoint, the two platforms can consume each other.

## Decisions

| Topic | Decision |
| --- | --- |
| Routing | Per service: `fulfillmentChannel = supplier` + supplier + remote service ID |
| Dispatch | Automatic. Paid orders are forwarded by a worker; no operator involved |
| Protocol | Dhru Fusion Classic (`/api/index.php`, form fields, XML `parameters`) |
| Suppliers | Many, managed by Super Admin; API key encrypted at rest (AES-256-GCM) |
| Encryption key | `SUPPLIER_ENCRYPTION_KEY`, falling back to `ADMIN_JWT_SECRET` (TOTP pattern) |

## Data model

- `Supplier` (`suppliers`): `name`, `baseUrl`, `username`, `apiKeyEnc`,
  `isActive`, `lastBalance`, `lastCheckedAt`, `lastError`.
- `Service`: `supplierId?`, `supplierServiceId?` (remote `SERVICEID`).
- `FulfillmentChannel` gains `supplier`.
- `Order`: `supplierId?`, `supplierRef?` (remote `REFERENCEID`),
  `supplierAttempts`, `supplierError?`, `supplierSubmittedAt?`.

## Flow

1. Order is paid → `waiting_action`. For supplier services operator Telegram /
   WhatsApp notifications are skipped.
2. Worker (every 30 s) takes `waiting_action` orders of supplier services with
   no `supplierRef`: `placeimeiorder` (`ID`, `IMEI`, plus base64 `CUSTOMFIELD`).
   - Success → `in_process`, store `supplierRef`.
   - Supplier `ERROR` (business rejection) → reject + refund to balance.
   - Network / 5xx → `supplierAttempts++`; after 5 attempts reject + refund.
3. Worker polls `in_process` orders with a `supplierRef` via `getimeiorder`:
   - `4` → result `success` with `CODE`/`COMMENTS` as the note → `done`.
   - `3` → reject with the supplier's comment + refund.
   - `0`/`1` → keep waiting.
4. Existing notifications, Dhru API status and webhooks follow the order status.

## Admin UI

- **Supplier API** page: list/add/edit/deactivate, "Tes koneksi" (accountinfo
  balance), remote service list.
- Service form: Jalur proses `API Supplier` → pick supplier → pick remote
  service from the live list; the remote credit pre-fills Harga modal.
- Order detail shows supplier name, reference and last error.

## Inbound compatibility

The inbound endpoint also reads the IMEI from a base64 JSON `CUSTOMFIELD`
(CeirBot's client sends this first).

## Risks

- Loops: a service that forwards to a supplier whose service forwards back.
  Documented; not detected automatically.
- Supplier URL is set by Super Admin only (trusted); HTTP allowed for local
  testing, no SSRF filter beyond protocol check.
