"use client";

import * as React from "react";
import { SearchInput } from "@/components/ui/search-input";
import { formatCeirAction, type CeirHistoryEvent } from "@/lib/ceir-result";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

export function CeirHistoryTable({ history }: { history: CeirHistoryEvent[] }) {
  const [query, setQuery] = React.useState("");
  const showImsi = history.some((event) => event.imsi);
  const rows = history
    .map((event, index) => ({ event, index }))
    .filter(({ event }) =>
      matchesSearch(query, [
        event.date,
        event.imsi,
        event.action,
        formatCeirAction(event.action),
        event.note,
      ]),
    );

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-label font-bold uppercase tracking-[0.08em] text-ink-soft">
          Riwayat
          <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">
            · {history.length} entri
          </span>
        </p>
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari riwayat CEIR"
          placeholder="Cari tanggal, IMSI, aksi, atau catatan"
          className="sm:max-w-xs"
        />
      </div>
      {rows.length ? (
        <div className="overflow-x-auto overscroll-x-contain rounded-md border border-hairline">
          <table className="w-max min-w-full border-collapse text-left text-label">
            <thead>
              <tr className="bg-mist/50">
                <Th className="w-8 text-center">No</Th>
                <Th>Tanggal</Th>
                {showImsi ? <Th>IMSI</Th> : null}
                <Th>Aksi</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event, index }) => (
                <tr key={`${event.date}-${index}`} className="border-t border-hairline/70 align-top">
                  <Td className="text-center text-ink-faint">{index + 1}</Td>
                  <Td className="font-data tabular text-ink">{event.date}</Td>
                  {showImsi ? (
                    <Td className="font-data tabular text-ink-soft">{event.imsi ?? "—"}</Td>
                  ) : null}
                  <Td className="font-bold lowercase text-ink">{formatCeirAction(event.action)}</Td>
                  <Td className="text-ink-soft">{event.note ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-center text-body text-ink-soft">
          Tidak ada riwayat yang cocok dengan &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2 text-label font-bold uppercase tracking-[0.04em] text-ink-soft",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("whitespace-nowrap px-3 py-2", className)}>{children}</td>;
}
