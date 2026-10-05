"use client";

import * as React from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api";
import {
  formatRupiah,
  formatUsd,
  parseUsdInput,
  sanitizeUsdInput,
  usdCentsToIdr,
} from "@/lib/format";
import { ExtraFieldPicker } from "@/components/domain/extra-field-picker";
import { NO_EXTRA_FIELDS, hasExtraFields, type ExtraFieldFlags } from "@/lib/order-fields";
import { RICH_DESCRIPTION_MAX } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import {
  SERVICE_MENU_LABEL,
  type Service,
  type ServiceMenu,
  type Supplier,
  type SupplierRemoteService,
} from "@/lib/types";

const CODE_MAX = 40;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CODE_MAX)
    .replace(/-+$/g, "");
}

/** First free code for `base`, appending -2, -3, … when taken. */
function uniqueCode(base: string, taken: Set<string>): string {
  const root = base || "layanan";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${root.slice(0, CODE_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Supplier INFO keeps its formatting; the API sanitizes it into the rich-text subset. */
function supplierDescription(info: string, name: string): string {
  const text = info.trim();
  return text && text.length <= RICH_DESCRIPTION_MAX ? text : name.slice(0, 1000);
}

/**
 * "Tambah dari API": lists a supplier's services; ticked ones become local
 * services on the API Supplier route, priced at supplier cost plus markup.
 * Layanan Spesial treat the supplier credit as USD; Order Ceir as Rupiah.
 */
export function SupplierImportPanel({
  formId,
  suppliers,
  existingServices,
  usdRate,
  onBusyChange,
  onSelectionChange,
  onImported,
}: {
  formId: string;
  suppliers: Supplier[];
  existingServices: Service[];
  usdRate: number;
  onBusyChange: (busy: boolean) => void;
  onSelectionChange: (count: number) => void;
  onImported: () => void | Promise<void>;
}) {
  const [supplierId, setSupplierId] = React.useState<string | null>(
    () => (suppliers.find((s) => s.isActive) ?? suppliers[0])?.id ?? null,
  );
  const [loaded, setLoaded] = React.useState<{
    supplierId: string;
    rows: SupplierRemoteService[] | null;
    error: string | null;
  } | null>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [markupText, setMarkupText] = React.useState("");
  const [online, setOnline] = React.useState(true);
  const [menu, setMenu] = React.useState<ServiceMenu>("ceir");
  const [inputType, setInputType] = React.useState<NonNullable<Service["inputType"]>>("imei");
  const [extraFields, setExtraFields] = React.useState<ExtraFieldFlags>(NO_EXTRA_FIELDS);
  const [fieldsError, setFieldsError] = React.useState<string>();

  const current = loaded && loaded.supplierId === supplierId ? loaded : null;
  const rows = current?.rows ?? null;
  const loadError = current?.error ?? null;

  React.useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    api<SupplierRemoteService[]>(`/admin/suppliers/${supplierId}/services`)
      .then((data) => {
        if (!cancelled) setLoaded({ supplierId, rows: data, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded({
            supplierId,
            rows: [],
            error: err instanceof ApiError ? err.message : "Gagal memuat layanan supplier.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  React.useEffect(() => {
    onSelectionChange(selected.size);
  }, [selected, onSelectionChange]);

  const imported = React.useMemo(
    () =>
      new Set(
        existingServices
          .filter((s) => s.supplierId === supplierId && s.supplierServiceId)
          .map((s) => s.supplierServiceId!),
      ),
    [existingServices, supplierId],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!rows) return [];
    if (!needle) return rows;
    return rows.filter(
      (svc) =>
        svc.name.toLowerCase().includes(needle) ||
        svc.group.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const groups = React.useMemo(() => {
    const out: Array<{ name: string; items: SupplierRemoteService[] }> = [];
    for (const svc of filtered) {
      const last = out[out.length - 1];
      if (last && last.name === svc.group) last.items.push(svc);
      else out.push({ name: svc.group, items: [svc] });
    }
    return out;
  }, [filtered]);

  const selectable = filtered.filter((svc) => !imported.has(svc.id));
  const allSelected = selectable.length > 0 && selectable.every((svc) => selected.has(svc.id));

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
      for (const svc of selectable) {
        if (checked) next.add(svc.id);
        else next.delete(svc.id);
      }
      return next;
    });
  }

  const usd = menu === "special";
  const markup = usd ? (parseUsdInput(markupText) ?? 0) : Number(markupText) || 0;
  /** Rupiah for Order Ceir, USD cents for Layanan Spesial. */
  const costFor = (svc: SupplierRemoteService) =>
    usd ? Math.round(svc.credit * 100) : Math.round(svc.credit);
  const priceFor = (svc: SupplierRemoteService) => Math.max(1, costFor(svc) + markup);
  const money = (amount: number) => (usd ? formatUsd(amount) : formatRupiah(amount));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supplierId || !rows || selected.size === 0) return;
    if (usd && inputType === "none" && !hasExtraFields(extraFields)) {
      setFieldsError("Tanpa IMEI/SN/ECID, centang minimal satu field: Qnt, Email, Username, atau Notes.");
      return;
    }
    const picks = rows.filter((svc) => selected.has(svc.id) && !imported.has(svc.id));
    const taken = new Set(existingServices.map((s) => s.code ?? "").filter(Boolean));
    onBusyChange(true);
    const failed: string[] = [];
    let created = 0;
    for (const svc of picks) {
      const code = uniqueCode(slugify(svc.name), taken);
      taken.add(code);
      try {
        await api("/admin/services", {
          method: "POST",
          body: JSON.stringify({
            code,
            name: svc.name.slice(0, 120),
            description: supplierDescription(svc.info ?? "", svc.name),
            ...(usd
              ? { priceUsd: priceFor(svc) / 100, costPriceUsd: costFor(svc) / 100 }
              : { price: priceFor(svc), costPrice: costFor(svc) }),
            estimate: (svc.time || "Sesuai supplier").slice(0, 60),
            active: online,
            fulfillmentChannel: "supplier",
            assignedAdminIds: [],
            supplierId,
            supplierServiceId: svc.id,
            menu,
            ...(usd ? { inputType, ...extraFields } : { inputType: "imei" }),
          }),
        });
        created++;
      } catch (err) {
        failed.push(`${svc.name}: ${err instanceof ApiError ? err.message : "gagal"}`);
      }
    }
    onBusyChange(false);
    if (created) {
      toast.success(`${created} layanan ditambahkan ke ${SERVICE_MENU_LABEL[menu]}`, {
        description: failed.length ? `${failed.length} gagal. ${failed[0]}` : undefined,
      });
      await onImported();
    } else {
      toast.error("Tidak ada layanan yang ditambahkan", { description: failed[0] });
    }
  }

  if (suppliers.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-body text-ink-soft">
        Belum ada supplier.{" "}
        <Link href="/admin/suppliers" className="font-bold text-action hover:underline">
          Tambahkan di Supplier API
        </Link>{" "}
        terlebih dahulu.
      </p>
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Supplier" htmlFor="import-supplier">
          <Select
            id="import-supplier"
            value={supplierId ?? undefined}
            placeholder="Pilih supplier"
            onValueChange={(value) => {
              setSupplierId(value);
              setSelected(new Set());
            }}
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.isActive ? s.name : `${s.name} (nonaktif)`,
            }))}
          />
        </Field>
        <Field
          label={usd ? "Markup per order ($)" : "Markup per order"}
          htmlFor="import-markup"
          hint={
            usd && markup > 0
              ? `≈ ${formatRupiah(usdCentsToIdr(markup, usdRate))}`
              : "Ditambahkan ke harga supplier."
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body text-ink-soft">
              {usd ? "$" : "Rp"}
            </span>
            <Input
              id="import-markup"
              inputMode={usd ? "decimal" : "numeric"}
              className={cn("font-data tabular", usd ? "pl-7" : "pl-10")}
              placeholder={usd ? "0.00" : "0"}
              value={markupText}
              onChange={(event) =>
                setMarkupText(
                  usd
                    ? sanitizeUsdInput(event.target.value)
                    : event.target.value.replace(/\D/g, ""),
                )
              }
            />
          </div>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Tampilkan di menu"
          htmlFor="import-menu"
          hint={
            menu === "ceir"
              ? "User memesan lewat menu Order Ceir. Harga supplier dibaca sebagai Rupiah."
              : `Harga supplier dibaca sebagai dolar (USD), kurs ${formatRupiah(usdRate)} per $1.`
          }
        >
          <Select
            id="import-menu"
            value={menu}
            onValueChange={(value) => {
              setMenu(value as ServiceMenu);
              setMarkupText("");
            }}
            options={[
              { value: "ceir", label: SERVICE_MENU_LABEL.ceir },
              { value: "special", label: SERVICE_MENU_LABEL.special },
            ]}
          />
        </Field>
        {menu === "special" ? (
          <Field
            label="Field yang diisi user"
            htmlFor="import-input-type"
            hint="Berlaku untuk semua layanan yang dipilih."
          >
            <Select
              id="import-input-type"
              value={inputType}
              onValueChange={(value) => {
                setInputType(value as NonNullable<Service["inputType"]>);
                setFieldsError(undefined);
              }}
              options={[
                { value: "imei", label: "IMEI (15 digit)" },
                { value: "sn", label: "SN (Serial Number)" },
                { value: "ecid", label: "ECID" },
                { value: "imei_sn", label: "IMEI/SN (user pilih salah satu)" },
                { value: "none", label: "Tidak ada (tanpa IMEI/SN/ECID)" },
              ]}
            />
          </Field>
        ) : null}
      </div>

      {menu === "special" ? (
        <ExtraFieldPicker
          value={extraFields}
          error={fieldsError}
          hint="Centang field yang wajib diisi user saat order; ikut dikirim ke supplier (QNT, EMAIL, USERNAME, PASSWORD, NOTES). Berlaku untuk semua layanan yang dipilih."
          onToggle={(key, checked) => {
            setExtraFields((current) => ({ ...current, [key]: checked }));
            setFieldsError(undefined);
          }}
        />
      ) : null}

      <label className="relative block">
        <span className="sr-only">Cari layanan supplier</span>
        <MagnifyingGlass
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama atau grup layanan"
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
              disabled={selectable.length === 0}
              onChange={(event) => toggleAll(event.target.checked)}
            />
            Pilih semua
          </label>
          <span className="font-data text-label text-ink-soft">
            {rows === null ? "Memuat…" : `${selected.size} dipilih · ${rows.length} layanan`}
          </span>
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {rows === null ? (
            <p className="px-3.5 py-6 text-center text-body text-ink-soft">Memuat daftar layanan supplier…</p>
          ) : loadError ? (
            <p className="px-3.5 py-6 text-center text-body text-refused-ink">{loadError}</p>
          ) : rows.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-body text-ink-soft">
              Supplier belum membuka layanan apa pun.
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-body text-ink-soft">Tidak ada layanan yang cocok.</p>
          ) : (
            groups.map((group) => (
              <div key={group.name}>
                <p className="sticky top-0 z-10 border-b border-hairline bg-surface px-3.5 py-1.5 text-label font-bold uppercase tracking-wide text-ink-soft">
                  {group.name}
                </p>
                <ul className="divide-y divide-hairline">
                  {group.items.map((svc) => {
                    const done = imported.has(svc.id);
                    const checked = selected.has(svc.id);
                    return (
                      <li key={svc.id}>
                        <label
                          className={cn(
                            "flex items-start gap-3 px-3.5 py-2.5",
                            done ? "cursor-default opacity-60" : "cursor-pointer hover:bg-mist",
                            checked && "bg-action-wash/60",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 rounded-sm accent-action"
                            checked={checked || done}
                            disabled={done}
                            onChange={(event) => toggle(svc.id, event.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-body font-medium text-ink">{svc.name}</span>
                            {svc.time ? (
                              <span className="block text-label text-ink-faint">{svc.time}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right">
                            {done ? (
                              <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                                Sudah ditambahkan
                              </Tag>
                            ) : (
                              <>
                                <span className="block font-data text-body font-bold text-ink">
                                  {money(priceFor(svc))}
                                </span>
                                <span className="block font-data text-label text-ink-faint">
                                  {usd
                                    ? `≈ ${formatRupiah(usdCentsToIdr(priceFor(svc), usdRate))} · modal ${money(costFor(svc))}`
                                    : `Modal ${money(costFor(svc))}`}
                                </span>
                              </>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3.5 py-2.5">
        <div>
          <p className="text-body font-medium text-ink">Langsung online</p>
          <p className="text-label text-ink-soft">
            Matikan jika ingin mengecek nama & harga dulu sebelum tampil ke user.
          </p>
        </div>
        <Switch checked={online} onCheckedChange={setOnline} ariaLabel="Langsung online" />
      </div>
    </form>
  );
}
