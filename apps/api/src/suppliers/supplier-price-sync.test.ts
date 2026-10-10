import assert from "node:assert/strict";
import test from "node:test";
import { planPriceSync, type SyncedService } from "./supplier-price-sync";
import { supplierCreditToMenuUnits } from "../orders/usd-pricing";

const base = { active: true, costUsdCents: null } as const;
const USD = { priceCurrency: "USD" } as const;
const IDR = { priceCurrency: "IDR" } as const;

test("price sync updates cost only, takes missing services offline, flags losses", () => {
  const services: SyncedService[] = [
    // USD menu: credit is USD; cost 1.20 -> 1.50, selling Rp20.000 stays.
    { ...base, id: "a", name: "Spesial A", menu: USD, price: 20_000, costPrice: 19_200, costUsdCents: 120, supplierServiceId: "10" },
    // Rupiah menu: credit is Rupiah; unchanged.
    { ...base, id: "b", name: "Ceir B", menu: IDR, price: 60_000, costPrice: 50_000, supplierServiceId: "11" },
    // Cost rises above the selling price.
    { ...base, id: "c", name: "Ceir C", menu: IDR, price: 40_000, costPrice: 35_000, supplierServiceId: "12" },
    // Gone from the panel.
    { ...base, id: "d", name: "Hilang D", menu: IDR, price: 1, costPrice: 1, supplierServiceId: "99" },
    // Gone, but already offline.
    { ...base, id: "e", name: "Hilang E", menu: IDR, active: false, price: 1, costPrice: 1, supplierServiceId: "98" },
    // Unreadable credit is left alone.
    { ...base, id: "f", name: "Nol F", menu: IDR, price: 5, costPrice: 4, supplierServiceId: "13" },
  ];
  const plan = planPriceSync(
    services,
    [
      { id: "10", credit: 1.5 },
      { id: "11", credit: 50_000 },
      { id: "12", credit: 45_000 },
      { id: "13", credit: 0 },
    ],
    16_000,
  );

  assert.deepEqual(plan.updates, [
    { id: "a", data: { costUsdCents: 150, costPrice: 24_000 } },
    { id: "c", data: { costPrice: 45_000 } },
    { id: "d", data: { active: false } },
  ]);
  assert.deepEqual(plan.changed, [
    { name: "Spesial A", before: 120, after: 150, usd: true },
    { name: "Ceir C", before: 35_000, after: 45_000, usd: false },
  ]);
  assert.deepEqual(plan.offline, ["Hilang D"]);
  assert.deepEqual(plan.belowCost, ["Spesial A", "Ceir C"]);
  assert.equal(plan.unchanged, 3);
});

test("a declared supplier currency is converted to the menu currency", () => {
  const plan = planPriceSync(
    [{ ...base, id: "g", name: "Getcontact", menu: USD, price: 20_000, costPrice: 0, supplierServiceId: "ceir-getcontact" }],
    [{ id: "ceir-getcontact", credit: 3_000, currency: "IDR" }],
    15_000,
  );
  assert.deepEqual(plan.updates, [{ id: "g", data: { costUsdCents: 20, costPrice: 3_000 } }]);
});

test("supplier credit converts between Rupiah and USD cents", () => {
  assert.equal(supplierCreditToMenuUnits(3_000, "IDR", "IDR", 15_000), 3_000);
  assert.equal(supplierCreditToMenuUnits(3_000, "IDR", "USD", 15_000), 20);
  assert.equal(supplierCreditToMenuUnits(1.5, "USD", "IDR", 15_000), 22_500);
  assert.equal(supplierCreditToMenuUnits(1.5, null, "USD", 15_000), 150);
  assert.equal(supplierCreditToMenuUnits(50_000, null, "IDR", 15_000), 50_000);
});
