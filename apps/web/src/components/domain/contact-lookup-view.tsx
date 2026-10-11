"use client";

import * as React from "react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import type { ContactLookupResult, ContactTag } from "@/lib/contact-lookup-result";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

const TAGS_PER_PAGE = 10;

/** Getcontact-style result: profile, e-wallets, then the saved-name tags 10 per page. */
export function ContactLookupView({
  result,
  className,
}: {
  result: ContactLookupResult;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {result.details.length ? (
        <dl className="rounded-md border border-hairline bg-mist/35 px-4 py-2.5">
          {result.details.map((line, index) => (
            <div
              key={`${line.label}-${index}`}
              className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-1.5 text-body"
            >
              <dt className="text-ink-soft after:content-[':']">{line.label}</dt>
              <dd className="min-w-0 break-words font-data tabular text-ink">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {result.wallets.length ? (
        <section className="min-w-0">
          <SectionTitle title="E-wallet" note={`${result.wallets.length} terdaftar`} />
          <div className="overflow-x-auto overscroll-x-contain rounded-md border border-hairline">
            <table className="w-full border-collapse text-left text-label">
              <thead>
                <tr className="bg-mist/50">
                  <Th className="w-32">Provider</Th>
                  <Th>Nama akun</Th>
                </tr>
              </thead>
              <tbody>
                {result.wallets.map((wallet, index) => (
                  <tr key={`${wallet.provider}-${index}`} className="border-t border-hairline/70">
                    <Td className="font-bold text-ink">{wallet.provider}</Td>
                    <Td className="font-data tabular text-ink-soft">{wallet.name}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <TagTable tags={result.tags} />

      {result.summary ? (
        <section>
          <SectionTitle title="Ringkasan" />
          <p className="max-w-[70ch] rounded-md border border-hairline bg-mist/35 px-4 py-3 text-body text-ink">
            {result.summary}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function TagTable({ tags }: { tags: ContactTag[] }) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const showCount = tags.some((tag) => tag.count !== null);
  const rows = tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => matchesSearch(query, [tag.name]));
  const totalPages = Math.max(1, Math.ceil(rows.length / TAGS_PER_PAGE));
  const current = Math.min(page, totalPages);
  const first = (current - 1) * TAGS_PER_PAGE;
  const shown = rows.slice(first, first + TAGS_PER_PAGE);

  return (
    <section className="min-w-0">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle title="Tag" note={`${tags.length} tag`} className="mb-0" />
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          label="Cari tag"
          placeholder="Cari nama tag"
          className="sm:max-w-xs"
        />
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-md border border-hairline">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full border-collapse text-left text-label">
              <thead>
                <tr className="bg-mist/50">
                  <Th className="w-12 text-center">No</Th>
                  <Th>Nama tag</Th>
                  {showCount ? <Th className="w-20 text-right">Jumlah</Th> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ tag, index }) => (
                  <tr key={index} className="border-t border-hairline/70 align-top">
                    <Td className="text-center font-data tabular text-ink-faint">{index + 1}</Td>
                    <Td className="whitespace-normal break-words text-ink">{tag.name}</Td>
                    {showCount ? (
                      <Td className="text-right font-data tabular text-ink-soft">{tag.count ?? "—"}</Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={current}
            totalPages={totalPages}
            onPageChange={setPage}
            summary={`${first + 1}–${first + shown.length} dari ${rows.length} tag`}
          />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-center text-body text-ink-soft">
          Tidak ada tag yang cocok dengan &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
    </section>
  );
}

function SectionTitle({ title, note, className }: { title: string; note?: string; className?: string }) {
  return (
    <p className={cn("mb-2 text-label font-bold uppercase tracking-[0.08em] text-ink-soft", className)}>
      {title}
      {note ? (
        <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">· {note}</span>
      ) : null}
    </p>
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
