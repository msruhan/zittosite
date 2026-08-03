# ZITTOSITE Runbook

**Date:** 2026-08-03  
**Audience:** developer / Super Admin yang menjalankan staging lokal

## Prasyarat

- Docker (Postgres di port `5433` via `docker compose`)
- Node.js + npm
- (Opsional) Bot Telegram + OAuth credentials

## Bootstrap

```bash
cp .env.example .env
# isi JWT secrets + TELEGRAM_* bila perlu bot
docker compose up -d postgres
npm install
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run api:dev
npm run web:dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:3000`

## Akun seed

| Username | Password | Role |
| --- | --- | --- |
| `superadmin` | `admin123` | Super Admin |
| `operator` | `admin123` | Admin |
| `fajri` / `siti.aminah` / `agus123` | `user1234` | User |

## Smoke test (tanpa Telegram)

1. Login user `fajri` → Buat Order → Bayar → Simulasikan pembayaran
2. Login `superadmin` → Orders: status `waiting_action`
3. Login `operator` → pastikan menu Admins **tidak** tampil
4. Logout memanggil API + clear cookie

## Smoke test (dengan Telegram)

1. `superadmin` + `operator`: Security → TOTP → taut Telegram; bot `/start`
2. User `fajri`: `/app/telegram` → taut; bot `/start`
3. Mark-paid dari web → kartu order ke chat admin → Terima → Done
4. User menerima notifikasi / lihat status di web

## Keamanan sesi

- Request terautentikasi menolak akun `blocked` / `suspended`
- Ganti password / blokir / reset password admin: revoke semua session + clear cookie (self password)
- Logout selalu clear cookie meski sesi sudah invalid

## Ditunda

- Payment gateway QRIS nyata
- Fitur claim user
