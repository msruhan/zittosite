import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ORDER_MENU,
  menuOfService,
  normalizeOrderMenu,
  parseNewMenuInput,
  parseUserMenusInput,
  slugFromLabel,
} from "./user-menus";

const VALID = {
  order: { label: " Order  Manual ", enabled: true },
  menus: [
    { id: "m1", label: "Cek CEIR", enabled: false },
    { id: "m2", label: "Spesial", enabled: true },
  ],
};

test("missing or malformed stored Order menu falls back to the default", () => {
  assert.deepEqual(normalizeOrderMenu(null), DEFAULT_ORDER_MENU);
  assert.deepEqual(normalizeOrderMenu({ order: { label: "", enabled: "no" } }), DEFAULT_ORDER_MENU);
  assert.deepEqual(normalizeOrderMenu({ order: { label: "Manual", enabled: false } }), {
    label: "Manual",
    enabled: false,
  });
});

test("admin input is trimmed, ordered, and every menu needs a name", () => {
  assert.deepEqual(parseUserMenusInput(VALID), {
    order: { label: "Order Manual", enabled: true },
    menus: [
      { id: "m1", label: "Cek CEIR", enabled: false },
      { id: "m2", label: "Spesial", enabled: true },
    ],
  });
  assert.throws(() => parseUserMenusInput({ ...VALID, menus: [{ id: "m1", label: "  ", enabled: true }] }));
  assert.throws(() =>
    parseUserMenusInput({ ...VALID, order: { label: "x".repeat(31), enabled: true } }),
  );
  assert.throws(() => parseUserMenusInput({ ...VALID, menus: [{ id: "m1", label: "A", enabled: "yes" }] }));
  assert.throws(() => parseUserMenusInput({ ...VALID, menus: [VALID.menus[0], VALID.menus[0]] }));
  assert.throws(() => parseUserMenusInput({ order: VALID.order }));
});

test("new menus get a short URL-safe slug", () => {
  assert.equal(slugFromLabel("Cek Nomor HP"), "cek-nomor-hp");
  assert.equal(slugFromLabel("Layanan Spésial — VIP!!"), "layanan-spesial-vip");
  assert.ok(slugFromLabel("x".repeat(40)).length <= 20);
  assert.deepEqual(parseNewMenuInput({ label: "Cek Nomor HP", style: "ceir", priceCurrency: "IDR" }), {
    label: "Cek Nomor HP",
    slug: "cek-nomor-hp",
    style: "ceir",
    priceCurrency: "IDR",
  });
  assert.throws(() => parseNewMenuInput({ label: "Order", style: "ceir", priceCurrency: "IDR" }));
  assert.throws(() => parseNewMenuInput({ label: "A", slug: "Bad Slug", style: "ceir", priceCurrency: "IDR" }));
  assert.throws(() => parseNewMenuInput({ label: "A", style: "vip", priceCurrency: "IDR" }));
  assert.throws(() => parseNewMenuInput({ label: "A", style: "ceir", priceCurrency: "EUR" }));
});

test("services map to the menu they are ordered from", () => {
  const order = { label: "Order", enabled: true };
  const menu = { label: "Cek Nomor HP", enabled: false };
  assert.deepEqual(menuOfService({ fulfillmentChannel: "telegram", menu }, order), order);
  assert.deepEqual(menuOfService({ fulfillmentChannel: "supplier", menu: null }, order), order);
  assert.deepEqual(menuOfService({ fulfillmentChannel: "supplier", menu }, order), menu);
});
