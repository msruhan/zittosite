import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_USER_MENUS } from "../orders/user-menus";
import { categoryLabel, categoryOfService, pageOf, parseOrderCategory } from "./order-picker";

test("services fall into the three bot categories", () => {
  assert.equal(categoryOfService({ menu: null }), "order");
  assert.equal(categoryOfService({ menu: "ceir" }), "ceir");
  assert.equal(categoryOfService({ menu: "special" }), "special");
  assert.equal(parseOrderCategory("special"), "special");
  assert.equal(parseOrderCategory("x"), null);
});

test("category labels use the configured menu names", () => {
  const menus = { ...DEFAULT_USER_MENUS, special: { label: "VIP", enabled: true } };
  assert.equal(categoryLabel("order", menus), "📱 Order IMEI");
  assert.equal(categoryLabel("special", menus), "✨ VIP");
});

test("pages are clamped to the available range", () => {
  const items = Array.from({ length: 32 }, (_, i) => i);
  assert.deepEqual(pageOf(items, 1, 15).items.length, 15);
  assert.deepEqual(pageOf(items, 3, 15), { items: [30, 31], page: 3, pages: 3 });
  assert.equal(pageOf(items, 9, 15).page, 3);
  assert.equal(pageOf([], 1, 15).pages, 1);
});
