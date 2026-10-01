import assert from "node:assert/strict";
import { test } from "node:test";
import { msUntilJakartaTime } from "./daily-recap-schedule";

const MIN = 60 * 1000;

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
