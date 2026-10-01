export const IMEI_LENGTH = 15;
export const MAX_BULK_IMEIS = 6;

export type InputType = "imei" | "sn" | "ecid";

export const INPUT_TYPE_LABEL: Record<InputType, string> = {
  imei: "IMEI",
  sn: "SN",
  ecid: "ECID",
};

const CODE_MIN = 4;
const CODE_MAX = 40;

export function parseInputType(value: unknown): InputType | undefined {
  return value === "imei" || value === "sn" || value === "ecid" ? value : undefined;
}

export type ImeiListResult =
  | { ok: true; imeis: string[] }
  | { ok: false; errors: string[] };

/** IMEI keeps digits only; SN/ECID keep letters and digits, uppercased. */
function normalize(raw: string, type: InputType): string {
  return type === "imei"
    ? raw.replace(/\D/g, "")
    : raw.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function lengthError(value: string, type: InputType): string | null {
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
export function parseImeiList(input: string | string[], type: InputType = "imei"): ImeiListResult {
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
  if (imeis.length > MAX_BULK_IMEIS) {
    return {
      ok: false,
      errors: [`Maksimal ${MAX_BULK_IMEIS} ${label} per order (saat ini ${imeis.length}).`],
    };
  }
  return { ok: true, imeis };
}
