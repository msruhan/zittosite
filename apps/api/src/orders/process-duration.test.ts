import assert from "node:assert/strict";
import { test } from "node:test";
import { formatProcessDuration, processDurationLabel } from "./process-duration";

const MIN = 60_000;

test("process durations read naturally in Indonesian", () => {
  assert.equal(formatProcessDuration(20_000), "< 1 menit");
  assert.equal(formatProcessDuration(55 * MIN), "55 menit");
  assert.equal(formatProcessDuration(82 * MIN), "1 jam 22 menit");
  assert.equal(formatProcessDuration(120 * MIN), "2 jam");
  assert.equal(formatProcessDuration((24 * 60 + 185) * MIN), "1 hari 3 jam");
  assert.equal(formatProcessDuration(-5), "< 1 menit");
});

test("duration runs from payment to the closing log", () => {
  const at = (m: number) => new Date(Date.UTC(2026, 8, 30, 6, m));
  const order = {
    createdAt: at(0),
    invoice: { paidAt: at(2) },
    activity: [
      { status: "waiting_payment", createdAt: at(0) },
      { status: "paid", createdAt: at(1) },
      { status: "in_process", createdAt: at(10) },
      { status: "done", createdAt: at(56) },
    ],
  };
  assert.equal(processDurationLabel(order), "55 menit");
  assert.equal(
    processDurationLabel({ createdAt: at(0), invoice: { paidAt: at(5) } }, at(40)),
    "35 menit",
  );
});
