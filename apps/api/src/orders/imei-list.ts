export const IMEI_LENGTH = 15;
export const MAX_BULK_IMEIS = 6;
export const MAX_SPECIAL_BULK = 2;

/** `imei_sn` takes either: 15 digits count as an IMEI, anything else as an SN. */
export type InputType = "imei" | "sn" | "ecid" | "imei_sn" | "phone";

export const INPUT_TYPE_LABEL: Record<InputType, string> = {
  imei: "IMEI",
  sn: "SN",
  ecid: "ECID",
  imei_sn: "IMEI/SN",
  phone: "Nomor HP",
};

const CODE_MIN = 4;
const CODE_MAX = 40;
/** Indonesian mobile number in local form: 08 followed by 8–11 digits. */
const PHONE_PATTERN = /^08\d{8,11}$/;

export function parseInputType(value: unknown): InputType | undefined {
  return value === "imei" ||
    value === "sn" ||
    value === "ecid" ||
    value === "imei_sn" ||
    value === "phone"
    ? value
    : undefined;
}

/** "+62 812-3456-789" / "62812…" / "0812…" → "0812…". */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}

/** Whether an `imei_sn` value is an IMEI (exactly 15 digits) rather than an SN. */
export function looksLikeImei(value: string): boolean {
  return new RegExp(`^\\d{${IMEI_LENGTH}}$`).test(value);
}

export type ImeiListResult =
  | { ok: true; imeis: string[] }
  | { ok: false; errors: string[] };

/** IMEI keeps digits only; SN/ECID keep letters and digits, uppercased. */
function normalize(raw: string, type: InputType): string {
  if (type === "phone") return normalizePhone(raw);
  return type === "imei"
    ? raw.replace(/\D/g, "")
    : raw.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function lengthError(value: string, type: InputType): string | null {
  if (type === "phone") {
    return PHONE_PATTERN.test(value) ? null : "Nomor HP harus diawali 08 dan 10–13 digit.";
  }
  if (type === "imei") {
    return value.length === IMEI_LENGTH
      ? null
      : `IMEI harus ${IMEI_LENGTH} digit (saat ini ${value.length}).`;
  }
  const label = INPUT_TYPE_LABEL[type];
  if (value.length < CODE_MIN || value.length > CODE_MAX) {
    return `${label} harus ${CODE_MIN}–${CODE_MAX} huruf/angka (saat ini ${value.length}).`;
  }
  return null;
}

/**
 * Parses one value per line (or per array entry) for the service's input type.
 * Blank lines are ignored; line numbers in errors are 1-based over the raw input.
 */
export function parseImeiList(
  input: string | string[],
  type: InputType = "imei",
  max = MAX_BULK_IMEIS,
): ImeiListResult {
  const label = INPUT_TYPE_LABEL[type];
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  const errors: string[] = [];
  const imeis: string[] = [];
  const firstLine = new Map<string, number>();

  lines.forEach((raw, index) => {
    const line = index + 1;
    const value = normalize(String(raw ?? ""), type);
    if (!value) return;
    const invalid = lengthError(value, type);
    if (invalid) {
      errors.push(`Baris ${line}: ${invalid}`);
      return;
    }
    const seen = firstLine.get(value);
    if (seen !== undefined) {
      errors.push(`Baris ${line}: duplikat dengan baris ${seen}.`);
      return;
    }
    firstLine.set(value, line);
    imeis.push(value);
  });

  if (errors.length) return { ok: false, errors };
  if (!imeis.length) return { ok: false, errors: [`Masukkan minimal 1 ${label}.`] };
  if (imeis.length > max) {
    return {
      ok: false,
      errors: [`Maksimal ${max} ${label} per order (saat ini ${imeis.length}).`],
    };
  }
  return { ok: true, imeis };
}
