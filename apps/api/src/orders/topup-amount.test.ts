import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTopupAmount, topupIdPrefix } from "./topup-amount";

test("topup amounts within limits are accepted", () => {
  assert.equal(parseTopupAmount(10_000), 10_000);
  assert.equal(parseTopupAmount(5_000_000), 5_000_000);
  assert.equal(parseTopupAmount("100.000"), 100_000);
  assert.equal(parseTopupAmount("Rp 250,000"), 250_000);
});

test("invalid topup amounts are rejected", () => {
  assert.equal(parseTopupAmount(9_999), null);
  assert.equal(parseTopupAmount(5_000_001), null);
  assert.equal(parseTopupAmount(15_000.5), null);
  assert.equal(parseTopupAmount("seratus ribu"), null);
  assert.equal(parseTopupAmount(""), null);
  assert.equal(parseTopupAmount(null), null);
});

test("topup id prefix uses the Jakarta date", () => {
  assert.equal(topupIdPrefix(new Date("2026-09-30T18:30:00Z")), "TP261001");
  assert.equal(topupIdPrefix(new Date("2026-10-01T02:00:00Z")), "TP261001");
});
