import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSupplierCost, supplierCostIdr } from "./supplier-price-guard";

test("supplierCostIdr converts USD credit per unit at the rate, rounding up", () => {
  assert.equal(supplierCostIdr(0.893, 5, "USD", 17_000), 75_905);
  assert.equal(supplierCostIdr(0.1, 3, "$", 17_000), 5_100);
  assert.equal(supplierCostIdr(12_500, 2, "IDR", 17_000), 25_000);
  assert.equal(supplierCostIdr(125, 1, "", 18_150), 2_268_750);
  assert.equal(supplierCostIdr(1, 1, "EUR", 17_000), null);
});

test("checkSupplierCost holds orders the supplier bills above the paid price", () => {
  const loss = checkSupplierCost({
    credit: 0.893,
    units: 5,
    currency: "USD",
    usdRate: 17_000,
    chargedPrice: 18_695,
  });
  assert.equal(loss.ok, false);
  assert.equal(loss.costIdr, 75_905);

  const fine = checkSupplierCost({
    credit: 0.893,
    units: 5,
    currency: "USD",
    usdRate: 17_000,
    chargedPrice: 93_475,
  });
  assert.deepEqual(fine, { ok: true, costIdr: 75_905 });
});

test("checkSupplierCost refuses when the price cannot be verified", () => {
  const base = { units: 1, usdRate: 17_000, chargedPrice: 50_000 };
  assert.equal(checkSupplierCost({ ...base, credit: undefined, currency: "USD" }).ok, false);
  assert.equal(checkSupplierCost({ ...base, credit: 1, currency: "EUR" }).ok, false);
});
