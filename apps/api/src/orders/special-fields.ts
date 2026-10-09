import { type InputType, parseInputType } from "./imei-list";

/** `none` means the service takes no device value; only Layanan Spesial may use it. */
export type ServiceInputType = InputType | "none";

/** Stored in Order.imei when the service has no device value. */
export const NO_DEVICE_VALUE = "-";

export const QNT_MAX = 100_000;
const EMAIL_MAX = 254;
const USERNAME_MAX = 100;
/** Same limit as the order form's optional notes (Order.notes). */
export const NOTES_MAX = 500;
const PASSWORD_MAX = 128;
const KEY_LOCK_MAX = 100;
/** Usually an image link, so allow long URLs. */
const SIGN_IN_PICTURE_MAX = 500;
/** Custom field name as defined at the supplier (iSpider Infinix/Tecno/Itel ID services). */
export const SIGN_IN_PICTURE_FIELD = "Picture on sign-in page";
/** Multi-line, so it may hold a whole code block. */
export const CODE_MAX = 2000;
/** Custom field name sent to the supplier. */
export const CODE_FIELD = "Code";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseServiceInputType(value: unknown): ServiceInputType | undefined {
  return value === "none" ? value : parseInputType(value);
}

export interface ExtraFieldFlags {
  requireQnt: boolean;
  requireEmail: boolean;
  requireUsername: boolean;
  requireNotes: boolean;
  requirePassword: boolean;
  requireKeyLock: boolean;
  requireSignInPicture: boolean;
  requireCode: boolean;
}

export const NO_EXTRA_FIELDS: ExtraFieldFlags = {
  requireQnt: false,
  requireEmail: false,
  requireUsername: false,
  requireNotes: false,
  requirePassword: false,
  requireKeyLock: false,
  requireSignInPicture: false,
  requireCode: false,
};

export interface OrderExtras {
  quantity: number | null;
  email: string | null;
  username: string | null;
  notes: string | null;
  /** Plain text only in memory; stored encrypted as Order.passwordEnc. */
  password: string | null;
  keyLock: string | null;
  signInPicture: string | null;
  codeText: string | null;
}

export const NO_EXTRAS: OrderExtras = {
  quantity: null,
  email: null,
  username: null,
  notes: null,
  password: null,
  keyLock: null,
  signInPicture: null,
  codeText: null,
};

export function hasExtraFields(flags: ExtraFieldFlags): boolean {
  return (
    flags.requireQnt ||
    flags.requireEmail ||
    flags.requireUsername ||
    flags.requireNotes ||
    flags.requirePassword ||
    flags.requireKeyLock ||
    flags.requireSignInPicture ||
    flags.requireCode
  );
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
  raw: {
    qnt?: unknown;
    email?: unknown;
    username?: unknown;
    notes?: unknown;
    password?: unknown;
    keyLock?: unknown;
    signInPicture?: unknown;
    codeText?: unknown;
  },
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

  if (flags.requireNotes) {
    const notes = String(raw.notes ?? "").trim();
    if (!notes) errors.push("Notes wajib diisi.");
    else if (notes.length > NOTES_MAX) errors.push(`Notes maksimal ${NOTES_MAX} karakter.`);
    else extras.notes = notes;
  }

  if (flags.requirePassword) {
    // Not trimmed: spaces can be part of a password.
    const password = typeof raw.password === "string" ? raw.password : String(raw.password ?? "");
    if (!password.trim()) errors.push("Password wajib diisi.");
    else if (password.length > PASSWORD_MAX || /[\r\n]/.test(password)) {
      errors.push(`Password maksimal ${PASSWORD_MAX} karakter dalam satu baris.`);
    } else extras.password = password;
  }

  if (flags.requireKeyLock) {
    const keyLock = String(raw.keyLock ?? "").trim();
    if (!keyLock) errors.push("Key Lock wajib diisi.");
    else if (keyLock.length > KEY_LOCK_MAX || /[\r\n]/.test(keyLock)) {
      errors.push(`Key Lock maksimal ${KEY_LOCK_MAX} karakter dalam satu baris.`);
    } else extras.keyLock = keyLock;
  }

  if (flags.requireSignInPicture) {
    const picture = String(raw.signInPicture ?? "").trim();
    if (!picture) errors.push(`${SIGN_IN_PICTURE_FIELD} wajib diisi.`);
    else if (picture.length > SIGN_IN_PICTURE_MAX || /[\r\n]/.test(picture)) {
      errors.push(`${SIGN_IN_PICTURE_FIELD} maksimal ${SIGN_IN_PICTURE_MAX} karakter dalam satu baris.`);
    } else extras.signInPicture = picture;
  }

  if (flags.requireCode) {
    const code = String(raw.codeText ?? "").trim();
    if (!code) errors.push(`${CODE_FIELD} wajib diisi.`);
    else if (code.length > CODE_MAX) errors.push(`${CODE_FIELD} maksimal ${CODE_MAX} karakter.`);
    else extras.codeText = code;
  }

  return errors.length ? { ok: false, errors } : { ok: true, extras };
}

/** Dhru parameters for the extra fields; empty values are omitted. */
export function supplierExtraFields(extras: OrderExtras): Record<string, string> {
  const fields: Record<string, string> = {};
  if (extras.quantity != null) fields.QNT = String(extras.quantity);
  if (extras.username) fields.USERNAME = extras.username;
  if (extras.email) fields.EMAIL = extras.email;
  if (extras.notes) fields.NOTES = extras.notes;
  if (extras.password) fields.PASSWORD = extras.password;
  if (extras.keyLock) fields.KEYLOCK = extras.keyLock;
  if (extras.signInPicture) fields[SIGN_IN_PICTURE_FIELD] = extras.signInPicture;
  if (extras.codeText) fields[CODE_FIELD] = extras.codeText;
  return fields;
}
