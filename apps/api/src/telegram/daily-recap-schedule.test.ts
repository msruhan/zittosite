import assert from "node:assert/strict";
import { test } from "node:test";
import { msUntilJakartaTime, recapHasActivity } from "./daily-recap-schedule";
import type { SuperAdminRecap } from "./order-recap.service";

const MIN = 60 * 1000;

const IDLE = { taken: 0, done: 0, rejected: 0, inProcess: 0, doneAmount: 0 };
const quietDay: SuperAdminRecap = {
  day: new Date("2026-10-08T00:00:00+07:00"),
  created: { total: 0, web: 0, telegram: 0, viaTelegram: 0, viaWhatsapp: 0, byStatus: {} },
  revenue: { amount: 0, payments: 0 },
  handled: IDLE,
  queue: 3,
  whatsapp: { ...IDLE, queue: 0, orders: [] },
  perAdmin: [],
} as unknown as SuperAdminRecap;

test("a day without orders sends no scheduled recap, even with an old queue", () => {
  assert.equal(recapHasActivity(quietDay), false);
  assert.equal(
    recapHasActivity({ ...quietDay, created: { ...quietDay.created, total: 1 } }),
    true,
  );
  assert.equal(recapHasActivity({ ...quietDay, handled: { ...IDLE, done: 2 } }), true);
  assert.equal(recapHasActivity({ ...quietDay, revenue: { amount: 50_000, payments: 1 } }), true);
});

test("msUntilJakartaTime targets 23:00 WIB later today", () => {
  assert.equal(msUntilJakartaTime(new Date("2026-10-01T20:30:00+07:00"), 23, 0), 150 * MIN);
});

test("msUntilJakartaTime rolls to tomorrow once 23:00 WIB has passed", () => {
  assert.equal(msUntilJakartaTime(new Date("2026-10-01T23:00:00+07:00"), 23, 0), 24 * 60 * MIN);
  assert.equal(msUntilJakartaTime(new Date("2026-10-01T23:30:00+07:00"), 23, 0), 23.5 * 60 * MIN);
});

test("msUntilJakartaTime uses the Jakarta day, not the UTC day", () => {
  assert.equal(msUntilJakartaTime(new Date("2026-10-01T18:00:00Z"), 23, 0), 22 * 60 * MIN);
});
