"use client";

import * as React from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DataValue } from "@/components/ui/data-value";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service, User, UserGroup } from "@/lib/types";

type Tab = "manual" | "api";
type Source = "group" | "default";

const SOURCE_TAG: Record<Source, { label: string; className: string }> = {
  group: { label: "Harga group", className: "border-action bg-action-wash text-action-deep" },
  default: { label: "Default", className: "border-hairline bg-mist text-ink-soft" },
};

/** Mirrors apps/api/src/orders/user-price.ts: group price, else default. */
function resolve(service: Service, group: UserGroup | null) {
  const price = group?.prices.find((p) => p.serviceId === service.id)?.price;
  return price != null
    ? { price, source: "group" as Source }
    : { price: service.price, source: "default" as Source };
}

/** Read-only check of what this user pays for every service. */
export function UserPriceDialog({
  user,
  services,
  groups,
  onClose,
}: {
  user: User;
  services: Service[];
  groups: UserGroup[];
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("manual");
  const [query, setQuery] = React.useState("");
  const [onlyChanged, setOnlyChanged] = React.useState(false);

  const group = user.groupId ? (groups.find((g) => g.id === user.groupId) ?? null) : null;
  const rows = React.useMemo(
    () =>
      services.map((service) => ({
        service,
        tab: (service.via === "supplier" ? "api" : "manual") as Tab,
        ...resolve(service, group),
      })),
    [services, group],
  );
  const counts = {
    manual: rows.filter((r) => r.tab === "manual"),
    api: rows.filter((r) => r.tab === "api"),
  };
  const needle = query.trim().toLowerCase();
  const visible = counts[tab].filter(
    (r) =>
      (!needle ||
        r.service.name.toLowerCase().includes(needle) ||
        (r.service.supplierName ?? "").toLowerCase().includes(needle)) &&
      (!onlyChanged || r.source !== "default"),
  );

  return (
    <DialogContent
      className="max-w-3xl"
      title={`Harga untuk ${user.fullName}`}
      description={
        group
          ? `Member group ${group.name}: membayar harga group, layanan yang tidak diatur memakai harga default.`
          : "Tanpa group: semua layanan memakai harga default."
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-3">
        <div role="tablist" aria-label="Jenis layanan" className="flex gap-1 rounded-lg bg-mist p-1">
          {(["manual", "api"] as const).map((id) => {
            const changed = counts[id].filter((r) => r.source !== "default").length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-body font-medium transition-colors duration-150",
                  tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                {id === "manual" ? "Service manual" : "Service API"}
                <span className="font-data text-label text-ink-soft">
                  {changed}/{counts[id].length} harga group
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Cari layanan</span>
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "api" ? "Cari layanan atau supplier" : "Cari layanan"}
              className="pl-9"
            />
          </label>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="size-4 rounded-sm accent-action"
              checked={onlyChanged}
              onChange={(event) => setOnlyChanged(event.target.checked)}
            />
            Hanya harga group
          </label>
        </div>

        <div className="overflow-hidden rounded-md border border-hairline">
          <TableScroll className="max-h-[26rem]">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Layanan</TH>
                  <TH className="text-right">Default</TH>
                  <TH className="text-right">Harga user</TH>
                  <TH>Sumber</TH>
                </TR>
              </THead>
              <TBody>
                {visible.length ? (
                  visible.map(({ service, price, source }) => {
                    const diff = price - service.price;
                    return (
                      <TR key={service.id}>
                        <TD className="max-w-72">
                          <p className="truncate text-body text-ink">{service.name}</p>
                          <p className="truncate text-label text-ink-soft">
                            {[
                              tab === "api" ? service.supplierName : null,
                              service.serviceGroupName,
                              service.active ? null : "Offline",
                            ]
                              .filter(Boolean)
                              .join(" · ") || null}
                          </p>
                        </TD>
                        <TD className="text-right">
                          <DataValue className="text-ink-soft">
                            {formatRupiah(service.price)}
                          </DataValue>
                        </TD>
                        <TD className="text-right">
                          <DataValue emphasis className="block">
                            {formatRupiah(price)}
                          </DataValue>
                          {diff !== 0 ? (
                            <DataValue
                              className={cn(
                                "block text-label",
                                diff < 0 ? "text-cleared-ink" : "text-hold-ink",
                              )}
                            >
                              {diff > 0 ? "+" : "−"}
                              {formatRupiah(Math.abs(diff))}
                            </DataValue>
                          ) : null}
                        </TD>
                        <TD>
                          <Tag className={SOURCE_TAG[source].className}>
                            {source === "group" && group ? group.name : SOURCE_TAG[source].label}
                          </Tag>
                        </TD>
                      </TR>
                    );
                  })
                ) : (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={4} className="py-8 text-center text-body text-ink-soft">
                      {counts[tab].length
                        ? "Tidak ada layanan yang cocok."
                        : "Belum ada layanan di tab ini."}
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </TableScroll>
        </div>
      </div>
    </DialogContent>
  );
}
