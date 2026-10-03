import assert from "node:assert/strict";
import { test } from "node:test";
import { parseImeiList } from "./imei-list";
import { maxBulkFor } from "./supplier-routed";

const A = "356938035643809";
const B = "351902447718283";

test("single IMEI", () => {
  assert.deepEqual(parseImeiList(A), { ok: true, imeis: [A] });
});

test("multiple lines, blanks and separators ignored", () => {
  assert.deepEqual(parseImeiList(`${A}\n\n  35190-2447718283 \r\n`), {
    ok: true,
    imeis: [A, B],
  });
});

test("array input", () => {
  assert.deepEqual(parseImeiList([A, B]), { ok: true, imeis: [A, B] });
});

test("wrong length reports line number", () => {
  assert.deepEqual(parseImeiList(`${A}\n12345`), {
    ok: false,
    errors: ["Baris 2: IMEI harus 15 digit (saat ini 5)."],
  });
});

test("duplicate reports first line", () => {
  assert.deepEqual(parseImeiList(`${A}\n${B}\n${A}`), {
    ok: false,
    errors: ["Baris 3: duplikat dengan baris 1."],
  });
});

test("empty input", () => {
  assert.deepEqual(parseImeiList(" \n "), {
    ok: false,
    errors: ["Masukkan minimal 1 IMEI."],
  });
});

test("more than 6 rejected", () => {
  const seven = Array.from({ length: 7 }, (_, i) => `35693803564380${i}`);
  assert.deepEqual(parseImeiList(seven), {
    ok: false,
    errors: ["Maksimal 6 IMEI per order (saat ini 7)."],
  });
});

test("Layanan Spesial caps a bulk order at 2", () => {
  const special = maxBulkFor({ fulfillmentChannel: "supplier", menu: "special" });
  assert.equal(special, 2);
  assert.equal(maxBulkFor({ fulfillmentChannel: "supplier", menu: "ceir" }), 6);
  assert.equal(maxBulkFor({ fulfillmentChannel: "telegram", menu: "special" }), 6);
  assert.deepEqual(parseImeiList("C02XK0ABJG5H\nF2LX12AB9Q0D\nDMPXK1ABCD12", "sn", special), {
    ok: false,
    errors: ["Maksimal 2 SN per order (saat ini 3)."],
  });
  assert.equal(parseImeiList([A, B], "imei", special).ok, true);
});

test("SN keeps letters, uppercased, separators dropped", () => {
  assert.deepEqual(parseImeiList("f2lx-12ab 9q0d\nC02XK0ABJG5H", "sn"), {
    ok: true,
    imeis: ["F2LX12AB9Q0D", "C02XK0ABJG5H"],
  });
});

test("ECID length is bounded and labelled", () => {
  assert.deepEqual(parseImeiList("abc", "ecid"), {
    ok: false,
    errors: ["Baris 1: ECID harus 4–40 huruf/angka (saat ini 3)."],
  });
  assert.deepEqual(parseImeiList("", "ecid"), {
    ok: false,
    errors: ["Masukkan minimal 1 ECID."],
  });
});
