# ZITTOSITE Security + API Foundation

**Date:** 2026-08-02  
**Status:** Approved  
**Pattern:** Mirror CeirBot (`NestJS` + `Prisma` + `PostgreSQL`)

## Goal

Replace stub auth with a real database-backed API and add Security surfaces:

| Portal | Route | Features |
| --- | --- | --- |
| User | `/app/security` | Change password |
| Super Admin | `/admin/security` | Change password + Google Authenticator (TOTP) |

2FA is **admin-only** (CeirBot pattern A). User 2FA is out of scope.

## Architecture

- `apps/api` — NestJS REST API on port `4000`
- `apps/web` — Next.js UI on port `3000`, calls API with `credentials: 'include'`
- PostgreSQL via Docker Compose (host port `5433`)
- JWT in httpOnly cookies: `zittosite_user_token`, `zittosite_admin_token`

## Data model (phase 1)

- `User` — username, passwordHash, fullName, telegram, status, botAccess
- `Admin` — username, passwordHash, fullName, role, status, totpSecret, totpEnabledAt, totpPrefs
- `UserSession` / `AdminSession` — session rows bound to JWT `jti`
- `SystemSetting` — optional TOTP mandatory prefs

## API surface

### User
- `POST /auth/login` `{ username, password }`
- `POST /auth/logout`
- `GET /me`
- `POST /me/password` `{ currentPassword, newPassword }`

### Admin
- `POST /admin/auth/login` `{ username, password }` → may return `requiresTotp` + `pendingToken`
- `POST /admin/auth/totp` `{ pendingToken, code }`
- `POST /admin/auth/logout`
- `GET /admin/me`
- `POST /admin/me/password` `{ currentPassword, newPassword, totpCode? }`
- `GET /admin/me/totp`
- `POST /admin/me/totp/setup` → `{ qrDataUrl, secret }`
- `POST /admin/me/totp/enable` `{ code }`
- `POST /admin/me/totp/disable` `{ password, code }`

## Seed accounts

| Username | Password | Role |
| --- | --- | --- |
| `superadmin` | `admin123` | Super Admin |
| `fajri` | `user1234` | User |
| `siti.aminah` | `user1234` | User |

## Out of scope (later)

- Migrate orders/claims/reports off mock data
- Telegram bot
- User TOTP
- Full CeirBot TOTP policy matrix (topup, deposits, etc.)

## Run

```bash
cp .env.example .env
docker compose up -d postgres
npm install
cd apps/api && npx prisma migrate dev && npx prisma db seed
npm run api:dev   # :4000
npm run web:dev   # :3000
```
