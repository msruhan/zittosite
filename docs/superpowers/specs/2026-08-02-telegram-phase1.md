# ZITTOSITE Telegram — Phase 1

**Date:** 2026-08-02  
**Status:** Approved (recomendasi Fase 1)  
**Pattern:** CeirBot OAuth + deep-link `/start`

## Scope

1. Schema: `UserIdentity`, `TelegramLinkToken`, Admin Telegram fields, `creditBalance` on User  
2. OAuth link (user + admin) + chat verify via bot `/start <token>`  
3. Bot commands: `/start`, `/status`, `/saldo`  
4. Web: `/app/telegram` (Bot Center), OAuth callback, Admin Security Telegram section  
5. `AdminNotifyService`: broadcast to linked admin chats (hooks ready for user baru / order baru)

## Out of scope (Fase 2+)

- `/order`, `/riwayat` di bot  
- Admin Terima/Tolak/Done order dari bot  
- Top-up + payment gateway  

## Env

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_OAUTH_CLIENT_ID=
TELEGRAM_OAUTH_CLIENT_SECRET=
TELEGRAM_OAUTH_REDIRECT_URI=http://localhost:3000/auth/telegram/callback
TELEGRAM_MODE=polling
WEB_PUBLIC_URL=http://localhost:3000
```
