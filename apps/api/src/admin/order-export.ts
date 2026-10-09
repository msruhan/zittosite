import ExcelJS from "exceljs";
import { resultNoteLines } from "../telegram/result-note";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const RUPIAH_FORMAT = '"Rp" #,##0;[Red]-"Rp" #,##0';
const DATE_FORMAT = "dd/mm/yyyy hh:mm";

const HEADER_FILL = "FF1E3A8A";
const TITLE_COLOR = "FF0F172A";
const MUTED_COLOR = "FF64748B";
const STRIPE_FILL = "FFF8FAFC";
const TOTAL_FILL = "FFE2E8F0";
const BORDER_COLOR = "FFCBD5E1";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  waiting_payment: "Waiting Payment",
  paid: "Paid",
  waiting_action: "Waiting Action",
  in_process: "In Process",
  done: "Done",
  rejected: "Rejected",
  cancel: "Cancel",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const CHANNEL_LABEL: Record<string, string> = {
  web: "Website",
  telegram: "Telegram",
  api: "API",
};

const INPUT_TYPE_LABEL: Record<string, string> = {
  imei: "IMEI",
  sn: "SN",
  ecid: "ECID",
  imei_sn: "IMEI/SN",
  none: "-",
};

export type ExportOrderRow = {
  orderId: string;
  channel: string;
  imei: string;
  notes: string | null;
  quantity: number | null;
  email: string | null;
  username: string | null;
  keyLock: string | null;
  signInPicture: string | null;
  codeText: string | null;
  status: string;
  isTest: boolean;
  statusReason: string | null;
  price: number;
  costPrice: number;
  supplierRef: string | null;
  supplierError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  service: {
    name: string;
    fulfillmentChannel: string;
    menu: string;
    inputType: string;
  };
  user: { fullName: string; username: string };
  assignedAdmin: { fullName: string } | null;
  invoice: {
    invoiceId: string;
    paymentStatus: string;
    paidAt: Date | null;
  } | null;
  result: { resultStatus: string; resultNote: string } | null;
  supplier: { name: string } | null;
};

export type ExportMeta = {
  exportedAt: Date;
  exportedBy: string;
  filters: string[];
  truncated: boolean;
  limit: number;
};

/** Excel has no time zones: shift so the cell shows Asia/Jakarta wall-clock time. */
function wib(date: Date | null | undefined): Date | null {
  return date ? new Date(date.getTime() + WIB_OFFSET_MS) : null;
}

export function wibStamp(date: Date): string {
  const d = new Date(date.getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function wibText(date: Date): string {
  const d = new Date(date.getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} WIB`;
}

export function serviceRouteLabel(service: ExportOrderRow["service"]): string {
  if (service.fulfillmentChannel !== "supplier") return "Manual";
  return service.menu === "special" ? "Layanan Spesial" : "Order Ceir";
}

type Column = {
  header: string;
  width: number;
  kind?: "text" | "money" | "date" | "number" | "center";
  value: (row: ExportOrderRow, index: number) => string | number | Date | null;
};

const COLUMNS: Column[] = [
  { header: "No", width: 6, kind: "center", value: (_, i) => i + 1 },
  { header: "Tanggal Order", width: 18, kind: "date", value: (r) => wib(r.createdAt) },
  { header: "Order ID", width: 16, value: (r) => r.orderId },
  { header: "Invoice", width: 18, value: (r) => r.invoice?.invoiceId ?? "" },
  { header: "Kanal", width: 11, kind: "center", value: (r) => CHANNEL_LABEL[r.channel] ?? r.channel },
  { header: "Nama User", width: 24, value: (r) => r.user.fullName },
  { header: "Username", width: 18, value: (r) => r.user.username },
  { header: "Layanan", width: 40, value: (r) => r.service.name },
  { header: "Jalur", width: 16, kind: "center", value: (r) => serviceRouteLabel(r.service) },
  {
    header: "Jenis Data",
    width: 11,
    kind: "center",
    value: (r) => INPUT_TYPE_LABEL[r.service.inputType] ?? r.service.inputType,
  },
  { header: "IMEI / SN / ECID", width: 20, kind: "text", value: (r) => r.imei },
  { header: "Qty", width: 7, kind: "number", value: (r) => r.quantity },
  { header: "Email", width: 24, value: (r) => r.email ?? "" },
  { header: "Username Tambahan", width: 18, value: (r) => r.username ?? "" },
  { header: "Key Lock", width: 18, value: (r) => r.keyLock ?? "" },
  { header: "Picture on sign-in page", width: 28, value: (r) => r.signInPicture ?? "" },
  { header: "Code", width: 28, value: (r) => r.codeText ?? "" },
  { header: "Catatan User", width: 28, value: (r) => r.notes ?? "" },
  { header: "Harga Jual", width: 15, kind: "money", value: (r) => r.price },
  { header: "Harga Modal", width: 15, kind: "money", value: (r) => r.costPrice },
  { header: "Untung", width: 15, kind: "money", value: (r) => r.price - r.costPrice },
  {
    header: "Status Order",
    width: 16,
    kind: "center",
    value: (r) => ORDER_STATUS_LABEL[r.status] ?? r.status,
  },
  {
    header: "Status Bayar",
    width: 13,
    kind: "center",
    value: (r) =>
      r.invoice ? (PAYMENT_STATUS_LABEL[r.invoice.paymentStatus] ?? r.invoice.paymentStatus) : "",
  },
  { header: "Dibayar", width: 18, kind: "date", value: (r) => wib(r.invoice?.paidAt) },
  { header: "Mulai Diproses", width: 18, kind: "date", value: (r) => wib(r.startedAt) },
  { header: "Selesai", width: 18, kind: "date", value: (r) => wib(r.completedAt) },
  { header: "Admin Pemroses", width: 22, value: (r) => r.assignedAdmin?.fullName ?? "" },
  { header: "Supplier", width: 20, value: (r) => r.supplier?.name ?? "" },
  { header: "Ref Supplier", width: 18, kind: "text", value: (r) => r.supplierRef ?? "" },
  { header: "Error Supplier", width: 28, value: (r) => r.supplierError ?? "" },
  {
    header: "Hasil",
    width: 11,
    kind: "center",
    value: (r) =>
      r.result ? (r.result.resultStatus === "success" ? "Berhasil" : "Gagal") : "",
  },
  { header: "Catatan Hasil", width: 40, value: (r) => resultNoteLines(r.result?.resultNote).join("\n") },
  { header: "Keterangan", width: 30, value: (r) => r.statusReason ?? "" },
  { header: "Order Test", width: 11, kind: "center", value: (r) => (r.isTest ? "Ya" : "") },
];

const thin = { style: "thin" as const, color: { argb: BORDER_COLOR } };
const cellBorder = { top: thin, left: thin, bottom: thin, right: thin };

function ordersSheet(workbook: ExcelJS.Workbook, rows: ExportOrderRow[], meta: ExportMeta) {
  const sheet = workbook.addWorksheet("Orders", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = COLUMNS.map((col) => ({ width: col.width }));
  const lastCol = COLUMNS.length;

  sheet.mergeCells(1, 1, 1, lastCol);
  const title = sheet.getCell(1, 1);
  title.value = "Laporan Order ZITTOSITE";
  title.font = { bold: true, size: 16, color: { argb: TITLE_COLOR } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = `Diekspor ${wibText(meta.exportedAt)} oleh ${meta.exportedBy} · ${rows.length} order`;
  sheet.getCell(2, 1).font = { size: 10, color: { argb: MUTED_COLOR } };

  sheet.mergeCells(3, 1, 3, lastCol);
  const filterText = meta.filters.length ? `Filter: ${meta.filters.join(" · ")}` : "Filter: semua order";
  sheet.getCell(3, 1).value = meta.truncated
    ? `${filterText} · Dibatasi ${meta.limit.toLocaleString("id-ID")} order terbaru, persempit rentang tanggal untuk data lengkap.`
    : filterText;
  sheet.getCell(3, 1).font = {
    size: 10,
    color: { argb: meta.truncated ? "FFB91C1C" : MUTED_COLOR },
  };

  const headerRowNumber = 5;
  const header = sheet.getRow(headerRowNumber);
  COLUMNS.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = cellBorder;
  });
  header.height = 30;

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(headerRowNumber + 1 + index);
    COLUMNS.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      const value = col.value(row, index);
      cell.value = value === null || value === undefined ? null : value;
      cell.border = cellBorder;
      cell.alignment = { vertical: "top", wrapText: col.width >= 28 };
      if (col.kind === "money") cell.numFmt = RUPIAH_FORMAT;
      if (col.kind === "date") {
        cell.numFmt = DATE_FORMAT;
        cell.alignment = { vertical: "top", horizontal: "center" };
      }
      if (col.kind === "text") cell.numFmt = "@";
      if (col.kind === "center" || col.kind === "number") {
        cell.alignment = { vertical: "top", horizontal: "center" };
      }
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      }
    });
  });

  const firstData = headerRowNumber + 1;
  const lastData = headerRowNumber + rows.length;
  if (rows.length > 0) {
    const totalRow = sheet.getRow(lastData + 1);
    const labelCell = totalRow.getCell(1);
    sheet.mergeCells(lastData + 1, 1, lastData + 1, COLUMNS.findIndex((c) => c.kind === "money"));
    labelCell.value = "TOTAL";
    labelCell.alignment = { horizontal: "right" };
    COLUMNS.forEach((col, i) => {
      const cell = totalRow.getCell(i + 1);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
      cell.border = cellBorder;
      if (col.kind === "money") {
        const letter = sheet.getColumn(i + 1).letter;
        const total = rows.reduce((sum, row, idx) => sum + Number(col.value(row, idx) ?? 0), 0);
        cell.value = { formula: `SUM(${letter}${firstData}:${letter}${lastData})`, result: total };
        cell.numFmt = RUPIAH_FORMAT;
      }
    });
  }

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(headerRowNumber, lastData), column: lastCol },
  };
}

function summarySheet(workbook: ExcelJS.Workbook, rows: ExportOrderRow[], meta: ExportMeta) {
  const sheet = workbook.addWorksheet("Ringkasan");
  sheet.columns = [{ width: 26 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }];

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "Ringkasan Order";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: TITLE_COLOR } };
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = meta.filters.length
    ? `Filter: ${meta.filters.join(" · ")}`
    : "Filter: semua order";
  sheet.getCell("A2").font = { size: 10, color: { argb: MUTED_COLOR } };

  const header = sheet.getRow(4);
  ["Status", "Jumlah", "Harga Jual", "Harga Modal", "Untung"].forEach((label, i) => {
    const cell = header.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center" };
    cell.border = cellBorder;
  });

  const real = rows.filter((row) => !row.isTest);
  const statuses = Object.keys(ORDER_STATUS_LABEL);
  let r = 5;
  for (const status of statuses) {
    const group = real.filter((row) => row.status === status);
    const price = group.reduce((s, row) => s + row.price, 0);
    const cost = group.reduce((s, row) => s + row.costPrice, 0);
    const line = sheet.getRow(r++);
    line.values = [ORDER_STATUS_LABEL[status], group.length, price, cost, price - cost];
    line.eachCell((cell, col) => {
      cell.border = cellBorder;
      if (col >= 3) cell.numFmt = RUPIAH_FORMAT;
      if (col === 2) cell.alignment = { horizontal: "center" };
    });
  }
  const total = sheet.getRow(r);
  const sum = (key: "price" | "costPrice") => real.reduce((s, row) => s + row[key], 0);
  total.values = [
    "Total (tanpa order test)",
    real.length,
    sum("price"),
    sum("costPrice"),
    sum("price") - sum("costPrice"),
  ];
  total.eachCell((cell, col) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    cell.border = cellBorder;
    if (col >= 3) cell.numFmt = RUPIAH_FORMAT;
    if (col === 2) cell.alignment = { horizontal: "center" };
  });

  const done = real.filter((row) => row.status === "done");
  const donePrice = done.reduce((s, row) => s + row.price, 0);
  const doneCost = done.reduce((s, row) => s + row.costPrice, 0);
  const notes: Array<[string, number]> = [
    ["Omzet order Done", donePrice],
    ["Modal order Done", doneCost],
    ["Untung order Done", donePrice - doneCost],
  ];
  r += 2;
  for (const [label, value] of notes) {
    const line = sheet.getRow(r++);
    line.getCell(1).value = label;
    line.getCell(1).font = { bold: true };
    line.getCell(3).value = value;
    line.getCell(3).numFmt = RUPIAH_FORMAT;
    line.getCell(3).font = { bold: true };
  }
  const testCount = rows.length - real.length;
  if (testCount > 0) {
    sheet.getRow(r + 1).getCell(1).value =
      `${testCount} order test tidak dihitung di ringkasan ini (tetap tercantum di sheet Orders).`;
    sheet.getRow(r + 1).getCell(1).font = { italic: true, size: 10, color: { argb: MUTED_COLOR } };
  }
}

export async function buildOrdersWorkbook(
  rows: ExportOrderRow[],
  meta: ExportMeta,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZITTOSITE";
  workbook.created = meta.exportedAt;
  ordersSheet(workbook, rows, meta);
  summarySheet(workbook, rows, meta);
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}
