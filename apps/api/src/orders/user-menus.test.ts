import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_USER_MENUS,
  menuOfService,
  normalizeUserMenus,
  parseUserMenusInput,
} from "./user-menus";

const VALID = {
  order: { label: " Order  Manual ", enabled: true },
  ceir: { label: "Cek CEIR", enabled: false },
  special: { label: "Spesial", enabled: true },
};

test("missing or malformed stored menus fall back to the defaults", () => {
  assert.deepEqual(normalizeUserMenus(null), DEFAULT_USER_MENUS);
  assert.deepEqual(normalizeUserMenus({ ceir: { label: "", enabled: "no" } }), DEFAULT_USER_MENUS);
  assert.deepEqual(normalizeUserMenus({ special: { label: "VIP", enabled: false } }).special, {
    label: "VIP",
    enabled: false,
  });
});

test("admin input is trimmed and every menu needs a name", () => {
  assert.deepEqual(parseUserMenusInput(VALID), {
    order: { label: "Order Manual", enabled: true },
    ceir: { label: "Cek CEIR", enabled: false },
    special: { label: "Spesial", enabled: true },
  });
  assert.throws(() => parseUserMenusInput({ ...VALID, ceir: { label: "  ", enabled: true } }));
  assert.throws(() => parseUserMenusInput({ ...VALID, order: { label: "x".repeat(31), enabled: true } }));
  assert.throws(() => parseUserMenusInput({ ...VALID, special: { label: "A", enabled: "yes" } }));
  assert.throws(() => parseUserMenusInput({ order: VALID.order }));
});

test("services map to the menu they are ordered from", () => {
  assert.equal(menuOfService({ fulfillmentChannel: "telegram", menu: "ceir" }), "order");
  assert.equal(menuOfService({ fulfillmentChannel: "supplier", menu: "ceir" }), "ceir");
  assert.equal(menuOfService({ fulfillmentChannel: "supplier", menu: "special" }), "special");
});
