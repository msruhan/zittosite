"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  event: string;
  label: string;
  category: string;
  actorType: "admin" | "user" | "guest" | "system";
  actorName: string | null;
  actorRole: string | null;
  targetLabel: string | null;
  orderId: string | null;
  summary: string;
  ip: string | null;
  createdAt: string;
};

export type ActivityPage = {
  page: number;
  pageSize: number;
  total: number;
  items: ActivityItem[];
};

type Filters = { category: string; q: string; range: string };

const CATEGORIES: { value: string; label: string; tone: string }[] = [
  { value: "all", label: "Semua", tone: "" },
  {
    value: "auth",
    label: "Login & Logout",
    tone: "bg-queued-wash text-queued-ink border-queued-edge",
  },
  {
    value: "order",
    label: "Order",
    tone: "bg-working-wash text-working-ink border-working-edge",
  },
  {
    value: "payment",
    label: "Pembayaran",
    tone: "bg-cleared-wash text-cleared-ink border-cleared-edge",
  },
  {
    value: "security",
    label: "Keamanan",
    tone: "bg-refused-wash/50 text-refused-ink border-refused-edge",
  },
  {
    value: "user",
    label: "User",
    tone: "bg-hold-wash text-hold-ink border-hold-edge",
  },
  {
    value: "admin",
    label: "Admin",
    tone: "bg-action-wash text-action-deep border-action/30",
  },
  {
    value: "service",
    label: "Layanan",
    tone: "bg-void-wash text-void-ink border-void-edge",
  },
  {
    value: "telegram",
    label: "Telegram",
    tone: "bg-queued-wash text-queued-ink border-queued-edge",
  },
  {
    value: "notification",
    label: "Notifikasi",
    tone: "bg-refused-wash/50 text-refused-ink border-refused-edge",
  },
];

const RANGE_OPTIONS = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "all", label: "Semua waktu" },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  operator: "Admin",
  user: "User",
};

const ACTOR_FALLBACK: Record<ActivityItem["actorType"], string> = {
  admin: "Admin (dihapus)",
  user: "User (dihapus)",
  guest: "Tamu",
  system: "Sistem",
};

/** Failure events get a red dot so they stand out while scanning. */
const ALERT_EVENTS = /failed|locked|denied|late|rejected/;

const pill = [
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px]",
  "text-label font-bold leading-4",
];

function categoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];
}

function roleLabel(item: ActivityItem) {
  if (item.actorRole && ROLE_LABEL[item.actorRole]) {
    return ROLE_LABEL[item.actorRole];
  }
  if (item.actorType === "guest") return "Belum login";
  if (item.actorType === "system") return "Otomatis";
  return null;
}

export function ActivityLogTable({
  data,
  filters,
}: {
  data: ActivityPage;
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState(filters.q);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.category !== "all") params.set("category", merged.category);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.range !== "7d") params.set("range", merged.range);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const firstRow = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastRow = Math.min(data.page * data.pageSize, data.total);
  const filtered =
    filters.category !== "all" || filters.q !== "" || filters.range !== "7d";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kategori">
        {CATEGORIES.map((cat) => {
          const active = filters.category === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => navigate({ category: cat.value })}
              className={cn(
                pill,
                "px-3.5 py-1.5 transition-colors duration-150",
                active
                  ? "border-action bg-action text-surface"
                  : "border-hairline bg-surface text-nav-ink hover:bg-mist",
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ q: query });
          }}
        >
          <label>
            <span className="sr-only">Cari aktivitas</span>
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, username, Order ID, IMEI, atau IP, lalu Enter"
              className="pl-9"
            />
          </label>
        </form>
        <Select
          ariaLabel="Rentang waktu"
          value={filters.range}
          onValueChange={(value) => navigate({ range: value })}
          options={RANGE_OPTIONS}
          className="lg:w-52"
        />
        <Button
          variant="outline"
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
        >
          <ArrowClockwise className={cn(pending && "animate-spin")} />
          Muat ulang
        </Button>
      </div>

      <Card className={cn("transition-opacity", pending && "opacity-60")}>
        {data.items.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-44">Waktu</TH>
                    <TH>Kategori</TH>
                    <TH>Aktivitas</TH>
                    <TH>Pelaku</TH>
                    <TH>Terkait</TH>
                    <TH>IP</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((item) => {
                    const cat = categoryMeta(item.category);
                    const role = roleLabel(item);
                    return (
                      <TR key={item.id}>
                        <TD className="whitespace-nowrap align-top">
                          <time
                            dateTime={item.createdAt}
                            className="block font-data tabular text-ink"
                          >
                            {formatDateTime(item.createdAt)}
                          </time>
                          <span className="text-label text-ink-faint">
                            {formatRelative(item.createdAt)}
                          </span>
                        </TD>
                        <TD className="align-top">
                          <span className={cn(pill, cat.tone)}>{cat.label}</span>
                        </TD>
                        <TD className="min-w-[320px] max-w-[520px] align-top">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            {ALERT_EVENTS.test(item.event) ? (
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full bg-refused-ink"
                              />
                            ) : null}
                            {item.label}
                          </p>
                          <p className="mt-0.5 whitespace-normal break-words text-body text-ink-soft">
                            {item.summary}
                          </p>
                        </TD>
                        <TD className="whitespace-nowrap align-top">
                          <p className="font-medium text-ink">
                            {item.actorName ?? ACTOR_FALLBACK[item.actorType]}
                          </p>
                          {role ? (
                            <span className="text-label text-ink-faint">
                              {role}
                            </span>
                          ) : null}
                        </TD>
                        <TD className="whitespace-nowrap align-top">
                          {item.orderId ? (
                            <Link
                              href={`/admin/orders/${item.orderId}`}
                              className="font-data font-semibold text-action hover:underline"
                            >
                              {item.orderId}
                            </Link>
                          ) : null}
                          {item.targetLabel ? (
                            <p className="text-body text-ink-soft">
                              {item.targetLabel}
                            </p>
                          ) : null}
                          {!item.orderId && !item.targetLabel ? (
                            <span className="text-ink-faint">—</span>
                          ) : null}
                        </TD>
                        <TD className="whitespace-nowrap align-top">
                          {item.ip ? (
                            <DataValue className="text-ink-soft">
                              {item.ip}
                            </DataValue>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
            <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-data tabular text-body text-ink-soft">
                Menampilkan {firstRow}–{lastRow} dari {data.total} aktivitas
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page <= 1 || pending}
                  onClick={() => navigate({ ...filters, page: data.page - 1 })}
                >
                  <CaretLeft />
                  Sebelumnya
                </Button>
                <span className="font-data tabular text-body text-ink-soft">
                  {data.page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page >= totalPages || pending}
                  onClick={() => navigate({ ...filters, page: data.page + 1 })}
                >
                  Berikutnya
                  <CaretRight />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<ClockCounterClockwise />}
            title={filtered ? "Tidak ada aktivitas sesuai filter" : "Belum ada aktivitas"}
            description={
              filtered
                ? "Coba ubah kategori, kata kunci, atau rentang waktu."
                : "Aktivitas login, order, dan pembayaran akan muncul di sini."
            }
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    navigate({ category: "all", q: "", range: "7d" });
                  }}
                >
                  Reset filter
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}
