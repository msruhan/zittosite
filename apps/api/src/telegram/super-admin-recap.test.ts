import assert from "node:assert/strict";
import test from "node:test";
import { superAdminRecapHtml } from "./telegram-messages";

const stats = { taken: 1, done: 1, rejected: 0, inProcess: 0 };

test("recap tags a Super Admin handler and shows their profit", () => {
  const html = superAdminRecapHtml({
    day: new Date("2026-10-04T00:00:00+07:00"),
    created: { total: 2, web: 1, telegram: 1, viaTelegram: 2, viaWhatsapp: 0, byStatus: { done: 2 } },
    revenue: { amount: 175_000, payments: 2 },
    handled: { ...stats, done: 2, doneAmount: 60_000 },
    queue: 0,
    whatsapp: { ...stats, done: 0, taken: 0, doneAmount: 0, queue: 0, orders: [] },
    perAdmin: [
      { fullName: "Owner", telegramHandle: null, superAdmin: true, profit: 95_000, ...stats, doneAmount: 0, orders: [] },
      { fullName: "Admin HJ", telegramHandle: null, profit: 20_000, ...stats, doneAmount: 60_000, orders: [] },
    ],
  });
  assert.match(html, /<b>Owner<\/b> · 👑 Super Admin/);
  assert.match(html, /Keuntungan: <b>Rp\s?95\.000<\/b> \(1 order, tanpa biaya admin\)/);
  assert.doesNotMatch(html, /Admin HJ<\/b> · 👑/);
  assert.match(html, /Total selesai: <b>Rp\s?60\.000<\/b>/);
});
