import type { InputType } from "./imei-list";

/** `none` means the service takes no device value; only Layanan Spesial may use it. */
export type ServiceInputType = InputType | "none";

/** Stored in Order.imei when the service has no device value. */
export const NO_DEVICE_VALUE = "-";

export const QNT_MAX = 100_000;
const EMAIL_MAX = 254;
const USERNAME_MAX = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseServiceInputType(value: unknown): ServiceInputType | undefined {
  return value === "imei" || value === "sn" || value === "ecid" || value === "none"
    ? value
    : undefined;
}

export interface ExtraFieldFlags {
  requireQnt: boolean;
  requireEmail: boolean;
  requireUsername: boolean;
}

export interface OrderExtras {
  quantity: number | null;
  email: string | null;
  username: string | null;
}

export const NO_EXTRAS: OrderExtras = { quantity: null, email: null, username: null };

export function hasExtraFields(flags: ExtraFieldFlags): boolean {
  return flags.requireQnt || flags.requireEmail || flags.requireUsername;
}

/** The Telegram bot only collects device values, so these services are website/API only. */
export function needsExtraInput(service: ExtraFieldFlags & { inputType: string }): boolean {
  return service.inputType === "none" || hasExtraFields(service);
}

/**
 * Validates the extra fields a service requires. Fields the service does not
 * require are dropped, so stale input never reaches the order or supplier.
 */
export function parseOrderExtras(
  flags: ExtraFieldFlags,
  raw: { qnt?: unknown; email?: unknown; username?: unknown },
): { ok: true; extras: OrderExtras } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const extras: OrderExtras = { ...NO_EXTRAS };

  if (flags.requireQnt) {
    const text = String(raw.qnt ?? "").trim();
    const qnt = Number(text);
    if (!text) errors.push("Qnt wajib diisi.");
    else if (!Number.isInteger(qnt) || qnt < 1 || qnt > QNT_MAX) {
      errors.push(`Qnt harus bilangan bulat 1–${QNT_MAX.toLocaleString("id-ID")}.`);
    } else extras.quantity = qnt;
  }

  if (flags.requireEmail) {
    const email = String(raw.email ?? "").trim();
    if (!email) errors.push("Email wajib diisi.");
    else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
      errors.push("Format email tidak valid.");
    } else extras.email = email;
  }

  if (flags.requireUsername) {
    const username = String(raw.username ?? "").trim();
    if (!username) errors.push("Username wajib diisi.");
    else if (username.length > USERNAME_MAX || /[\r\n]/.test(username)) {
      errors.push(`Username maksimal ${USERNAME_MAX} karakter dalam satu baris.`);
    } else extras.username = username;
  }

  return errors.length ? { ok: false, errors } : { ok: true, extras };
}

/** Dhru parameters for the extra fields; empty values are omitted. */
export function supplierExtraFields(extras: OrderExtras): Record<string, string> {
  const fields: Record<string, string> = {};
  if (extras.quantity != null) fields.QNT = String(extras.quantity);
  if (extras.username) fields.USERNAME = extras.username;
  if (extras.email) fields.EMAIL = extras.email;
  return fields;
}
