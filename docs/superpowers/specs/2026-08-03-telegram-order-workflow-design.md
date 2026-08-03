# ZITTOSITE Telegram Order Workflow — Phase 3

**Date:** 2026-08-03  
**Status:** Approved (opsi C: admin Telegram + bot user `/order` `/riwayat`)  
**Depends on:** Order foundation, Telegram Phase 1 linking

## Goal

Admin mengerjakan order sepenuhnya dari Telegram. User dapat membuat order dan melihat riwayat dari bot. Pembayaran tetap via web (QRIS placeholder / mark-paid).

## Scope

### In

1. Broadcast notifikasi order baru ke admin tertaut saat status `waiting_action`
2. Inline **Terima** / **Tolak**; after accept: **Done**
3. First-accept-wins (atomic)
4. Reject reason + Done wizard (`resultStatus` + `resultNote` → `OrderResult`)
5. Notifikasi Telegram ke user pada accept / reject / done / paid→queue
6. User bot: `/order`, `/riwayat` (+ existing `/start` `/status` `/saldo`)
7. Persist outbound admin notification message ids for edit-after-accept

### Out

- Real QRIS gateway
- Super Admin order override API
- Claim
- WhatsApp
- Admin website as work surface

## Data

### `OrderTelegramNotification` (new)

| Field | Notes |
| --- | --- |
| id | cuid |
| orderId | FK Order |
| adminId | FK Admin |
| chatId | string |
| messageId | string? |
| notifiedAt | DateTime? |
| lastError | string? |
| unique | (orderId, adminId) |

### Admin conversation state (in-memory Map, process-local)

Key: `chatId` → `{ kind: 'reject' \| 'done_status' \| 'done_note' \| 'user_order', ...orderId, partial }`  
Acceptable for Phase 3; lost on API restart (admin can restart flow from buttons).

## Flows

### Mark-paid / waiting_action

After order becomes `waiting_action`:
1. Activity already logged
2. `AdminNotifyService.notifyNewOrder(orderId)` → send to all linked admin chats with inline keyboard
3. Upsert `OrderTelegramNotification`
4. Optionally notify user chat: “Pembayaran OK, menunggu admin”

### Terima (`ord:accept:{orderId}`)

Transaction:
1. `UPDATE ... WHERE status = waiting_action` set `in_process`, `assignedAdminId`, `startedAt`
2. If count ≠ 1 → “sudah diambil”
3. Activity log
4. Edit all sibling admin messages (remove buttons / show taken by X)
5. Notify user

### Tolak (`ord:reject:{orderId}`)

- From `waiting_action`: any linked admin
- From `in_process`: only assigned admin
- Set pending reject state → ask reason text → set `rejected`, activity, notify user, clear buttons

### Done (`ord:done:{orderId}`)

- Only assigned admin, status `in_process`
- Ask resultStatus via inline (success / partial / failed)
- Ask resultNote text
- Create `OrderResult`, set `done` + `completedAt`, activity, notify user

### User `/order`

Conversation:
1. List active services (buttons)
2. Ask IMEI (15 digit)
3. Confirm summary
4. `OrdersService.createOrder` channel=`telegram`
5. Reply with payment URL `${WEB}/app/order/{orderId}/bayar`

Block if existing `waiting_payment` (same as web).

### User `/riwayat`

Last 5 orders for linked user: orderId, service, status, masked IMEI.

## Bot commands

| Command | User | Admin |
| --- | --- | --- |
| `/start` | ✓ | ✓ |
| `/status` | ✓ | ✓ |
| `/saldo` | ✓ | ✓ (info only) |
| `/order` | ✓ | — (info: admin tidak order) |
| `/riwayat` | ✓ | ✓ (optional: assigned/open summary) |

Admin `/riwayat`: 5 recent `waiting_action` + own `in_process` (helpful ops).

## API / module hooks

- `OrdersService.markPaid` → call notify after commit
- New methods: `acceptOrder`, `rejectOrder`, `completeOrder` (used by bot; can stay internal)
- `AdminNotifyService`: `notifyNewOrder`, `syncOrderCards`, `notifyUser`

## Success criteria

1. User mark-paid (web) → admins get Telegram card
2. Two admins tap Terima → only one wins
3. Done saves OrderResult; user sees Done on web + Telegram ping
4. User `/order` creates unpaid order + payment link
5. `/riwayat` lists real orders

## Testing (manual)

- Linked admin + user required (`TELEGRAM_BOT_TOKEN` set)
- Seed/login web mark-paid then watch admin chat
- Accept race (two chats if two admins)
- Reject + Done paths
- User bot order + bayar di web
