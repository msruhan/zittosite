"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) out.push("gap");
    out.push(page);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  summary,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  summary: string;
}) {
  const stepClass = cn(
    "inline-flex size-8 items-center justify-center rounded-md border border-hairline bg-surface text-ink-soft",
    "transition-[background-color,color,border-color,transform] duration-150 ease-out-strong",
    "hover:bg-mist hover:text-ink active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
      <p className="text-body text-ink-soft">{summary}</p>

      {totalPages > 1 ? (
        <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            className={stepClass}
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          {pageWindow(page, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-body text-ink-faint"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={`Halaman ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                onClick={() => onPageChange(entry)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md font-data tabular text-body",
                  "transition-[background-color,color,transform] duration-150 ease-out-strong active:scale-[0.97]",
                  entry === page
                    ? "bg-action-wash font-semibold text-action"
                    : "border border-hairline bg-surface text-ink-soft hover:bg-mist hover:text-ink",
                )}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            aria-label="Halaman berikutnya"
            className={stepClass}
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
