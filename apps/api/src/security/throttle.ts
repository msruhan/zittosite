/** Per-IP limits for credential endpoints (login, 2FA). */
export const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/** Per-IP limits for authenticated account-security actions. */
export const SENSITIVE_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
