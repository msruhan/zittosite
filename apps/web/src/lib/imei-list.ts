// Keep in sync with apps/api/src/orders/imei-list.ts — the API enforces the same rules.
export const IMEI_LENGTH = 15;
export const MAX_BULK_IMEIS = 6;

export type ImeiListResult = { imeis: string[]; errors: string[] };

/** One IMEI per line; non-digits stripped, blank lines ignored, 1-based line numbers. */
export function parseImeiList(text: string): ImeiListResult {
  const errors: string[] = [];
  const imeis: string[] = [];
  const firstLine = new Map<string, number>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const digits = raw.replace(/\D/g, "");
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

  if (!errors.length && imeis.length > MAX_BULK_IMEIS) {
    errors.push(
      `Maksimal ${MAX_BULK_IMEIS} IMEI per order (saat ini ${imeis.length}).`,
    );
  }
  return { imeis, errors };
}
