# ZITTOSITE Super Admin API — Design

**Date:** 2026-08-03  
**Status:** Approved (rekomendasi A)  
**Depends on:** Auth admin, Order foundation

## Goal

Portal Super Admin memakai data Postgres nyata untuk user, layanan, order, dan statistik dashboard. Operasional order harian tetap di Telegram.

## Scope

### In

- `GET/POST /admin/users`, `PATCH /admin/users/:id`, reset password, soft-delete/suspend
- `GET/POST /admin/services`, `PATCH /admin/services/:id`
- `GET /admin/orders`, `GET /admin/orders/:orderId`, `PATCH` status override + activity
- `GET /admin/dashboard/stats`
- Wire `/admin/dashboard`, `/admin/users`, `/admin/services`, `/admin/orders`, detail order

### Out

- CRUD Admin accounts (tetap mock)
- Claims / Reports API
- Real payment gateway

## Rules

- All routes: `AdminAuthGuard`
- User delete: if has orders → suspend only (409 with message) or force suspend; prefer suspend
- Status override always writes `OrderActivityLog` with actor = admin fullName
- Service `code` unique, immutable after create (or allow edit carefully)
