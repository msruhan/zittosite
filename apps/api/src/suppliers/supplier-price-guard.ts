export type SupplierCostCheck =
  | { ok: true; costIdr: number }
  | { ok: false; reason: string; costIdr: number | null };

/**
 * Supplier credit converted to Rupiah; null when the account currency is unknown.
 * Dhru panels that omit the currency are priced in USD credits.
 */
export function supplierCostIdr(
  credit: number,
  units: number,
  currency: string,
  usdRate: number,
): number | null {
  const code = currency.trim().toUpperCase();
  const rate =
    code === "IDR" || code === "RP"
      ? 1
      : code === "USD" || code === "$" || code === ""
        ? usdRate
        : null;
  if (rate === null || !Number.isFinite(credit) || credit < 0) return null;
  return Math.ceil(credit * units * rate - 1e-6);
}

/**
 * Compares what the supplier will bill with what the customer paid. Anything
 * that cannot be verified counts as unsafe, so the order is never forwarded at a loss.
 */
export function checkSupplierCost(input: {
  credit: number | undefined;
  units: number;
  currency: string;
  usdRate: number;
  chargedPrice: number;
}): SupplierCostCheck {
  if (input.credit === undefined) {
    return { ok: false, reason: "Layanan tidak ada di daftar harga supplier.", costIdr: null };
  }
  const costIdr = supplierCostIdr(input.credit, input.units, input.currency, input.usdRate);
  if (costIdr === null) {
    return {
      ok: false,
      reason: `Mata uang akun supplier tidak dikenali (${input.currency}).`,
      costIdr: null,
    };
  }
  if (costIdr > input.chargedPrice) {
    return {
      ok: false,
      reason: `Harga supplier Rp${costIdr.toLocaleString("id-ID")} lebih mahal dari harga yang dibayar user Rp${input.chargedPrice.toLocaleString("id-ID")}.`,
      costIdr,
    };
  }
  return { ok: true, costIdr };
}
