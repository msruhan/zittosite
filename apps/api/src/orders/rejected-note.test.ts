import test from "node:test";
import assert from "node:assert/strict";
import { rejectedActivityNote } from "./orders.service";

test("rejection activity notes are plain text with a single prefix", () => {
  assert.equal(
    rejectedActivityNote("Ditolak: Model: TECNO LJ7<br>Status: invalid<br>"),
    "Ditolak: Model: TECNO LJ7\nStatus: invalid",
  );
  assert.equal(
    rejectedActivityNote("Order tidak dapat diproses saat ini."),
    "Ditolak: Order tidak dapat diproses saat ini.",
  );
  assert.equal(rejectedActivityNote("Ditolak."), "Ditolak.");
});
