import assert from "node:assert/strict";
import { test } from "node:test";
import { adjustedPrice, adjustmentError, type PriceAdjustment } from "./service-group-pricing";
import { usdCentsToIdr } from "../orders/usd-pricing";

// $100.00 selling price, $80.00 cost.
const svc = { price: 10_000, costPrice: 8_000 };
const base: PriceAdjustment = {
  direction: "increase",
  mode: "amount",
  value: 500,
  base: "price",
  roundTo: 1,
};

test("adds or subtracts a fixed amount from the selling price", () => {
  assert.equal(adjustedPrice(svc, base), 10_500);
  assert.equal(adjustedPrice(svc, { ...base, direction: "decrease" }), 9_500);
});

test("percent is taken from the chosen base", () => {
  assert.equal(adjustedPrice(svc, { ...base, mode: "percent", value: 10 }), 11_000);
  assert.equal(adjustedPrice(svc, { ...base, mode: "percent", value: 25, base: "cost" }), 10_000);
  assert.equal(
    adjustedPrice(svc, { ...base, mode: "percent", value: 15, direction: "decrease" }),
    8_500,
  );
});

test("rounds to the nearest multiple of cents", () => {
  const odd = { price: 12_345, costPrice: 0 };
  assert.equal(adjustedPrice(odd, { ...base, value: 1, roundTo: 100 }), 12_300);
  assert.equal(adjustedPrice(odd, { ...base, value: 10, roundTo: 50 }), 12_350);
});

test("rejects zero and impossible percentages", () => {
  assert.ok(adjustmentError({ ...base, value: 0 }));
  assert.ok(adjustmentError({ ...base, mode: "percent", direction: "decrease", value: 100 }));
  assert.equal(adjustmentError({ ...base, mode: "percent", value: 50 }), undefined);
});

test("USD cents convert to whole Rupiah at the rate", () => {
  assert.equal(usdCentsToIdr(12_000, 17_000), 2_040_000);
  assert.equal(usdCentsToIdr(125, 17_000), 21_250);
  assert.equal(usdCentsToIdr(1, 16_550), 166);
});
