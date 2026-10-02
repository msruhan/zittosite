import assert from "node:assert/strict";
import test from "node:test";
import {
  needsExtraInput,
  parseOrderExtras,
  parseServiceInputType,
  supplierExtraFields,
} from "./special-fields";

const ALL = { requireQnt: true, requireEmail: true, requireUsername: true };
const NONE = { requireQnt: false, requireEmail: false, requireUsername: false };

test("required extras are validated and trimmed", () => {
  const ok = parseOrderExtras(ALL, { qnt: " 5 ", email: " a@b.co ", username: " budi " });
  assert.deepEqual(ok, { ok: true, extras: { quantity: 5, email: "a@b.co", username: "budi" } });

  const bad = parseOrderExtras(ALL, { qnt: "1.5", email: "nope", username: "" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3);

  assert.equal(parseOrderExtras(ALL, { qnt: 0, email: "a@b.co", username: "x" }).ok, false);
});

test("fields the service does not require are dropped", () => {
  assert.deepEqual(parseOrderExtras(NONE, { qnt: 9, email: "a@b.co", username: "x" }), {
    ok: true,
    extras: { quantity: null, email: null, username: null },
  });
});

test("supplier fields omit empty values", () => {
  assert.deepEqual(supplierExtraFields({ quantity: 2, email: null, username: "u" }), {
    QNT: "2",
    USERNAME: "u",
  });
  assert.deepEqual(supplierExtraFields({ quantity: null, email: null, username: null }), {});
});

test("input type parsing and Telegram eligibility", () => {
  assert.equal(parseServiceInputType("none"), "none");
  assert.equal(parseServiceInputType("phone"), undefined);
  assert.equal(needsExtraInput({ ...NONE, inputType: "imei" }), false);
  assert.equal(needsExtraInput({ ...NONE, inputType: "none" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireEmail: true, inputType: "sn" }), true);
});
