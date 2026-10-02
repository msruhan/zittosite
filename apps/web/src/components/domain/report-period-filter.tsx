"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function ReportPeriodFilter({
  years,
  year,
  month,
  allowAllTime = true,
  compact = false,
}: {
  years: number[];
  year: number | null;
  month: number | null;
  allowAllTime?: boolean;
  /** One row with screen-reader-only labels, for card headers. */
  compact?: boolean;
}) {
  const labelClass = compact ? "sr-only" : "text-label text-ink-soft";
  const selectClass = compact ? "h-9" : undefined;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { tahun?: string | null; bulan?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        compact ? "flex-row gap-2" : "w-full flex-col sm:w-auto sm:flex-row",
      )}
    >
      <div className={cn("flex flex-col gap-1.5", compact ? "w-24" : "sm:w-40")}>
        <label htmlFor="report-tahun" className={labelClass}>
          Tahun
        </label>
        <Select
          id="report-tahun"
          className={selectClass}
          value={year ? String(year) : "all"}
          onValueChange={(value) =>
            navigate(
              value === "all"
                ? { tahun: null, bulan: null }
                : { tahun: value, bulan: month ? String(month) : null },
            )
          }
          options={[
            ...(allowAllTime ? [{ value: "all", label: "Semua waktu" }] : []),
            ...years.map((y) => ({ value: String(y), label: String(y) })),
          ]}
        />
      </div>
      <div className={cn("flex flex-col gap-1.5", compact ? "w-36" : "sm:w-44")}>
        <label htmlFor="report-bulan" className={labelClass}>
          Bulan
        </label>
        <Select
          id="report-bulan"
          className={selectClass}
          value={month ? String(month) : "all"}
          onValueChange={(value) => {
            if (value === "all") {
              navigate({ bulan: null });
              return;
            }
            const targetYear = year ?? years[0] ?? new Date().getFullYear();
            navigate({ tahun: String(targetYear), bulan: value });
          }}
          options={[
            { value: "all", label: "Semua bulan" },
            ...MONTHS.map((label, i) => ({ value: String(i + 1), label })),
          ]}
        />
      </div>
    </div>
  );
}
