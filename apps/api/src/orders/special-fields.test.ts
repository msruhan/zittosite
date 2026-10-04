import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_EXTRA_FIELDS,
  NO_EXTRAS,
  needsExtraInput,
  parseOrderExtras,
  parseServiceInputType,
  supplierExtraFields,
} from "./special-fields";

const ALL = { requireQnt: true, requireEmail: true, requireUsername: true, requireNotes: true };
const NONE = NO_EXTRA_FIELDS;

test("required extras are validated and trimmed", () => {
  const ok = parseOrderExtras(ALL, {
    qnt: " 5 ",
    email: " a@b.co ",
    username: " budi ",
    notes: " model A2 ",
  });
  assert.deepEqual(ok, {
    ok: true,
    extras: { quantity: 5, email: "a@b.co", username: "budi", notes: "model A2" },
  });

  const bad = parseOrderExtras(ALL, { qnt: "1.5", email: "nope", username: "", notes: " " });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 4);

  assert.equal(
    parseOrderExtras(ALL, { qnt: 0, email: "a@b.co", username: "x", notes: "n" }).ok,
    false,
  );
  assert.equal(
    parseOrderExtras({ ...NONE, requireNotes: true }, { notes: "x".repeat(501) }).ok,
    false,
  );
});

test("fields the service does not require are dropped", () => {
  assert.deepEqual(
    parseOrderExtras(NONE, { qnt: 9, email: "a@b.co", username: "x", notes: "hi" }),
    { ok: true, extras: NO_EXTRAS },
  );
});

test("supplier fields omit empty values", () => {
  assert.deepEqual(
    supplierExtraFields({ quantity: 2, email: null, username: "u", notes: "catatan" }),
    { QNT: "2", USERNAME: "u", NOTES: "catatan" },
  );
  assert.deepEqual(supplierExtraFields(NO_EXTRAS), {});
});

test("input type parsing and Telegram eligibility", () => {
  assert.equal(parseServiceInputType("none"), "none");
  assert.equal(parseServiceInputType("phone"), undefined);
  assert.equal(needsExtraInput({ ...NONE, inputType: "imei" }), false);
  assert.equal(needsExtraInput({ ...NONE, inputType: "none" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireEmail: true, inputType: "sn" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireNotes: true, inputType: "imei" }), true);
});
