// Keep in sync with apps/api/src/orders/imei-list.ts — the API enforces the same rules.
export const IMEI_LENGTH = 15;
export const MAX_BULK_IMEIS = 6;
export const MAX_SPECIAL_BULK = 2;

/** Most values one bulk order may carry; Layanan Spesial allows fewer. */
export function maxBulkFor(service: { via?: string; menu?: string | null } | null): number {
  return service?.via === "supplier" && service.menu === "special"
    ? MAX_SPECIAL_BULK
    : MAX_BULK_IMEIS;
}

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
const PHONE_MAX = 15;
/** Local (08…) or international (628…) Indonesian mobile number; the API stores it as 08…. */
const PHONE_PATTERN = /^(?:08|628)\d{8,11}$/;

export type ImeiListResult = { imeis: string[]; errors: string[] };

/** IMEI and phone numbers keep digits only; SN/ECID keep letters and digits, uppercased. */
export function normalizeInput(raw: string, type: InputType): string {
  if (type === "phone") return raw.replace(/\D/g, "").slice(0, PHONE_MAX);
  return type === "imei"
    ? raw.replace(/\D/g, "").slice(0, IMEI_LENGTH)
    : raw.replace(/[^0-9a-z]/gi, "").toUpperCase().slice(0, CODE_MAX);
}

/** Error for one complete value, or undefined when it is acceptable. */
export function inputLengthError(value: string, type: InputType): string | undefined {
  if (type === "phone") {
    return PHONE_PATTERN.test(value) ? undefined : "Nomor HP harus diawali 08 dan 10–13 digit.";
  }
  if (type === "imei") {
    return value.length === IMEI_LENGTH
      ? undefined
      : `IMEI harus ${IMEI_LENGTH} digit (saat ini ${value.length}).`;
  }
  if (value.length < CODE_MIN || value.length > CODE_MAX) {
    return `${INPUT_TYPE_LABEL[type]} harus ${CODE_MIN}–${CODE_MAX} huruf/angka (saat ini ${value.length}).`;
  }
  return undefined;
}

/** One value per line; blank lines ignored, 1-based line numbers. */
export function parseImeiList(
  text: string,
  type: InputType = "imei",
  max = MAX_BULK_IMEIS,
): ImeiListResult {
  const label = INPUT_TYPE_LABEL[type];
  const errors: string[] = [];
  const imeis: string[] = [];
  const firstLine = new Map<string, number>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const value =
      type === "imei" || type === "phone"
        ? raw.replace(/\D/g, "")
        : raw.replace(/[^0-9a-z]/gi, "").toUpperCase();
    if (!value) return;
    const invalid = inputLengthError(value, type);
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

  if (!errors.length && imeis.length > max) {
    errors.push(`Maksimal ${max} ${label} per order (saat ini ${imeis.length}).`);
  }
  return { imeis, errors };
}
