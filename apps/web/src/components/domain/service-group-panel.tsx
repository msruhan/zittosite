"use client";

import * as React from "react";
import { MagnifyingGlass, PencilSimple, Plus, Tag as TagIcon, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import { formatRupiah, formatUsd, sanitizeUsdInput, usdCentsToIdr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type PriceAdjustment,
  adjustedPrice,
  adjustmentError,
} from "@/lib/service-group-pricing";
import type { Service, ServiceGroup } from "@/lib/types";

/**
 * Layanan Spesial groups: pick member services, then bulk-edit their selling
 * price by a fixed amount or a percentage.
 */
export function ServiceGroupPanel({
  groups,
  services,
  usdRate,
  onChanged,
}: {
  groups: ServiceGroup[];
  /** Every Layanan Spesial service (the only ones a group may hold). */
  services: Service[];
  usdRate: number;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<ServiceGroup | "new" | null>(null);
  const [pricing, setPricing] = React.useState<ServiceGroup | null>(null);
  const [deleting, setDeleting] = React.useState<ServiceGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const byId = React.useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const membersOf = (group: ServiceGroup) =>
    group.serviceIds.map((id) => byId.get(id)).filter((s): s is Service => Boolean(s));

  async function handleDelete(group: ServiceGroup) {
    setDeleteBusy(true);
    try {
      await api(`/admin/service-groups/${group.id}`, { method: "DELETE" });
      await onChanged();
      setDeleting(null);
      toast.success("Grup dihapus", { description: `Layanan di ${group.name} tetap ada.` });
    } catch (err) {
      toast.error("Gagal menghapus", {
        description: err instanceof ApiError ? err.message : "Hapus gagal",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-title">Grup Layanan Spesial</CardTitle>
          <CardDescription className="mt-1">
            Kelompokkan layanan untuk mengubah harga sekaligus. Nama grup juga tampil sebagai judul
            di daftar layanan user.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing("new")}
          disabled={services.length === 0}
        >
          <Plus aria-hidden="true" />
          Buat grup
        </Button>
      </CardHeader>
      <CardBody className="pt-4">
        {groups.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-body text-ink-soft">
            {services.length === 0
              ? "Belum ada layanan di menu Layanan Spesial. Tambahkan dari API dan pilih menu Layanan Spesial."
              : "Belum ada grup. Buat grup lalu pilih layanan yang ingin dimasukkan."}
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {groups.map((group) => {
              const members = membersOf(group);
              const prices = members
                .map((s) => s.priceUsdCents)
                .filter((p): p is number => p != null);
              return (
                <li
                  key={group.id}
                  className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{group.name}</p>
                    <p className="font-data text-label text-ink-soft">
                      {members.length} layanan
                      {prices.length
                        ? ` · ${formatUsd(Math.min(...prices))}${
                            prices.length > 1 && Math.max(...prices) !== Math.min(...prices)
                              ? `–${formatUsd(Math.max(...prices))}`
                              : ""
                          }`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={members.length === 0}
                      onClick={() => setPricing(group)}
                    >
                      <TagIcon aria-hidden="true" />
                      Atur harga
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit grup ${group.name}`}
                      onClick={() => setEditing(group)}
                    >
                      <PencilSimple className="size-4 text-action" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Hapus grup ${group.name}`}
                      onClick={() => setDeleting(group)}
                    >
                      <Trash className="size-4 text-refused-ink" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing !== null ? (
          <GroupFormDialog
            group={editing === "new" ? null : editing}
            groups={groups}
            services={services}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              await onChanged();
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={pricing !== null} onOpenChange={(open) => !open && setPricing(null)}>
        {pricing ? (
          <PriceAdjustDialog
            group={pricing}
            members={membersOf(pricing)}
            usdRate={usdRate}
            onCancel={() => setPricing(null)}
            onApplied={async () => {
              await onChanged();
              setPricing(null);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <DialogContent
            title={`Hapus grup ${deleting.name}?`}
            description="Layanan di dalamnya tidak ikut terhapus dan harganya tidak berubah."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDeleting(null)}>
                  Batal
                </Button>
                <Button
                  variant="danger"
                  loading={deleteBusy}
                  loadingLabel="Menghapus"
                  onClick={() => void handleDelete(deleting)}
                >
                  Hapus grup
                </Button>
              </>
            }
          >
            <p className="text-body text-ink-soft">
              {deleting.serviceIds.length} layanan akan keluar dari grup ini.
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}

function GroupFormDialog({
  group,
  groups,
  services,
  onCancel,
  onSaved,
}: {
  group: ServiceGroup | null;
  groups: ServiceGroup[];
  services: Service[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = React.useState(group?.name ?? "");
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(group?.serviceIds ?? []),
  );
  const [query, setQuery] = React.useState("");
  const [nameError, setNameError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  const groupNameOf = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      if (g.id === group?.id) continue;
      for (const id of g.serviceIds) map.set(id, g.name);
    }
    return map;
  }, [groups, group]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? services.filter((s) => s.name.toLowerCase().includes(needle)) : services;
  }, [services, query]);
  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const moving = [...selected].filter((id) => groupNameOf.has(id)).length;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filtered) {
        if (checked) next.add(s.id);
        else next.delete(s.id);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Masukkan nama grup.");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), serviceIds: [...selected] });
      if (group) {
        await api(`/admin/service-groups/${group.id}`, { method: "PATCH", body });
      } else {
        await api("/admin/service-groups", { method: "POST", body });
      }
      toast.success(group ? "Grup disimpan" : "Grup dibuat", {
        description: `${name.trim()} · ${selected.size} layanan`,
      });
      await onSaved();
    } catch (err) {
      toast.error("Gagal", { description: err instanceof ApiError ? err.message : "Simpan gagal" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      className="max-w-2xl"
      title={group ? "Edit grup" : "Buat grup"}
      description="Pilih layanan Layanan Spesial yang masuk ke grup ini. Satu layanan hanya bisa berada di satu grup."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" form="service-group-form" loading={saving} loadingLabel="Menyimpan">
            Simpan grup
          </Button>
        </>
      }
    >
      <form id="service-group-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nama grup" htmlFor="group-name" required error={nameError}>
          <Input
            id="group-name"
            value={name}
            placeholder="Misalnya iPad FMI OFF"
            invalid={Boolean(nameError)}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
            }}
          />
        </Field>

        <label className="relative block">
          <span className="sr-only">Cari layanan</span>
          <MagnifyingGlass
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari layanan"
            className="pl-9"
          />
        </label>

        <div className="overflow-hidden rounded-md border border-hairline">
          <div className="flex items-center justify-between gap-3 border-b border-hairline bg-mist/60 px-3.5 py-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-body font-medium text-ink">
              <input
                type="checkbox"
                className="size-4 rounded-sm accent-action"
                checked={allSelected}
                disabled={filtered.length === 0}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              Pilih semua
            </label>
            <span className="font-data text-label text-ink-soft">
              {selected.size} dipilih · {services.length} layanan
            </span>
          </div>
          <div className="max-h-[22rem] divide-y divide-hairline overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-body text-ink-soft">
                Tidak ada layanan yang cocok.
              </p>
            ) : (
              filtered.map((service) => {
                const otherGroup = groupNameOf.get(service.id);
                return (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-mist"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded-sm accent-action"
                      checked={selected.has(service.id)}
                      onChange={(event) => toggle(service.id, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {service.name}
                      </span>
                      {otherGroup ? (
                        <span className="block truncate text-label text-ink-soft">
                          Saat ini di grup {otherGroup}
                        </span>
                      ) : null}
                    </span>
                    {!service.active ? (
                      <Tag className="border-hairline bg-mist text-ink-soft">Offline</Tag>
                    ) : null}
                    <DataValue className="shrink-0 text-ink-soft">
                      {service.priceUsdCents != null
                        ? formatUsd(service.priceUsdCents)
                        : formatRupiah(service.price)}
                    </DataValue>
                  </label>
                );
              })
            )}
          </div>
        </div>
        {moving > 0 ? (
          <p className="text-body text-hold-ink">
            {moving} layanan akan dipindah dari grup lain ke grup ini.
          </p>
        ) : null}
      </form>
    </DialogContent>
  );
}

const ROUND_OPTIONS = [
  { value: "1", label: "Tanpa pembulatan" },
  { value: "10", label: "Kelipatan $0.10" },
  { value: "50", label: "Kelipatan $0.50" },
  { value: "100", label: "Kelipatan $1" },
];

function PriceAdjustDialog({
  group,
  members,
  usdRate,
  onCancel,
  onApplied,
}: {
  group: ServiceGroup;
  members: Service[];
  usdRate: number;
  onCancel: () => void;
  onApplied: () => Promise<void>;
}) {
  const [direction, setDirection] = React.useState<PriceAdjustment["direction"]>("increase");
  const [mode, setMode] = React.useState<PriceAdjustment["mode"]>("amount");
  const [base, setBase] = React.useState<PriceAdjustment["base"]>("price");
  const [roundTo, setRoundTo] = React.useState<PriceAdjustment["roundTo"]>(1);
  const [raw, setRaw] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const entered = Number(raw.replace(",", ".")) || 0;
  const adjustment: PriceAdjustment = {
    direction,
    mode,
    base,
    roundTo,
    value: mode === "amount" ? Math.round(entered * 100) : entered,
  };
  const invalid = raw ? adjustmentError(adjustment) : undefined;
  const ready = Boolean(raw) && !invalid;
  const unpriced = members.filter((s) => s.priceUsdCents == null);
  const rows = members.map((service) => {
    const price = service.priceUsdCents ?? 0;
    const cost = service.costUsdCents ?? 0;
    const next = ready ? adjustedPrice({ price, costPrice: cost }, adjustment) : null;
    return { service, price, cost, next };
  });
  const tooLow = rows.find((row) => row.next !== null && row.next < 1);
  const belowCost = rows.filter((row) => row.next !== null && row.cost > 0 && row.next < row.cost)
    .length;
  const missingCost = base === "cost" && rows.some((row) => row.cost === 0);

  async function apply() {
    if (!ready || tooLow || unpriced.length) return;
    setBusy(true);
    try {
      await api(`/admin/service-groups/${group.id}/adjust-price`, {
        method: "POST",
        body: JSON.stringify({ direction, mode, base, value: entered, roundToCents: roundTo }),
      });
      toast.success("Harga diperbarui", {
        description: `${members.length} layanan di grup ${group.name}.`,
      });
      await onApplied();
    } catch (err) {
      toast.error("Gagal", { description: err instanceof ApiError ? err.message : "Update gagal" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent
      className="max-w-2xl"
      title={`Atur harga · ${group.name}`}
      description={`Harga jual USD semua layanan di grup ini diubah sekaligus, lalu dikonversi ke Rupiah dengan kurs ${formatRupiah(usdRate)} per $1. Harga khusus per grup user atau per user tidak ikut berubah.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            onClick={() => void apply()}
            disabled={!ready || Boolean(tooLow) || unpriced.length > 0}
            loading={busy}
            loadingLabel="Menerapkan"
          >
            Terapkan ke {members.length} layanan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Perubahan" htmlFor="adjust-direction">
            <Select
              id="adjust-direction"
              value={direction}
              onValueChange={(v) => setDirection(v as PriceAdjustment["direction"])}
              options={[
                { value: "increase", label: "Naikkan harga (+)" },
                { value: "decrease", label: "Turunkan harga (−)" },
              ]}
            />
          </Field>
          <Field label="Berdasarkan" htmlFor="adjust-mode">
            <Select
              id="adjust-mode"
              value={mode}
              onValueChange={(v) => {
                setMode(v as PriceAdjustment["mode"]);
                setRaw("");
              }}
              options={[
                { value: "amount", label: "Nominal ($)" },
                { value: "percent", label: "Persen (%)" },
              ]}
            />
          </Field>
          <Field
            label={mode === "amount" ? "Nominal (USD)" : "Persen"}
            htmlFor="adjust-value"
            required
            error={invalid}
            hint={
              mode === "amount" && entered > 0 && !invalid
                ? `≈ ${formatRupiah(usdCentsToIdr(adjustment.value, usdRate))} per layanan`
                : undefined
            }
          >
            <div className="relative">
              {mode === "amount" ? (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body text-ink-soft">
                  $
                </span>
              ) : null}
              <Input
                id="adjust-value"
                inputMode="decimal"
                className={cn("font-data tabular", mode === "amount" ? "pl-7" : "pr-10")}
                placeholder={mode === "amount" ? "5.00" : "10"}
                value={raw}
                invalid={Boolean(invalid)}
                onChange={(event) => setRaw(sanitizeUsdInput(event.target.value))}
              />
              {mode === "percent" ? (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-body text-ink-soft">
                  %
                </span>
              ) : null}
            </div>
          </Field>
          <Field
            label="Dihitung dari"
            htmlFor="adjust-base"
            hint={missingCost ? "Ada layanan yang harga modalnya masih $0." : undefined}
          >
            <Select
              id="adjust-base"
              value={base}
              onValueChange={(v) => setBase(v as PriceAdjustment["base"])}
              options={[
                { value: "price", label: "Harga jual saat ini" },
                { value: "cost", label: "Harga modal" },
              ]}
            />
          </Field>
          <Field label="Pembulatan" htmlFor="adjust-round">
            <Select
              id="adjust-round"
              value={String(roundTo)}
              onValueChange={(v) => setRoundTo(Number(v) as PriceAdjustment["roundTo"])}
              options={ROUND_OPTIONS}
            />
          </Field>
        </div>

        <div className="overflow-hidden rounded-md border border-hairline">
          <TableScroll className="max-h-72">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Layanan</TH>
                  <TH className="text-right">Modal</TH>
                  <TH className="text-right">Harga sekarang</TH>
                  <TH className="text-right">Harga baru</TH>
                  <TH className="text-right">Untung</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ service, price, cost, next }) => {
                  const margin = (next ?? price) - cost;
                  return (
                    <TR key={service.id}>
                      <TD className="max-w-56 truncate text-body text-ink">{service.name}</TD>
                      <TD className="text-right">
                        {cost > 0 ? (
                          <DataValue className="text-ink-soft">{formatUsd(cost)}</DataValue>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        {service.priceUsdCents == null ? (
                          <span className="text-label text-hold-ink">USD kosong</span>
                        ) : (
                          <DataValue className="text-ink-soft">{formatUsd(price)}</DataValue>
                        )}
                      </TD>
                      <TD className="text-right">
                        {next === null ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          <>
                            <DataValue
                              emphasis
                              className={cn("block", next < 1 ? "text-refused-ink" : undefined)}
                            >
                              {formatUsd(next)}
                            </DataValue>
                            <DataValue className="block text-label text-ink-soft">
                              {formatRupiah(usdCentsToIdr(next, usdRate))}
                            </DataValue>
                          </>
                        )}
                      </TD>
                      <TD className="text-right">
                        {cost > 0 ? (
                          <DataValue className={margin < 0 ? "text-refused-ink" : "text-cleared-ink"}>
                            {formatUsd(margin)}
                          </DataValue>
                        ) : (
                          <span className="text-label text-hold-ink">Modal kosong</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        </div>

        {unpriced.length ? (
          <p className="text-body text-refused-ink">
            {unpriced.length} layanan belum punya harga USD. Isi dulu lewat Edit layanan.
          </p>
        ) : tooLow ? (
          <p className="text-body text-refused-ink">
            Harga {tooLow.service.name} menjadi di bawah $0.01. Kecilkan nilai perubahan.
          </p>
        ) : belowCost > 0 ? (
          <p className="text-body text-hold-ink">
            {belowCost} layanan akan dijual di bawah harga modal.
          </p>
        ) : null}
      </div>
    </DialogContent>
  );
}

/** Super admin sets the USD→IDR rate; saving reprices every Layanan Spesial in Rupiah. */
export function UsdRateCard({
  rate,
  serviceCount,
  onSaved,
}: {
  rate: number;
  serviceCount: number;
  onSaved: (rate: number) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(String(rate));
  const [busy, setBusy] = React.useState(false);
  const next = Number(draft);
  const valid = Number.isInteger(next) && next >= 1_000 && next <= 100_000;
  const dirty = valid && next !== rate;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true);
    try {
      const result = await api<{ rate: number; repriced: number }>("/admin/usd-rate", {
        method: "PATCH",
        body: JSON.stringify({ rate: next }),
      });
      toast.success("Kurs disimpan", {
        description: `$1 = ${formatRupiah(result.rate)} · ${result.repriced} layanan dihitung ulang.`,
      });
      await onSaved(result.rate);
    } catch (err) {
      toast.error("Gagal", { description: err instanceof ApiError ? err.message : "Simpan gagal" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form
        onSubmit={save}
        noValidate
        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <p className="text-title text-ink">Kurs Layanan Spesial</p>
          <p className="mt-1 text-body text-ink-soft">
            Harga Layanan Spesial diisi dalam dolar (USD). Harga Rupiah yang dibayar user dihitung
            dari kurs ini; menyimpan kurs baru menghitung ulang {serviceCount} layanan.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="usd-rate"
              className="whitespace-nowrap font-data tabular text-title text-ink"
            >
              $1 =
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body text-ink-soft">
                Rp
              </span>
              <Input
                id="usd-rate"
                inputMode="numeric"
                className="w-36 pl-10 font-data tabular"
                value={draft}
                invalid={Boolean(draft) && !valid}
                aria-describedby={draft && !valid ? "usd-rate-error" : undefined}
                onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" disabled={!dirty} loading={busy} loadingLabel="Menyimpan">
              Simpan kurs
            </Button>
          </div>
          {draft && !valid ? (
            <p id="usd-rate-error" className="text-label text-refused-ink">
              Kurs harus 1.000–100.000.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
