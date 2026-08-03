# Implementation Plan — Role Access Alignment

**Spec:** `docs/superpowers/specs/2026-08-03-role-access-alignment-design.md`  
**Date:** 2026-08-03  
**Goal:** Restrict Admin website to Orders + Reports + Security; redact customer identity from Admin (API, web UI, Telegram); keep Super Admin full access.

## Out of scope (do not implement here)

- Payment gateway, CEIR API, auto Telegram link  
- New DB roles  
- Rework of Terima/Tolak/Done semantics  

---

## Task 1 — Super Admin–only Users & Services API

**Files:** `apps/api/src/admin/admin-ops.controller.ts`

1. Add `@UseGuards(SuperAdminGuard)` to:
   - `GET/POST/PATCH/DELETE` users routes  
   - `GET/POST/PATCH` services routes  
2. Leave `dashboard/stats`, `reports/summary`, `orders` list/get open to any authenticated admin.  
3. Add `@UseGuards(SuperAdminGuard)` to `PATCH orders/:orderId/status` (status override = Super Admin only).

**Verify:** As `operator`, `GET /admin/users` and `GET /admin/services` → 403; `GET /admin/orders` → 200. As `superadmin`, all → 200.

---

## Task 2 — Role-aware order serialization (PII redaction)

**Files:**  
- `apps/api/src/orders/orders.serializer.ts`  
- `apps/api/src/admin/admin-orders.service.ts`  
- `apps/api/src/admin/admin-ops.controller.ts` (pass caller role)

1. Extend `serializeOrderListItem(order, opts?: { redactUser?: boolean })`.  
   When `redactUser: true`, set `user` to `null` (or omit identity fields: no `fullName` / `username` / `telegramHandle`).  
2. In `AdminOrdersService.list/get/dashboardStats`, accept admin role (or `redactUser` flag) from controller via `req.admin.role`.  
3. User-facing `/orders` serializers unchanged (user still sees own data).

**Verify:** Admin order JSON has no customer name/username/handle; Super Admin JSON still includes them.

---

## Task 3 — Telegram admin cards without user name

**Files:**  
- `apps/api/src/telegram/telegram-messages.ts` (`newOrderAdminHtml` / related)  
- `apps/api/src/telegram/admin-notify.service.ts`

1. Remove `User` / `userName` row from admin order notification HTML.  
2. Keep Order ID, masked IMEI, service, price, status, buttons.  
3. Stop passing `userName: order.user.fullName` from notify service (or ignore it).

**Verify:** New paid order Telegram card has no customer name.

---

## Task 4 — Admin website nav & route guards

**Files:**  
- `apps/web/src/lib/navigation.ts` (optional: document intended admin vs super sets)  
- `apps/web/src/app/admin/(panel)/layout.tsx`  
- Pages: `users`, `services`, `admins`, `settings` (redirect if not super_admin)

1. Expand `hideHrefs` for role `admin` to include:  
   `/admin/users`, `/admin/services`, `/admin/admins`, `/admin/settings`  
   Keep visible: Dashboard (optional), Orders, Reports, Security.  
2. On those restricted pages: if `me.role !== "super_admin"`, `redirect("/admin/orders")` (defense in depth; Admins page may already do this).  
3. Order detail UI: hide “Pihak terkait” / user block when role is `admin`.  
4. Order search UI: for Admin, do not offer/search by user name (API already redacts; avoid sending `q` that only matches names if easy — prefer documenting that Admin search is Order ID / IMEI).

**Verify:** Login as `operator` — sidebar without Users/Services/Admins/Settings; direct URL to `/admin/users` redirects.

---

## Task 5 — Docs & smoke check

**Files:** `README.md` (operator runbook), optionally `docs/RUNBOOK.md`

1. Update operator section: website = Orders + Reports + Security; no Users/Services; identity hidden.  
2. Manual smoke (local):  
   - `operator` / `admin123` — menus + redacted orders + Telegram card  
   - `superadmin` / `admin123` — full menus + identity visible  
   - Create-order form still shows UNKNOWN / infoceir.com warning  

---

## Suggested order of work

1 → 2 → 3 → 4 → 5  

API first so UI cannot leak via fetch; Telegram next; nav last; docs/smoke.

## Done when

- [ ] Admin 403 on Users/Services/Admins APIs and status override  
- [ ] Admin order payloads & Telegram cards have no customer PII  
- [ ] Super Admin unchanged for identity + full menus  
- [ ] Admin sidebar limited; restricted routes redirect  
- [ ] README/runbook updated  
- [ ] Spec checklist in design doc satisfied  
