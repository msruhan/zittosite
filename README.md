# ZITTOSITE

Digital IMEI Activation Platform — successor to CeirBot with a manual Telegram-first order workflow.

## Status

Auth, Security, Telegram linking, Order foundation, Telegram order workflow, Super Admin API, Admin accounts API, Reports API. Payment gateway / QRIS nyata **ditunda** (bayar pakai mark-paid simulasi). Claim UI dihapus dari produk.

## CI/CD (GitHub Actions → VPS)

Workflows di `.github/workflows/`:

| Workflow | Trigger | Fungsi |
| --- | --- | --- |
| **CI** | push / PR ke `main` | `typecheck` + `build` web |
| **Release & Deploy** | push ke `main` / manual | bump semver (`vX.Y.Z` tag) + deploy **web + API + Postgres** ke VPS via SSH |

Stack di VPS: Docker Compose (`docker-compose.prod.yml`) di `/opt/zittosite`.

- Web: `http://VPS_HOST:3000`
- API: `http://VPS_HOST:4000/health`

### Secrets (Repo → Settings → Secrets and variables → Actions)

| Secret | Contoh | Keterangan |
| --- | --- | --- |
| `VPS_HOST` | `187.53.138.144` | IP / hostname VPS |
| `VPS_USER` | `root` | User SSH |
| `VPS_SSH_PRIVATE_KEY` | isi file private key deploy | Key khusus GitHub Actions (ed25519) |
| `VPS_DEPLOY_PATH` | `/opt/zittosite` | Opsional; default `/opt/zittosite` |

Buat Environment GitHub bernama **`production`** (Settings → Environments) agar job deploy bisa memakai secrets environment.

### Setup VPS (sekali)

1. Install Docker Engine + Compose plugin.
2. Buat `/opt/zittosite` dan isi `.env` dari `.env.production.example` (password/JWT kuat).
3. Pasang public key deploy ke `/root/.ssh/authorized_keys`.
4. Push ke `main` atau jalankan workflow **Release & Deploy** (Actions → Run workflow).

Deploy manual di server:

```bash
cd /opt/zittosite
bash scripts/deploy.sh
```

## Run

```bash
cp .env.example .env
docker compose up -d postgres
npm install
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run api:dev   # :4000
npm run web:dev   # :3000
```

Isi `TELEGRAM_*` di `.env` agar bot + OAuth aktif (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, OAuth client/secret, `TELEGRAM_OAUTH_REDIRECT_URI`, `TELEGRAM_MODE=polling`, `WEB_PUBLIC_URL`).

## Seed accounts

| Username | Password | Role | Login |
| --- | --- | --- | --- |
| `superadmin` | `admin123` | Super Admin | `/admin/login` |
| `operator` | `admin123` | Admin (ops Telegram) | `/admin/login` |
| `fajri` | `user1234` | User | `/login` |
| `siti.aminah` | `user1234` | User | `/login` |
| `agus123` | `user1234` | User | `/login` |

## Operator runbook

### 1. Super Admin (website)

1. Login `superadmin` di `/admin/login`
2. **Users** — buat/edit user, set harga khusus bila perlu
3. **Admins** — buat operator (default role Admin); Telegram ditautkan sendiri oleh operator
4. **Services** — aktifkan/nonaktifkan layanan & harga
5. **Orders / Reports** — pantau; override status hanya bila darurat
6. **Settings** — konfigurasi produk (Super Admin saja)
7. Security: aktifkan TOTP, lalu tautkan Telegram di `/admin/security`

### 2. Operator admin (website + Telegram)

**Website (terbatas):** Orders, Reports, Security, Dashboard. Tidak ada akses Users / Services / Admins / Settings. Identitas pelanggan (nama, username, Telegram) **disembunyikan** — cari order lewat Order ID atau IMEI. Override status manual hanya Super Admin.

1. Login `operator` di `/admin/login` → Security → TOTP → tautkan Telegram
2. Di bot: `/start` sampai chat tertaut
3. Saat user bayar (mark-paid), terima kartu order (tanpa nama pelanggan) → **Terima** / **Tolak** → **Done** + hasil
4. `/riwayat` — antrean `waiting_action` + order yang sedang dipegang

### 3. User (website + bot)

1. Login di `/login` → **Telegram** (`/app/telegram`) untuk tautkan bot
2. Buat order di `/app/order` atau bot `/order`
3. Bayar di `/app/order/{id}/bayar` → tombol **Simulasikan pembayaran** (dev)
4. Status: `/app/order/{id}/status` atau bot `/riwayat` / notifikasi

### 4. Alur order end-to-end

`waiting_payment` → mark-paid → `waiting_action` → admin Terima → `in_process` → Done → `done` (+ `OrderResult`)

Jalur keluar: user/sistem `cancel`, admin `rejected`.

## Bot commands

| Command | User | Admin |
| --- | --- | --- |
| `/start` | ✓ | ✓ |
| `/status` | ✓ | ✓ |
| `/saldo` | ✓ | ✓ (info) |
| `/order` | buat order → link bayar web | — |
| `/riwayat` | 5 order terakhir | antrean / order saya |

## Specs

`docs/superpowers/specs/`
