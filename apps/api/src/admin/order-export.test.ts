import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { type ExportOrderRow, buildOrdersWorkbook, serviceRouteLabel, wibStamp } from "./order-export";

function row(overrides: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    orderId: "ORD-0001",
    channel: "web",
    imei: "356938035643809",
    notes: null,
    quantity: null,
    email: null,
    username: null,
    keyLock: null,
    status: "done",
    isTest: false,
    statusReason: null,
    price: 25_000,
    costPrice: 18_000,
    supplierRef: null,
    supplierError: null,
    startedAt: null,
    completedAt: new Date("2026-10-03T03:30:00Z"),
    createdAt: new Date("2026-10-03T03:00:00Z"),
    service: { name: "Cek Status", fulfillmentChannel: "telegram", menu: "ceir", inputType: "imei" },
    user: { fullName: "Budi", username: "budi" },
    assignedAdmin: { fullName: "Admin Satu" },
    invoice: { invoiceId: "INV-1", paymentStatus: "paid", paidAt: new Date("2026-10-03T03:01:00Z") },
    result: { resultStatus: "success", resultNote: "OK" },
    supplier: null,
    ...overrides,
  };
}

async function load(rows: ExportOrderRow[]) {
  const buffer = await buildOrdersWorkbook(rows, {
    exportedAt: new Date("2026-10-03T05:00:00Z"),
    exportedBy: "Super",
    filters: [],
    truncated: false,
    limit: 20_000,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

test("orders sheet keeps IMEI as text, shows WIB times and sums money columns", async () => {
  const workbook = await load([row(), row({ orderId: "ORD-0002", price: 10_000, costPrice: 4_000 })]);
  const sheet = workbook.getWorksheet("Orders")!;
  const headers = sheet.getRow(5).values as string[];
  const col = (name: string) => headers.indexOf(name);

  assert.equal(sheet.getRow(6).getCell(col("IMEI / SN / ECID")).value, "356938035643809");
  const created = sheet.getRow(6).getCell(col("Tanggal Order")).value as Date;
  assert.equal(created.getUTCHours(), 10);

  const total = sheet.getRow(8);
  assert.equal(total.getCell(1).value, "TOTAL");
  assert.equal((total.getCell(col("Harga Jual")).value as { result: number }).result, 35_000);
  assert.equal((total.getCell(col("Untung")).value as { result: number }).result, 13_000);
});

test("summary sheet leaves test orders out of the totals", async () => {
  const workbook = await load([row(), row({ orderId: "ORD-T", isTest: true, price: 99_000 })]);
  const sheet = workbook.getWorksheet("Ringkasan")!;
  const totalRow = sheet.getRow(12);
  assert.equal(totalRow.getCell(1).value, "Total (tanpa order test)");
  assert.equal(totalRow.getCell(2).value, 1);
  assert.equal(totalRow.getCell(3).value, 25_000);
});

test("route label and file stamp", () => {
  assert.equal(serviceRouteLabel({ name: "", fulfillmentChannel: "supplier", menu: "special", inputType: "sn" }), "Layanan Spesial");
  assert.equal(serviceRouteLabel({ name: "", fulfillmentChannel: "supplier", menu: "ceir", inputType: "imei" }), "Order Ceir");
  assert.equal(serviceRouteLabel({ name: "", fulfillmentChannel: "whatsapp", menu: "ceir", inputType: "imei" }), "Manual");
  assert.equal(wibStamp(new Date("2026-10-03T17:30:00Z")), "20261004-0030");
});
