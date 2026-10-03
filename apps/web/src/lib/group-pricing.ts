// User group prices are whole Rupiah, stored as-is (they do not follow the USD rate).

export type GroupPriceRule =
  /** Harga modal + amount/percent. */
  | "cost_up"
  /** Harga default + amount/percent. */
  | "price_up"
  /** Harga default − amount/percent. */
  | "price_down"
  /** One exact Rupiah price for every selected service. */
  | "fixed";

export type GroupPriceAdjustment = {
  rule: GroupPriceRule;
  unit: "amount" | "percent";
  value: number;
  /** Round the result to the nearest multiple of Rupiah (1 = no rounding). */
  roundTo: 1 | 100 | 500 | 1000;
};

export const GROUP_PRICE_RULES: { value: GroupPriceRule; label: string }[] = [
  { value: "price_up", label: "Naikkan dari harga default" },
  { value: "cost_up", label: "Harga modal + keuntungan" },
  { value: "price_down", label: "Diskon dari harga default" },
  { value: "fixed", label: "Harga tetap" },
];

export const GROUP_ROUND_OPTIONS = [
  { value: "1", label: "Tanpa pembulatan" },
  { value: "100", label: "Kelipatan Rp 100" },
  { value: "500", label: "Kelipatan Rp 500" },
  { value: "1000", label: "Kelipatan Rp 1.000" },
];

/** Invalid adjustment message, or undefined when it can be applied. */
export function groupAdjustmentError(input: GroupPriceAdjustment): string | undefined {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return "Nilai harus lebih dari 0.";
  }
  if (input.rule === "fixed") return undefined;
  if (input.unit === "percent" && input.rule === "price_down" && input.value >= 100) {
    return "Diskon harus kurang dari 100%.";
  }
  if (input.unit === "percent" && input.value > 1000) return "Persen maksimal 1000%.";
  return undefined;
}

export function groupAdjustedPrice(
  service: { price: number; costPrice?: number },
  input: GroupPriceAdjustment,
): number {
  if (input.rule === "fixed") return Math.round(input.value);
  const start = input.rule === "cost_up" ? (service.costPrice ?? 0) : service.price;
  const delta = input.unit === "amount" ? input.value : (start * input.value) / 100;
  const raw = input.rule === "price_down" ? start - delta : start + delta;
  return Math.max(0, Math.round(raw / input.roundTo) * input.roundTo);
}
