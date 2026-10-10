import assert from "node:assert/strict";
import test from "node:test";
import type { UserMenus } from "../orders/user-menus";
import {
  categoryLabel,
  categoryOfService,
  isGroupedCategory,
  orderCategories,
  pageOf,
  parseOrderCategory,
} from "./order-picker";

const MENUS: UserMenus = {
  order: { label: "Order", enabled: true },
  menus: [
    { id: "a", slug: "ceir", label: "Order Ceir", enabled: true, sortOrder: 10, style: "ceir", priceCurrency: "IDR" },
    { id: "b", slug: "vip", label: "VIP", enabled: true, sortOrder: 20, style: "special", priceCurrency: "USD" },
    { id: "c", slug: "nomor-hp", label: "Cek Nomor HP", enabled: true, sortOrder: 30, style: "ceir", priceCurrency: "IDR" },
  ],
};

test("services fall into the Order category or their menu", () => {
  assert.equal(categoryOfService({ menu: null }), "order");
  assert.equal(categoryOfService({ menu: { slug: "nomor-hp" } }), "nomor-hp");
  assert.deepEqual(orderCategories(MENUS), ["order", "ceir", "vip", "nomor-hp"]);
  assert.equal(parseOrderCategory("vip", MENUS), "vip");
  assert.equal(parseOrderCategory("x", MENUS), null);
  assert.equal(isGroupedCategory("vip", MENUS), true);
  assert.equal(isGroupedCategory("nomor-hp", MENUS), false);
});

test("category labels use the configured menu names", () => {
  assert.equal(categoryLabel("order", MENUS), "📱 Order IMEI");
  assert.equal(categoryLabel("vip", MENUS), "✨ VIP");
  assert.equal(categoryLabel("nomor-hp", MENUS), "🔎 Cek Nomor HP");
});

test("group callback data stays within Telegram's 64 bytes", () => {
  const data = `uord:grp:${"a".repeat(20)}:${"c".repeat(25)}:999`;
  assert.ok(Buffer.byteLength(data) <= 64);
});

test("pages are clamped to the available range", () => {
  const items = Array.from({ length: 32 }, (_, i) => i);
  assert.deepEqual(pageOf(items, 1, 15).items.length, 15);
  assert.deepEqual(pageOf(items, 3, 15), { items: [30, 31], page: 3, pages: 3 });
  assert.equal(pageOf(items, 9, 15).page, 3);
  assert.equal(pageOf([], 1, 15).pages, 1);
});
