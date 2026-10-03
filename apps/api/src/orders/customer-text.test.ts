import assert from "node:assert/strict";
import { test } from "node:test";
import { customerActor, customerText } from "./customer-text";

test("customerText removes every Supplier API mention from stored notes", () => {
  assert.equal(
    customerText("Order diteruskan otomatis ke Supplier API."),
    "Order diproses otomatis.",
  );
  assert.equal(
    customerText("Diterima Supplier API, sedang diproses otomatis."),
    "Sedang diproses otomatis.",
  );
  assert.equal(customerText("Ditolak supplier: IMEI invalid"), "Ditolak: IMEI invalid");
  assert.equal(
    customerText("Supplier tidak dapat memproses order: CreditprocessError"),
    "Order tidak dapat diproses saat ini.",
  );
  assert.equal(
    customerText("Ditahan, tidak diteruskan ke supplier: Harga supplier Rp1 lebih mahal"),
    "Order sedang ditinjau admin.",
  );
  assert.equal(customerText("Hasil dikirim (success)."), "Hasil dikirim (success).");
  assert.equal(customerText(null), null);
});

test("customerActor hides the supplier name", () => {
  assert.equal(customerActor("supplier (iSpider)"), "Sistem");
  assert.equal(customerActor("Sistem"), "Sistem");
  assert.equal(customerActor("sbungatan"), "sbungatan");
});
