# ZITTOSITE Admin Accounts API — Design

**Date:** 2026-08-03  
**Status:** Approved (rekomendasi A)  
**Depends on:** Admin auth, Super Admin API foundation

## Goal

Super Admin mengelola akun operator dari portal web (create, edit, blokir, hapus) dengan data Postgres. Telegram tetap ditautkan sendiri oleh masing-masing admin di Security.

## Scope

### In

- `GET /admin/admins?q=`
- `POST /admin/admins`
- `PATCH /admin/admins/:id`
- `DELETE /admin/admins/:id`
- `SuperAdminGuard` (caller `role === super_admin`)
- Wire `/admin/admins` + `admin-management.tsx` off mock
- Serialize: `telegramHandle`, `active`, `role`, `handledCount` (count assigned orders)
- Hide/redirect Admins nav for non–super_admin

### Out

- Super Admin set/force Telegram fields
- Reset TOTP orang lain
- Claims / Reports
- Seed tambahan operator (opsional; cukup `superadmin`)

## Decisions

1. Create tanpa Telegram — operator self-link via OAuth
2. Hanya `super_admin` yang CRUD
3. Default `role: admin`; boleh promote ke `super_admin`
4. Tidak boleh blokir/hapus diri sendiri
5. Blokir / ganti password → revoke semua `AdminSession` target
6. Delete: jika ada order assigned → soft `blocked` + revoke; else hard delete jika aman

## API

All routes: `AdminAuthGuard` + `SuperAdminGuard`.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/admin/admins?q=` | — | Search username, fullName, telegramUsername |
| POST | `/admin/admins` | `username, fullName, password, role?` | password ≥ 8; role default `admin` |
| PATCH | `/admin/admins/:id` | `fullName?, role?, status?, password?` | status `active` \| `blocked` |
| DELETE | `/admin/admins/:id` | — | soft or hard per rules above |

### Response shape (list item)

```ts
{
  id, username, fullName, role,
  telegramHandle: string | null, // from telegramUsername, with @ if present
  active: boolean,               // status === active
  handledCount: number,
  totpEnabled: boolean,          // optional display
  createdAt: string
}
```

### Errors

- 403 — caller bukan super_admin
- 400 — self block/delete; password < 8; invalid role/status
- 404 — admin tidak ada
- 409 — username duplikat

## Web

- Page SSR: `serverApi("/admin/admins")`
- Client mutate via `api()` + `router.refresh()`
- Create form: username, fullName, password, role (tanpa Telegram wajib)
- Edit: fullName, role, status, password opsional
- Telegram column: handle atau “Belum ditautkan”
- Layout/nav: sembunyikan “Admins” jika `me.role !== "super_admin"`; page redirect ke dashboard

## Success criteria

1. Login `superadmin` → buat operator → operator login dengan password
2. Blokir operator → login gagal; session lama invalid
3. Operator `admin` tidak bisa akses `/admin/admins` (403 API + redirect UI)
4. Tidak bisa blokir/hapus akun sendiri
5. `handledCount` mencerminkan order `assignedAdminId`
