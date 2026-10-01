# Design: User groups with group pricing

**Date:** 2026-10-01
**Status:** Approved

## Goal

Super Admin puts users into a group (e.g. "Group A") and sets a fixed price per
service for that group. Users start on the service's default price; Super Admin
can give a user personal prices or put them in a group instead.

## Decisions

- One group per user (`users.group_id`, nullable).
- Group pricing is a fixed price per service. A service without a group price
  falls back to the service default.
- Group and personal prices are mutually exclusive: joining a group deletes the
  user's personal prices; the Users page locks "Harga khusus" while a group is set.
- Price changes affect new orders only. Users never see their group name.

## Price resolution

One function `resolveUserPrice` used by `listServices` (web + bot menus) and
`createOrder` (web + bot):

1. User in a group → group price for the service, else service default.
2. No group → personal price for the service, else service default.

## Data

- `user_groups`: id, name (unique), description, timestamps.
- `user_group_prices`: (group_id, service_id) PK, price. Cascade on group/service delete.
- `users.group_id` → `user_groups.id`, `ON DELETE SET NULL`.

## API (Super Admin)

- `GET /admin/groups` — groups with prices and member count.
- `POST /admin/groups`, `PATCH /admin/groups/:id` — name, description, prices.
- `DELETE /admin/groups/:id` — members fall back to "no group".
- `PUT /admin/groups/:id/members` — replace the member list (`userIds`).
- `POST/PATCH /admin/users` accept `groupId` (null = no group).

All mutations are written to the activity log.

## Web

- New admin page `/admin/groups` (nav "Groups"): table, create/edit dialog with
  per-service prices, members dialog, delete confirm.
- Users page: group select in the user form; custom prices locked when a group
  is chosen; group shown in the user table.

## Testing

Unit tests for `resolveUserPrice`; API + web typecheck.
