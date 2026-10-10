import { BadRequestException } from "@nestjs/common";

/** Layanan Spesial rate until a super admin sets one. */
export const DEFAULT_USD_RATE = 17_000;
export const USD_RATE_KEY = "special_usd_rate";
const MAX_USD = 100_000;

export function usdCentsToIdr(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100);
}

/**
 * Supplier credit in the units of a menu: USD cents for USD menus, Rupiah
 * otherwise. Without a declared currency, USD menus read the credit as dollars
 * and Rupiah menus as Rupiah.
 */
export function supplierCreditToMenuUnits(
  credit: number,
  creditCurrency: "IDR" | "USD" | null,
  menuCurrency: "IDR" | "USD",
  rate: number,
): number {
  const from = creditCurrency ?? menuCurrency;
  if (from === menuCurrency) return Math.round(credit * (menuCurrency === "USD" ? 100 : 1));
  return menuCurrency === "USD" ? Math.round((credit * 100) / rate) : Math.round(credit * rate);
}

/** Dollars from the client (e.g. 1.25) to whole cents; undefined when absent. */
export function parseUsdCents(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > MAX_USD) {
    throw new BadRequestException(`${field} tidak valid.`);
  }
  return Math.round(dollars * 100);
}

export function parseUsdRate(value: unknown): number {
  const rate = Number(value);
  if (!Number.isInteger(rate) || rate < 1_000 || rate > 100_000) {
    throw new BadRequestException("Kurs harus angka bulat antara 1.000 dan 100.000.");
  }
  return rate;
}
