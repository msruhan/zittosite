"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Calendar days as "YYYY-MM-DD" in Asia/Jakarta; all math runs on UTC noon to dodge DST/offsets. */
type Ymd = string;

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function jakartaToday(): Ymd {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDate(ymd: Ymd): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

function toYmd(date: Date): Ymd {
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: Ymd, days: number): Ymd {
  const date = toDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

function monthStart(ymd: Ymd): Ymd {
  return `${ymd.slice(0, 7)}-01`;
}

function addMonths(ymd: Ymd, months: number): Ymd {
  const date = toDate(monthStart(ymd));
  date.setUTCMonth(date.getUTCMonth() + months);
  return toYmd(date);
}

function monthEnd(ymd: Ymd): Ymd {
  return addDays(addMonths(ymd, 1), -1);
}

function daysBetween(from: Ymd, to: Ymd): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;
}

function format(ymd: Ymd, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opts }).format(toDate(ymd));
}

function rangeText(from: Ymd, to: Ymd): string {
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (from === to) return format(from, full);
  const head = format(
    from,
    from.slice(0, 4) === to.slice(0, 4) ? { day: "numeric", month: "short" } : full,
  );
  return `${head} – ${format(to, full)}`;
}

/** Monday-first grid of a month, padded with nulls. */
function monthGrid(first: Ymd): (Ymd | null)[] {
  const offset = (toDate(first).getUTCDay() + 6) % 7;
  const count = daysBetween(first, monthEnd(first));
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => addDays(first, i)),
  ];
}

type Preset = { key: string; label: string; range: () => [Ymd, Ymd] | null };

function presets(allowAllTime: boolean): Preset[] {
  const today = jakartaToday();
  return [
    { key: "today", label: "Hari ini", range: () => [today, today] },
    { key: "yesterday", label: "Kemarin", range: () => [addDays(today, -1), addDays(today, -1)] },
    { key: "7d", label: "7 hari terakhir", range: () => [addDays(today, -6), today] },
    { key: "30d", label: "30 hari terakhir", range: () => [addDays(today, -29), today] },
    { key: "month", label: "Bulan ini", range: () => [monthStart(today), monthEnd(today)] },
    {
      key: "last-month",
      label: "Bulan lalu",
      range: () => [addMonths(today, -1), monthEnd(addMonths(today, -1))],
    },
    {
      key: "year",
      label: "Tahun ini",
      range: () => [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`],
    },
    ...(allowAllTime ? [{ key: "all", label: "Semua waktu", range: () => null }] : []),
  ];
}

function MonthGrid({
  first,
  from,
  to,
  hover,
  today,
  onPick,
  onHover,
}: {
  first: Ymd;
  from: Ymd | null;
  to: Ymd | null;
  hover: Ymd | null;
  today: Ymd;
  onPick: (day: Ymd) => void;
  onHover: (day: Ymd | null) => void;
}) {
  const end = to ?? (from && hover && hover >= from ? hover : from);
  return (
    <div className="w-[17.5rem]">
      <p className="mb-2 text-center text-body font-bold capitalize text-ink">
        {format(first, { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 text-center text-label text-ink-faint">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)}>
        {monthGrid(first).map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;
          const future = day > today;
          const isStart = day === from;
          const isEnd = day === end;
          const inRange = Boolean(from && end && day > from && day < end);
          const weekday = index % 7;
          return (
            <div
              key={day}
              className={cn(
                "py-0.5",
                (inRange || (isStart && end && end !== from) || (isEnd && from && end !== from)) &&
                  "bg-action-wash",
                isStart && end && end !== from && "rounded-l-full",
                isEnd && from && end !== from && "rounded-r-full",
                inRange && weekday === 0 && "rounded-l-full",
                inRange && weekday === 6 && "rounded-r-full",
              )}
            >
              <button
                type="button"
                disabled={future}
                onClick={() => onPick(day)}
                onMouseEnter={() => onHover(day)}
                aria-pressed={isStart || isEnd}
                aria-label={format(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                className={cn(
                  "mx-auto flex size-9 items-center justify-center rounded-full font-data text-body tabular",
                  "transition-[background-color,color,transform] duration-150 ease-out-strong active:scale-[0.94]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40",
                  "disabled:cursor-not-allowed disabled:text-hairline",
                  isStart || isEnd
                    ? "bg-action text-surface shadow-action"
                    : inRange
                      ? "text-action-deep hover:bg-action/15"
                      : "text-ink hover:bg-mist",
                  day === today && !(isStart || isEnd) && "font-bold text-action ring-1 ring-action/30",
                )}
              >
                {Number(day.slice(8))}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Start–end date filter for reports. Writes `dari`/`sampai` (YYYY-MM-DD, WIB)
 * to the URL and clears the older `tahun`/`bulan` params.
 */
export function DateRangeFilter({
  from,
  to,
  label,
  allowAllTime = true,
  compact = false,
}: {
  from: Ymd | null;
  to: Ymd | null;
  /** Server-formatted label of the active period. */
  label: string | null;
  allowAllTime?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = jakartaToday();

  const [open, setOpen] = React.useState(false);
  const [draftFrom, setDraftFrom] = React.useState<Ymd | null>(from);
  const [draftTo, setDraftTo] = React.useState<Ymd | null>(to);
  const [hover, setHover] = React.useState<Ymd | null>(null);
  const [view, setView] = React.useState<Ymd>(() => addMonths(to ?? today, -1));
  const [direction, setDirection] = React.useState<"next" | "prev" | null>(null);

  function openChange(next: boolean) {
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
      setHover(null);
      setDirection(null);
      setView(addMonths(to ?? today, -1));
    }
    setOpen(next);
  }

  function shift(months: number) {
    setDirection(months > 0 ? "next" : "prev");
    setView((current) => addMonths(current, months));
  }

  function pick(day: Ymd) {
    if (!draftFrom || draftTo) {
      setDraftFrom(day);
      setDraftTo(null);
    } else if (day < draftFrom) {
      setDraftFrom(day);
    } else {
      setDraftTo(day);
    }
  }

  function navigate(range: [Ymd, Ymd] | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tahun");
    params.delete("bulan");
    if (range) {
      params.set("dari", range[0]);
      params.set("sampai", range[1]);
    } else {
      params.delete("dari");
      params.delete("sampai");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setOpen(false);
  }

  function applyPreset(preset: Preset) {
    const range = preset.range();
    if (!range) {
      navigate(null);
      return;
    }
    setDraftFrom(range[0]);
    setDraftTo(range[1]);
    setDirection(range[1] > view ? "next" : "prev");
    setView(addMonths(range[1], -1));
  }

  const activePreset = presets(allowAllTime).find((preset) => {
    const range = preset.range();
    return range ? range[0] === draftFrom && range[1] === draftTo : !draftFrom;
  })?.key;
  const draftEnd = draftTo ?? draftFrom;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <PopoverPrimitive.Trigger
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-body text-ink",
          "transition-[border-color,box-shadow,transform] duration-150 ease-out-strong active:scale-[0.98]",
          "hover:border-ink-faint focus-visible:outline-none focus-visible:border-action",
          "focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_22%,transparent)]",
          "data-[state=open]:border-action",
          compact ? "h-9" : "h-10 w-full sm:w-auto",
        )}
        aria-label="Pilih rentang tanggal"
      >
        <CalendarBlank className="size-4 shrink-0 text-action" weight="regular" aria-hidden="true" />
        <span className="truncate">{label ?? "Semua waktu"}</span>
        <CaretDown
          className="ml-auto size-4 shrink-0 text-ink-soft transition-transform duration-150 ease-out-strong [[data-state=open]>&]:rotate-180"
          aria-hidden="true"
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-card border border-hairline bg-surface shadow-lifted",
            "origin-[var(--radix-popover-content-transform-origin)]",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          <div className="flex flex-col sm:flex-row">
            <div className="flex gap-1 overflow-x-auto border-b border-hairline p-2 sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
              {presets(allowAllTime).map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-2 text-left text-body",
                    "transition-[background-color,color] duration-150 ease-out-strong",
                    activePreset === preset.key
                      ? "bg-action-wash font-bold text-action"
                      : "text-ink-soft hover:bg-mist hover:text-ink",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              <div className="relative">
                <div className="absolute inset-x-0 top-0 flex justify-between">
                  <button
                    type="button"
                    onClick={() => shift(-1)}
                    aria-label="Bulan sebelumnya"
                    className="grid size-8 place-items-center rounded-md text-ink-soft transition-[background-color,transform] duration-150 ease-out-strong hover:bg-mist hover:text-ink active:scale-[0.94]"
                  >
                    <CaretLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shift(1)}
                    disabled={addMonths(view, 1) > monthStart(today)}
                    aria-label="Bulan berikutnya"
                    className="grid size-8 place-items-center rounded-md text-ink-soft transition-[background-color,transform] duration-150 ease-out-strong hover:bg-mist hover:text-ink active:scale-[0.94] disabled:opacity-30"
                  >
                    <CaretRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div
                  key={view}
                  className={cn(
                    "flex gap-6 pt-1",
                    direction === "next" && "animate-cal-next",
                    direction === "prev" && "animate-cal-prev",
                  )}
                >
                  <div className="hidden sm:block">
                    <MonthGrid
                      first={view}
                      from={draftFrom}
                      to={draftTo}
                      hover={hover}
                      today={today}
                      onPick={pick}
                      onHover={setHover}
                    />
                  </div>
                  <MonthGrid
                    first={addMonths(view, 1)}
                    from={draftFrom}
                    to={draftTo}
                    hover={hover}
                    today={today}
                    onPick={pick}
                    onHover={setHover}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                <p className="text-body text-ink-soft" aria-live="polite">
                  {draftFrom && draftEnd ? (
                    <>
                      <span className="font-bold text-ink">{rangeText(draftFrom, draftEnd)}</span>
                      {" · "}
                      {daysBetween(draftFrom, draftEnd)} hari
                      {!draftTo ? " · pilih tanggal akhir" : ""}
                    </>
                  ) : (
                    "Pilih tanggal mulai"
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    disabled={!draftFrom}
                    onClick={() => draftFrom && navigate([draftFrom, draftTo ?? draftFrom])}
                  >
                    Terapkan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
