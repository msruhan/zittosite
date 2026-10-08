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

const ALL = {
  requireQnt: true,
  requireEmail: true,
  requireUsername: true,
  requireNotes: true,
  requirePassword: true,
  requireKeyLock: true,
  requireSignInPicture: true,
};
const NONE = NO_EXTRA_FIELDS;

test("required extras are validated and trimmed (password kept verbatim)", () => {
  const ok = parseOrderExtras(ALL, {
    qnt: " 5 ",
    email: " a@b.co ",
    username: " budi ",
    notes: " model A2 ",
    password: " Rahasia 123",
    keyLock: " KL-77 ",
    signInPicture: " https://postimg.cc/abc ",
  });
  assert.deepEqual(ok, {
    ok: true,
    extras: {
      quantity: 5,
      email: "a@b.co",
      username: "budi",
      notes: "model A2",
      password: " Rahasia 123",
      keyLock: "KL-77",
      signInPicture: "https://postimg.cc/abc",
    },
  });

  const bad = parseOrderExtras(ALL, {
    qnt: "1.5",
    email: "nope",
    username: "",
    notes: " ",
    password: "  ",
    keyLock: "",
    signInPicture: "",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 7);

  assert.equal(
    parseOrderExtras(ALL, {
      qnt: 0,
      email: "a@b.co",
      username: "x",
      notes: "n",
      password: "p",
      keyLock: "k",
      signInPicture: "p",
    }).ok,
    false,
  );
  assert.equal(
    parseOrderExtras({ ...NONE, requireNotes: true }, { notes: "x".repeat(501) }).ok,
    false,
  );
  assert.equal(
    parseOrderExtras({ ...NONE, requirePassword: true }, { password: "a\nb" }).ok,
    false,
  );
  assert.equal(
    parseOrderExtras({ ...NONE, requireSignInPicture: true }, { signInPicture: "a\nb" }).ok,
    false,
  );
});

test("fields the service does not require are dropped", () => {
  assert.deepEqual(
    parseOrderExtras(NONE, {
      qnt: 9,
      email: "a@b.co",
      username: "x",
      notes: "hi",
      password: "p",
      keyLock: "k",
      signInPicture: "p",
    }),
    { ok: true, extras: NO_EXTRAS },
  );
});

test("supplier fields omit empty values", () => {
  assert.deepEqual(
    supplierExtraFields({
      quantity: 2,
      email: null,
      username: "u",
      notes: "catatan",
      password: "s3cret",
      keyLock: "KL-1",
      signInPicture: "https://postimg.cc/abc",
    }),
    {
      QNT: "2",
      USERNAME: "u",
      NOTES: "catatan",
      PASSWORD: "s3cret",
      KEYLOCK: "KL-1",
      "Picture on sign-in page": "https://postimg.cc/abc",
    },
  );
  assert.deepEqual(supplierExtraFields(NO_EXTRAS), {});
});

test("input type parsing and Telegram eligibility", () => {
  assert.equal(parseServiceInputType("none"), "none");
  assert.equal(parseServiceInputType("phone"), "phone");
  assert.equal(parseServiceInputType("email"), undefined);
  assert.equal(needsExtraInput({ ...NONE, inputType: "imei" }), false);
  assert.equal(needsExtraInput({ ...NONE, inputType: "none" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireEmail: true, inputType: "sn" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireNotes: true, inputType: "imei" }), true);
  assert.equal(needsExtraInput({ ...NONE, requirePassword: true, inputType: "imei" }), true);
  assert.equal(needsExtraInput({ ...NONE, requireSignInPicture: true, inputType: "imei" }), true);
});
