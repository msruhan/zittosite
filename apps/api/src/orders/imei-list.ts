export const IMEI_LENGTH = 15;
export const MAX_BULK_IMEIS = 6;

export type ImeiListResult =
  | { ok: true; imeis: string[] }
  | { ok: false; errors: string[] };

/**
 * Parses one IMEI per line (or per array entry). Non-digits are stripped and
 * blank lines ignored; line numbers in errors are 1-based over the raw input.
 */
export function parseImeiList(input: string | string[]): ImeiListResult {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  const errors: string[] = [];
  const imeis: string[] = [];
  const firstLine = new Map<string, number>();

  lines.forEach((raw, index) => {
    const line = index + 1;
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits) return;
    if (digits.length !== IMEI_LENGTH) {
      errors.push(
        `Baris ${line}: IMEI harus ${IMEI_LENGTH} digit (saat ini ${digits.length}).`,
      );
      return;
    }
    const seen = firstLine.get(digits);
    if (seen !== undefined) {
      errors.push(`Baris ${line}: duplikat dengan baris ${seen}.`);
      return;
    }
    firstLine.set(digits, line);
    imeis.push(digits);
  });

  if (errors.length) return { ok: false, errors };
  if (!imeis.length) return { ok: false, errors: ["Masukkan minimal 1 IMEI."] };
  if (imeis.length > MAX_BULK_IMEIS) {
    return {
      ok: false,
      errors: [`Maksimal ${MAX_BULK_IMEIS} IMEI per order (saat ini ${imeis.length}).`],
    };
  }
  return { ok: true, imeis };
}
