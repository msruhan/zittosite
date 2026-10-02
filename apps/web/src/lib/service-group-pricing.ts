// Keep in sync with apps/api/src/admin/service-group-pricing.ts — the API applies the same math.
// Layanan Spesial prices are USD cents, so amounts and rounding are in cents too.

export type PriceAdjustment = {
  direction: "increase" | "decrease";
  mode: "amount" | "percent";
  /** Cents when mode is "amount", percent otherwise. */
  value: number;
  /** "price" adjusts the current selling price; "cost" sets it relative to harga modal. */
  base: "price" | "cost";
  /** Round the result to the nearest multiple of cents (1 = no rounding). */
  roundTo: 1 | 10 | 50 | 100;
};

/** Invalid adjustment message, or undefined when it can be applied. */
export function adjustmentError(input: PriceAdjustment): string | undefined {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return "Nilai perubahan harus lebih dari 0.";
  }
  if (input.mode === "percent" && input.direction === "decrease" && input.value >= 100) {
    return "Pengurangan persen harus kurang dari 100%.";
  }
  if (input.mode === "percent" && input.value > 1000) {
    return "Persen maksimal 1000%.";
  }
  return undefined;
}

export function adjustedPrice(
  service: { price: number; costPrice: number },
  input: PriceAdjustment,
): number {
  const start = input.base === "cost" ? service.costPrice : service.price;
  const delta = input.mode === "amount" ? input.value : (start * input.value) / 100;
  const raw = input.direction === "increase" ? start + delta : start - delta;
  return Math.round(raw / input.roundTo) * input.roundTo;
}
