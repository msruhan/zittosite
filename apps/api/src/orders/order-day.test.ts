import assert from "node:assert/strict";
import test from "node:test";
import { orderDayWhere } from "./order-day";

test("an order belongs to the day it was taken, not the day it finished", () => {
  const range = { gte: new Date("2026-10-08T17:00:00Z"), lt: new Date("2026-10-09T17:00:00Z") };
  assert.deepEqual(orderDayWhere(range), {
    OR: [
      { startedAt: range },
      { startedAt: null, status: "done", completedAt: range },
      { startedAt: null, status: { in: ["rejected", "cancel"] }, updatedAt: range },
    ],
  });
});
