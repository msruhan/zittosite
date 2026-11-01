import assert from "node:assert/strict";
import { test } from "node:test";
import { qrisCrc16, qrisMerchantName, qrisWithAmount, validateStatic } from "./qris";
import { pickUniqueCode } from "./unique-amount";
import { parseTransaction } from "./gobiz.client";

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

function staticQris(): string {
  const body = [
    tlv("00", "01"),
    tlv("01", "11"),
    tlv("52", "5732"),
    tlv("53", "360"),
    tlv("58", "ID"),
    tlv("59", "Toko Uji"),
    tlv("60", "BOGOR"),
    tlv("61", "16920"),
  ].join("");
  const crcInput = `${body}6304`;
  return `${crcInput}${qrisCrc16(crcInput)}`;
}

test("static QRIS becomes a dynamic payload for the exact payable", () => {
  const payload = staticQris();
  validateStatic(payload);
  assert.equal(qrisMerchantName(payload), "Toko Uji");
  const dynamic = qrisWithAmount(payload, 50137);
  assert.match(dynamic, /010212/);
  assert.match(dynamic, /540550137/);
  assert.equal(dynamic.slice(-4), qrisCrc16(dynamic.slice(0, -4)));
  assert.throws(() => validateStatic(dynamic), /statis/);
});

test("unique codes skip payables that are already reserved", () => {
  assert.equal(pickUniqueCode(50_000, new Set([50_001]), 1), 2);
  assert.equal(pickUniqueCode(50_000, new Set([50_002]), 2), 3);
  const used = new Set(Array.from({ length: 999 }, (_, i) => 50_001 + i));
  assert.equal(pickUniqueCode(50_000, used, 1), null);
});

test("GoBiz transaction amounts are converted from minor units", () => {
  const tx = parseTransaction({
    transaction_id: "trx-1",
    gross_amount: "5013700",
    status: "settlement",
    payment_type: "qris",
    transaction_time: "2026-11-01T05:00:00.000Z",
  });
  assert.equal(tx?.amount, 50137);
  assert.equal(tx?.paymentType, "QRIS");
  assert.equal(parseTransaction({ id: "x" }), null);
});
