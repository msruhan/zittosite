import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPeriodLabel, parseReportPeriod } from "./admin-reports.service";

test("parseReportPeriod reads dari/sampai as inclusive WIB days", () => {
  const p = parseReportPeriod({ dari: "2026-10-01", sampai: "2026-10-03" })!;
  assert.equal(p.from, "2026-10-01");
  assert.equal(p.to, "2026-10-03");
  assert.equal(p.start.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(p.end.toISOString(), "2026-10-03T17:00:00.000Z");
});

test("parseReportPeriod swaps reversed ranges and accepts one side", () => {
  const swapped = parseReportPeriod({ dari: "2026-10-05", sampai: "2026-10-01" })!;
  assert.deepEqual([swapped.from, swapped.to], ["2026-10-01", "2026-10-05"]);
  const single = parseReportPeriod({ dari: "2026-10-05" })!;
  assert.deepEqual([single.from, single.to], ["2026-10-05", "2026-10-05"]);
  assert.equal(parseReportPeriod({ dari: "2026-02-30" }), undefined);
});

test("parseReportPeriod keeps the older tahun/bulan filter", () => {
  const month = parseReportPeriod({ tahun: "2026", bulan: "2" })!;
  assert.deepEqual([month.from, month.to], ["2026-02-01", "2026-02-28"]);
  const year = parseReportPeriod({ tahun: "2026" })!;
  assert.deepEqual([year.from, year.to], ["2026-01-01", "2026-12-31"]);
  assert.equal(parseReportPeriod({}), undefined);
});

test("formatPeriodLabel names whole months/years and ranges", () => {
  const label = (dari: string, sampai: string) =>
    formatPeriodLabel(parseReportPeriod({ dari, sampai })!);
  assert.equal(label("2026-10-01", "2026-10-31"), "Oktober 2026");
  assert.equal(label("2026-01-01", "2026-12-31"), "Tahun 2026");
  assert.equal(label("2026-10-03", "2026-10-03"), "3 Okt 2026");
  assert.equal(label("2026-10-01", "2026-10-15"), "1–15 Okt 2026");
  assert.equal(label("2026-09-28", "2026-10-03"), "28 Sep – 3 Okt 2026");
  assert.equal(label("2025-12-28", "2026-01-03"), "28 Des 2025 – 3 Jan 2026");
});
