"use client";

import * as React from "react";
import { ArrowCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataValue } from "@/components/ui/data-value";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { BulkPriceBar } from "@/components/domain/group-editor";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service, User, UserGroup } from "@/lib/types";

type Tab = "manual" | "api";
type Source = "user" | "group" | "default";
type PriceSet = { serviceId: string; price: number }[];

const SOURCE_TAG: Record<Source, { label: string; className: string }> = {
  user: { label: "Khusus user", className: "border-hold-edge bg-hold-wash text-hold-ink" },
  group: { label: "Harga group", className: "border-action bg-action-wash text-action-deep" },
  default: { label: "Default", className: "border-hairline bg-mist text-ink-soft" },
};

const ROW_TINT: Record<Source, string> = {
  user: "bg-hold-wash/60 shadow-[inset_3px_0_0_var(--color-hold-edge)] hover:bg-hold-wash",
  group: "bg-action-wash/50 shadow-[inset_3px_0_0_var(--color-action)] hover:bg-action-wash",
  default: "",
};

function SummaryChip({
  source,
  count,
  children,
}: {
  source: Source;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-label font-medium",
        SOURCE_TAG[source].className,
        count === 0 && "opacity-60",
      )}
    >
      {children}
      <span className="font-data font-bold">{count}</span>
    </span>
  );
}

/** Mirrors apps/api/src/orders/user-price.ts: user price, then group price, then default. */
function resolve(service: Service, group: UserGroup | null, own: Map<string, number>) {
  const groupPrice = group?.prices.find((p) => p.serviceId === service.id)?.price;
  const base = groupPrice ?? service.price;
  const userPrice = own.get(service.id);
  if (userPrice != null) return { base, price: userPrice, source: "user" as Source };
  return { base, price: base, source: (groupPrice != null ? "group" : "default") as Source };
}

/** Every service with what this user pays; exceptions for this user are set here. */
export function UserPriceDialog({
  user,
  services,
  groups,
  onChanged,
  onClose,
}: {
  user: User;
  services: Service[];
  groups: UserGroup[];
  onChanged: (user: User) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("manual");
  const [query, setQuery] = React.useState("");
  const [onlyChanged, setOnlyChanged] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [busy, setBusy] = React.useState(false);

  const group = user.groupId ? (groups.find((g) => g.id === user.groupId) ?? null) : null;
  const baseLabel = group ? "harga group/default" : "harga default";
  const baseName = group ? "group/default" : "default";
  const own = React.useMemo(
    () => new Map((user.customPrices ?? []).map((p) => [p.serviceId, p.price])),
    [user.customPrices],
  );
  const rows = React.useMemo(
    () =>
      services.map((service) => ({
        service,
        tab: (service.via === "supplier" ? "api" : "manual") as Tab,
        ...resolve(service, group, own),
      })),
    [services, group, own],
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
  // The bulk bar computes "naikkan/diskon" from what the user pays before their own price.
  const chosen = rows
    .filter((r) => selected.has(r.service.id))
    .map((r) => ({ ...r.service, price: r.base }));

  function setMany(ids: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function savePrices(set: PriceSet, remove: string[] = []) {
    setBusy(true);
    try {
      const next = await api<User>(`/admin/users/${user.id}/prices`, {
        method: "PUT",
        body: JSON.stringify({ set, remove }),
      });
      onChanged(next);
      setSelected(new Set());
      const skipped = set.filter(
        (p) => !next.customPrices?.some((c) => c.serviceId === p.serviceId),
      ).length;
      toast.success(set.length ? "Harga khusus disimpan" : `Kembali ke ${baseLabel}`, {
        description: skipped
          ? `${skipped} layanan sama dengan ${baseLabel}, jadi tidak disimpan sebagai harga khusus.`
          : `${set.length + remove.length} layanan untuk ${user.fullName}.`,
      });
      return true;
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const visibleIds = visible.map((r) => r.service.id);
  const countOf = (list: typeof rows, source: Source) =>
    list.filter((r) => r.source === source).length;
  const totals = {
    group: countOf(rows, "group"),
    user: countOf(rows, "user"),
    default: countOf(rows, "default"),
  };
  const changedTotal = totals.group + totals.user;

  return (
    <DialogContent
      className="max-w-4xl"
      title={`Harga untuk ${user.fullName}`}
      description={
        group
          ? `Member group ${group.name}. Urutan harga: harga khusus user → harga group → harga default.`
          : "Tanpa group. Urutan harga: harga khusus user → harga default."
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-3">
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            changedTotal ? "border-action/40 bg-action-wash/50" : "border-hairline bg-mist/60",
          )}
        >
          <p className="text-body font-medium text-ink">
            {changedTotal
              ? `${changedTotal} dari ${rows.length} layanan sudah bukan harga default untuk ${user.fullName}.`
              : `${user.fullName} membayar harga default untuk semua layanan.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {group ? (
              <SummaryChip source="group" count={totals.group}>
                Harga group {group.name}
              </SummaryChip>
            ) : null}
            <SummaryChip source="user" count={totals.user}>
              Harga khusus user
            </SummaryChip>
            <SummaryChip source="default" count={totals.default}>
              Harga default
            </SummaryChip>
          </div>
        </div>

        <div role="tablist" aria-label="Jenis layanan" className="flex gap-1 rounded-lg bg-mist p-1">
          {(["manual", "api"] as const).map((id) => (
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
                {group ? `${countOf(counts[id], "group")} group · ` : ""}
                {countOf(counts[id], "user")} khusus · {counts[id].length} layanan
              </span>
            </button>
          ))}
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
            Hanya yang beda dari default
          </label>
        </div>

        <div className="overflow-hidden rounded-md border border-hairline">
          <TableScroll className="max-h-[26rem]">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-8">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua layanan yang tampil"
                      className="size-4 rounded-sm accent-action"
                      disabled={!visible.length}
                      checked={visible.length > 0 && visibleIds.every((id) => selected.has(id))}
                      onChange={(event) => setMany(visibleIds, event.target.checked)}
                    />
                  </TH>
                  <TH>Layanan</TH>
                  <TH className="text-right">{group ? "Group / default" : "Default"}</TH>
                  <TH className="w-40 text-right">Harga user</TH>
                  <TH>Sumber</TH>
                  <TH className="w-10">
                    <span className="sr-only">Aksi</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {visible.length ? (
                  visible.map(({ service, base, price, source }) => (
                    <TR key={service.id} className={ROW_TINT[source]}>
                      <TD>
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${service.name}`}
                          className="size-4 rounded-sm accent-action"
                          checked={selected.has(service.id)}
                          onChange={(event) => setMany([service.id], event.target.checked)}
                        />
                      </TD>
                      <TD className="max-w-72">
                        <p className="truncate text-body text-ink">{service.name}</p>
                        <p className="truncate text-label text-ink-soft">
                          {[
                            tab === "api" ? service.supplierName : null,
                            service.serviceGroupName,
                            service.active ? null : service.hidden ? "Tersembunyi" : "Offline",
                          ]
                            .filter(Boolean)
                            .join(" · ") || null}
                        </p>
                      </TD>
                      <TD className="text-right">
                        <DataValue className="block text-ink-soft">{formatRupiah(base)}</DataValue>
                        {base !== service.price ? (
                          <DataValue className="block text-label text-ink-faint">
                            default {formatRupiah(service.price)}
                          </DataValue>
                        ) : null}
                      </TD>
                      <TD>
                        <PriceInput
                          key={`${service.id}:${price}`}
                          label={`Harga khusus ${service.name}`}
                          price={price}
                          own={source === "user"}
                          disabled={busy}
                          onSave={(next) =>
                            next === base
                              ? source === "user"
                                ? savePrices([], [service.id])
                                : Promise.resolve(true)
                              : savePrices([{ serviceId: service.id, price: next }])
                          }
                        />
                      </TD>
                      <TD>
                        <Tag className={SOURCE_TAG[source].className}>
                          {source === "group" && group ? group.name : SOURCE_TAG[source].label}
                        </Tag>
                      </TD>
                      <TD>
                        {source === "user" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Kembalikan ${service.name} ke ${baseLabel}`}
                            title={`Hapus harga khusus (kembali ke ${baseLabel})`}
                            disabled={busy}
                            onClick={() => void savePrices([], [service.id])}
                          >
                            <ArrowCounterClockwise className="size-4 text-ink-soft" />
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={6} className="py-8 text-center text-body text-ink-soft">
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

        {chosen.length ? (
          <BulkPriceBar
            className="bottom-0"
            chosen={chosen}
            priceOf={own}
            busy={busy}
            resetLabel={baseName}
            onClear={() => setSelected(new Set())}
            onApply={(set) => savePrices(set)}
            onReset={(ids) => savePrices([], ids)}
          />
        ) : (
          <p className="text-label text-ink-soft">
            Ketik harga langsung di kolom Harga user, atau centang beberapa layanan untuk
            mengatur sekaligus. Harga yang sama dengan {baseLabel} tidak disimpan sebagai harga
            khusus.
          </p>
        )}
      </div>
    </DialogContent>
  );
}

function PriceInput({
  label,
  price,
  own,
  disabled,
  onSave,
}: {
  label: string;
  price: number;
  own: boolean;
  disabled: boolean;
  onSave: (price: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = React.useState(String(price));

  async function commit() {
    const next = Number(draft);
    if (!draft || !Number.isFinite(next) || next === price) {
      setDraft(String(price));
      return;
    }
    if (!(await onSave(next))) setDraft(String(price));
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label text-ink-soft">
        Rp
      </span>
      <Input
        aria-label={label}
        inputMode="numeric"
        className={cn(
          "h-9 pl-9 text-right font-data tabular",
          own ? "border-hold-edge font-bold text-ink" : "text-ink-soft",
        )}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") setDraft(String(price));
        }}
      />
    </div>
  );
}
