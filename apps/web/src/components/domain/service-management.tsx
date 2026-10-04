"use client";

import * as React from "react";
import { MagnifyingGlass, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Select, type SelectOption } from "@/components/ui/select";
import { Tag } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { ServiceGroupPanel, UsdRateCard } from "@/components/domain/service-group-panel";
import { SupplierImportPanel } from "@/components/domain/supplier-import-panel";
import { ExtraFieldPicker } from "@/components/domain/extra-field-picker";
import { NO_EXTRA_FIELDS, hasExtraFields } from "@/lib/order-fields";
import {
  formatRupiah,
  formatUsd,
  parseUsdInput,
  sanitizeUsdInput,
  usdCentsToIdr,
} from "@/lib/format";
import { ApiError, api } from "@/lib/api";
import { RICH_DESCRIPTION_MAX, descriptionToPlain, isBlankRichText } from "@/lib/rich-text";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import {
  SERVICE_MENU_LABEL,
  type Admin,
  type FulfillmentChannel,
  type Service,
  type ServiceAssignee,
  type ServiceGroup,
  type ServiceMenu,
  type Supplier,
  type SupplierRemoteService,
} from "@/lib/types";

const CHANNEL_LABEL: Record<FulfillmentChannel, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  supplier: "API Supplier",
};

type ServiceDraft = Service & { assignedAdminIds: string[] };

function toDraft(service: Service): ServiceDraft {
  return {
    ...service,
    assignedAdminIds: (service.assignedAdmins ?? []).map((admin) => admin.id),
  };
}

export function ServiceManagement({
  initialServices,
  initialGroups,
  initialUsdRate,
  operators,
  suppliers,
}: {
  initialServices: Service[];
  initialGroups: ServiceGroup[];
  initialUsdRate: number;
  operators: Admin[];
  suppliers: Supplier[];
}) {
  const [services, setServices] = React.useState(initialServices);
  const [groups, setGroups] = React.useState(initialGroups);
  const [usdRate, setUsdRate] = React.useState(initialUsdRate);
  const [query, setQuery] = React.useState("");
  const [supplierFilter, setSupplierFilter] = React.useState("all");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [listTab, setListTab] = React.useState<CreateTab>("manual");
  const [editing, setEditing] = React.useState<ServiceDraft | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Service | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [syncedServices, setSyncedServices] = React.useState(initialServices);
  if (initialServices !== syncedServices) {
    setSyncedServices(initialServices);
    setServices(initialServices);
  }

  const apiServices = React.useMemo(
    () => services.filter((service) => service.fulfillmentChannel === "supplier"),
    [services],
  );
  const manualServices = React.useMemo(
    () => services.filter((service) => service.fulfillmentChannel !== "supplier"),
    [services],
  );
  const specialServices = React.useMemo(
    () => apiServices.filter((service) => service.menu === "special"),
    [apiServices],
  );
  const tabServices = listTab === "api" ? apiServices : manualServices;

  const supplierOptions = React.useMemo<SelectOption[]>(() => {
    const counts = new Map<string, number>();
    for (const service of apiServices) {
      if (service.supplierId) counts.set(service.supplierId, (counts.get(service.supplierId) ?? 0) + 1);
    }
    return [
      { value: "all", label: "Semua supplier" },
      ...suppliers
        .filter((supplier) => counts.has(supplier.id))
        .map((supplier) => ({
          value: supplier.id,
          label: `${supplier.name} (${counts.get(supplier.id)})`,
        })),
    ];
  }, [apiServices, suppliers]);
  const activeSupplier =
    listTab === "api" && supplierOptions.some((o) => o.value === supplierFilter)
      ? supplierFilter
      : "all";

  const groupOptions = React.useMemo<SelectOption[]>(() => {
    const counts = new Map<string, number>();
    let ungrouped = 0;
    for (const service of specialServices) {
      if (service.serviceGroupId) {
        counts.set(service.serviceGroupId, (counts.get(service.serviceGroupId) ?? 0) + 1);
      } else {
        ungrouped += 1;
      }
    }
    return [
      { value: "all", label: "Semua grup" },
      ...groups
        .filter((group) => counts.has(group.id))
        .map((group) => ({ value: group.id, label: `${group.name} (${counts.get(group.id)})` })),
      ...(ungrouped ? [{ value: "none", label: `Tanpa grup (${ungrouped})` }] : []),
    ];
  }, [specialServices, groups]);
  const activeGroup =
    listTab === "api" && groupOptions.some((o) => o.value === groupFilter) ? groupFilter : "all";

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tabServices.filter((service) => {
      if (activeSupplier !== "all" && service.supplierId !== activeSupplier) return false;
      if (activeGroup === "none") {
        if (service.menu !== "special" || service.serviceGroupId) return false;
      } else if (activeGroup !== "all" && service.serviceGroupId !== activeGroup) {
        return false;
      }
      if (!needle) return true;
      return (
        service.name.toLowerCase().includes(needle) ||
        descriptionToPlain(service.description).toLowerCase().includes(needle) ||
        (service.code ?? "").toLowerCase().includes(needle)
      );
    });
  }, [tabServices, query, activeSupplier, activeGroup]);

  async function reload() {
    const [nextServices, nextGroups] = await Promise.all([
      api<Service[]>("/admin/services"),
      api<ServiceGroup[]>("/admin/service-groups"),
    ]);
    setServices(nextServices);
    setGroups(nextGroups);
  }

  async function handleSave(next: ServiceDraft) {
    try {
      if (creating) {
        await api("/admin/services", {
          method: "POST",
          body: JSON.stringify({
            name: next.name,
            description: next.description,
            price: next.price,
            costPrice: next.costPrice ?? 0,
            estimate: next.estimate,
            active: next.active,
            fulfillmentChannel: next.fulfillmentChannel ?? "telegram",
            assignedAdminIds: next.assignedAdminIds,
            supplierId: next.supplierId ?? null,
            supplierServiceId: next.supplierServiceId ?? null,
            menu: next.menu ?? "ceir",
            inputType: next.inputType ?? "imei",
            requireQnt: next.requireQnt ?? false,
            requireEmail: next.requireEmail ?? false,
            requireUsername: next.requireUsername ?? false,
            requireNotes: next.requireNotes ?? false,
            requirePassword: next.requirePassword ?? false,
            ...(next.priceUsdCents != null
              ? {
                  priceUsd: next.priceUsdCents / 100,
                  costPriceUsd: (next.costUsdCents ?? 0) / 100,
                }
              : {}),
          }),
        });
      } else {
        await api(`/admin/services/${next.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: next.name,
            description: next.description,
            price: next.price,
            costPrice: next.costPrice ?? 0,
            estimate: next.estimate,
            active: next.active,
            fulfillmentChannel: next.fulfillmentChannel ?? "telegram",
            assignedAdminIds: next.assignedAdminIds,
            supplierId: next.supplierId ?? null,
            supplierServiceId: next.supplierServiceId ?? null,
            menu: next.menu ?? "ceir",
            inputType: next.inputType ?? "imei",
            requireQnt: next.requireQnt ?? false,
            requireEmail: next.requireEmail ?? false,
            requireUsername: next.requireUsername ?? false,
            requireNotes: next.requireNotes ?? false,
            requirePassword: next.requirePassword ?? false,
            ...(next.priceUsdCents != null
              ? {
                  priceUsd: next.priceUsdCents / 100,
                  costPriceUsd: (next.costUsdCents ?? 0) / 100,
                }
              : {}),
          }),
        });
      }
      await reload();
      setEditing(null);
      setCreating(false);
      toast.success(creating ? "Layanan ditambahkan" : "Perubahan disimpan");
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
    }
  }

  async function handleToggle(service: Service) {
    const next = !service.active;
    setTogglingId(service.id);
    setServices((current) =>
      current.map((s) => (s.id === service.id ? { ...s, active: next } : s)),
    );
    try {
      await api(`/admin/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: next }),
      });
      await reload();
      toast.success(next ? "Layanan online" : "Layanan offline", {
        description: next
          ? `${service.name} bisa dipesan user lagi.`
          : `${service.name} disembunyikan dari menu order web & bot.`,
      });
    } catch (err) {
      setServices((current) =>
        current.map((s) =>
          s.id === service.id ? { ...s, active: service.active } : s,
        ),
      );
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Update gagal",
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(service: Service) {
    setDeleteBusy(true);
    try {
      await api(`/admin/services/${service.id}`, { method: "DELETE" });
      await reload();
      setDeleting(null);
      toast.success("Layanan dihapus", { description: service.name });
    } catch (err) {
      toast.error("Gagal menghapus", {
        description: err instanceof ApiError ? err.message : "Hapus gagal",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  function openCreate() {
    setCreating(true);
    setEditing({
      id: `svc-${Date.now()}`,
      code: "",
      name: "",
      description: "",
      price: 150_000,
      costPrice: 0,
      estimate: "1–3 jam",
      active: true,
      fulfillmentChannel: "telegram",
      assignedAdminIds: [],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          label="Jenis layanan"
          value={listTab}
          onChange={setListTab}
          className="sm:w-96"
          tabs={[
            { id: "manual", label: "Service manual", count: manualServices.length },
            { id: "api", label: "Service API", count: apiServices.length },
          ]}
        />
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Tambah Layanan
        </Button>
      </div>

      {listTab === "api" ? (
        <>
          <UsdRateCard
            key={usdRate}
            rate={usdRate}
            serviceCount={specialServices.length}
            onSaved={async (rate) => {
              setUsdRate(rate);
              await reload();
            }}
          />
          <ServiceGroupPanel
            groups={groups}
            services={specialServices}
            usdRate={usdRate}
            onChanged={reload}
          />
        </>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari layanan</span>
          <MagnifyingGlass
            aria-hidden="true"
            weight="regular"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau deskripsi layanan"
            className="pl-9"
          />
        </label>
        {listTab === "api" ? (
          <>
            <Select
              ariaLabel="Filter Supplier API"
              value={activeSupplier}
              onValueChange={setSupplierFilter}
              options={supplierOptions}
              className="sm:w-64"
            />
            <Select
              ariaLabel="Filter Grup Layanan Spesial"
              value={activeGroup}
              onValueChange={setGroupFilter}
              options={groupOptions}
              className="sm:w-64"
            />
          </>
        ) : null}
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Layanan</TH>
                    <TH>Harga</TH>
                    <TH>Estimasi</TH>
                    <TH>Jalur</TH>
                    <TH>Assign</TH>
                    <TH>Status</TH>
                    <TH className="w-28">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((service) => (
                    <TR key={service.id}>
                      <TD>
                        <div className="max-w-md">
                          <p className="font-medium text-ink">{service.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-body text-ink-soft">
                            {descriptionToPlain(service.description)}
                          </p>
                        </div>
                      </TD>
                      <TD>
                        {service.priceUsdCents != null ? (
                          <DataValue emphasis className="block">
                            {formatUsd(service.priceUsdCents)}
                          </DataValue>
                        ) : null}
                        <DataValue
                          emphasis={service.priceUsdCents == null}
                          className={service.priceUsdCents != null ? "text-ink-soft" : undefined}
                        >
                          {formatRupiah(service.price)}
                        </DataValue>
                        <p className="mt-0.5 whitespace-nowrap text-label text-ink-soft">
                          {service.costPrice ? (
                            <>
                              Modal {formatRupiah(service.costPrice)} ·{" "}
                              <span
                                className={
                                  service.price - service.costPrice < 0
                                    ? "text-refused-ink"
                                    : "text-cleared-ink"
                                }
                              >
                                Untung {formatRupiah(service.price - service.costPrice)}
                              </span>
                            </>
                          ) : (
                            <span className="text-hold-ink">Modal belum diisi</span>
                          )}
                        </p>
                      </TD>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {service.estimate}
                        </DataValue>
                      </TD>
                      <TD>
                        <Tag className="border-hairline bg-mist text-ink">
                          {CHANNEL_LABEL[service.fulfillmentChannel ?? "telegram"]}
                        </Tag>
                        {service.fulfillmentChannel === "supplier" ? (
                          <p className="mt-1 whitespace-nowrap text-label text-ink-soft">
                            Menu {SERVICE_MENU_LABEL[service.menu ?? "ceir"]}
                            {service.serviceGroupName ? ` · ${service.serviceGroupName}` : ""}
                          </p>
                        ) : null}
                      </TD>
                      <TD>
                        {service.fulfillmentChannel === "whatsapp" ? (
                          <span className="text-body text-ink-soft">
                            Grup WA (Roamercheck)
                          </span>
                        ) : service.fulfillmentChannel === "supplier" ? (
                          <span className="text-body text-ink-soft">
                            {service.supplierName ?? "Supplier"}
                          </span>
                        ) : (
                          <AssigneeList assignees={service.assignedAdmins ?? []} />
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={service.active}
                            disabled={togglingId === service.id}
                            onCheckedChange={() => void handleToggle(service)}
                            ariaLabel={`${service.name}: ${service.active ? "online" : "offline"}`}
                          />
                          <span
                            className={
                              service.active
                                ? "text-body font-medium text-cleared-ink"
                                : "text-body font-medium text-ink-soft"
                            }
                          >
                            {service.active ? "Online" : "Offline"}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${service.name}`}
                            onClick={() => {
                              setCreating(false);
                              setEditing(toDraft(service));
                            }}
                          >
                            <PencilSimple className="size-4 text-action" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Hapus ${service.name}`}
                            onClick={() => setDeleting(service)}
                          >
                            <Trash className="size-4 text-refused-ink" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <p className="border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              Menampilkan {filtered.length} dari {tabServices.length} layanan
            </p>
          </>
        ) : (
          <EmptyState
            title={
              tabServices.length === 0
                ? listTab === "api"
                  ? "Belum ada service API"
                  : "Belum ada service manual"
                : "Tidak ada layanan yang cocok"
            }
            description={
              tabServices.length === 0
                ? listTab === "api"
                  ? "Tambahkan layanan dari daftar Supplier API agar order diteruskan otomatis."
                  : "Tambahkan layanan yang diproses operator lewat Telegram atau WhatsApp."
                : "Coba ubah kata kunci pencarian atau filter supplier."
            }
            action={
              tabServices.length === 0 ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" aria-hidden="true" />
                  Tambah Layanan
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setQuery("")}>
                  Reset pencarian
                </Button>
              )
            }
          />
        )}
      </Card>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        {editing ? (
          <ServiceFormDialog
            service={editing}
            operators={operators}
            suppliers={suppliers}
            creating={creating}
            initialTab={listTab}
            existingServices={services}
            usdRate={usdRate}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={handleSave}
            onImported={async () => {
              await reload();
              setEditing(null);
              setCreating(false);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <DialogContent
            title={`Hapus ${deleting.name}?`}
            description="Layanan yang sudah punya order tidak bisa dihapus agar riwayat order tetap utuh. Matikan (offline) saja jika hanya ingin menyembunyikannya."
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
                  Hapus layanan
                </Button>
              </>
            }
          >
            <p className="text-body text-ink-soft">Tindakan ini tidak bisa dibatalkan.</p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function AssigneeList({ assignees }: { assignees: ServiceAssignee[] }) {
  if (!assignees.length) {
    return (
      <span className="text-body text-working-ink">
        Belum di-assign
      </span>
    );
  }
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {assignees.map((admin) => (
        <Tag
          key={admin.id}
          className={
            admin.active
              ? "border-hairline bg-mist text-ink"
              : "border-void-edge bg-void-wash text-void-ink line-through"
          }
        >
          {admin.fullName}
        </Tag>
      ))}
    </div>
  );
}

function OperatorPicker({
  operators,
  selected,
  onChange,
}: {
  operators: Admin[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string, checked: boolean) {
    onChange(
      checked
        ? [...selected, id]
        : selected.filter((selectedId) => selectedId !== id),
    );
  }

  const superAdminIds = new Set(
    operators.filter((admin) => admin.role === "super_admin").map((admin) => admin.id),
  );
  const pickedOperators = selected.filter((id) => !superAdminIds.has(id)).length;
  const pickedSuperAdmin = selected.some((id) => superAdminIds.has(id));

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-body font-medium text-ink">
        Assign admin
      </legend>
      {operators.length ? (
        <div className="max-h-48 divide-y divide-hairline overflow-y-auto rounded-md border border-hairline">
          {operators.map((operator) => (
            <label
              key={operator.id}
              className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-mist"
            >
              <input
                type="checkbox"
                checked={selected.includes(operator.id)}
                onChange={(event) => toggle(operator.id, event.target.checked)}
                className="size-4 rounded-sm border-hairline accent-action"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">
                  {operator.fullName}
                </span>
                <span className="block truncate font-data text-label text-ink-soft">
                  @{operator.username}
                  {operator.telegramHandle ? ` · ${operator.telegramHandle}` : " · Telegram belum tertaut"}
                </span>
              </span>
              {operator.role === "super_admin" ? (
                <Tag className="border-action/15 bg-action-wash text-action">Super Admin</Tag>
              ) : null}
              {!operator.active ? (
                <Tag className="border-void-edge bg-void-wash text-void-ink">
                  Diblokir
                </Tag>
              ) : null}
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-body text-ink-soft">
          Belum ada akun operator. Tambahkan di halaman Admins.
        </p>
      )}
      <p className="text-body text-ink-soft">
        {pickedOperators
          ? `${pickedOperators} operator akan menerima dan memproses order layanan ini${
              pickedSuperAdmin ? ", bersama Super Admin" : ""
            }.`
          : pickedSuperAdmin
            ? "Order layanan ini hanya masuk ke Super Admin; operator tidak menerimanya."
            : "Tanpa assign, order layanan ini hanya terlihat oleh Super Admin."}
      </p>
    </fieldset>
  );
}

type CreateTab = "manual" | "api";

function SegmentedTabs({
  label,
  value,
  onChange,
  tabs,
  className,
}: {
  label: string;
  value: CreateTab;
  onChange: (tab: CreateTab) => void;
  tabs: Array<{ id: CreateTab; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("grid grid-cols-2 gap-1 rounded-lg bg-mist p-1", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-md text-body font-bold transition-[background-color,color,box-shadow] duration-150 ease-out-strong",
            value === tab.id
              ? "bg-surface text-ink shadow-resting"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 font-data text-label tabular",
                value === tab.id ? "bg-action-wash text-action" : "bg-surface/70 text-ink-soft",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ServiceFormDialog({
  service,
  operators,
  suppliers,
  creating,
  initialTab,
  existingServices,
  usdRate,
  onCancel,
  onSave,
  onImported,
}: {
  service: ServiceDraft;
  operators: Admin[];
  suppliers: Supplier[];
  creating: boolean;
  initialTab: CreateTab;
  existingServices: Service[];
  usdRate: number;
  onCancel: () => void;
  onSave: (service: ServiceDraft) => void | Promise<void>;
  onImported: () => void | Promise<void>;
}) {
  const [tab, setTab] = React.useState<CreateTab>(initialTab);
  const [importBusy, setImportBusy] = React.useState(false);
  const [importCount, setImportCount] = React.useState(0);
  const [draft, setDraft] = React.useState(() => {
    const operatorIds = new Set(operators.map((operator) => operator.id));
    return {
      ...service,
      assignedAdminIds: service.assignedAdminIds.filter((id) =>
        operatorIds.has(id),
      ),
    };
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    name?: string;
    price?: string;
    costPrice?: string;
    estimate?: string;
    supplier?: string;
    fields?: string;
    description?: string;
  }>({});
  const costPrice = draft.costPrice ?? 0;
  const margin = draft.price - costPrice;
  const special = draft.fulfillmentChannel === "supplier" && draft.menu === "special";
  const [usdText, setUsdText] = React.useState(() => ({
    price: service.priceUsdCents != null ? (service.priceUsdCents / 100).toFixed(2) : "",
    cost: service.costUsdCents != null ? (service.costUsdCents / 100).toFixed(2) : "",
  }));
  const priceUsdCents = parseUsdInput(usdText.price);
  const costUsdCents = parseUsdInput(usdText.cost) ?? 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.name.trim()) {
      nextErrors.name = "Masukkan nama layanan.";
    }
    if (special) {
      if (!priceUsdCents) nextErrors.price = "Harga harus lebih dari $0.";
      else if (costUsdCents > priceUsdCents) {
        nextErrors.costPrice = "Harga modal melebihi harga jual.";
      }
    } else {
      if (!draft.price || draft.price < 1) {
        nextErrors.price = "Harga harus lebih dari Rp0.";
      }
      if (costPrice > draft.price) {
        nextErrors.costPrice = "Harga modal melebihi harga jual.";
      }
    }
    if (
      draft.fulfillmentChannel === "supplier" &&
      (!draft.supplierId || !draft.supplierServiceId)
    ) {
      nextErrors.supplier = "Pilih supplier dan layanan supplier.";
    }
    if (!draft.estimate.trim()) {
      nextErrors.estimate = "Masukkan estimasi pengerjaan.";
    }
    if (draft.description.length > RICH_DESCRIPTION_MAX) {
      nextErrors.description = "Deskripsi terlalu panjang. Kurangi teks atau gambar dari URL luar.";
    }
    if (special && draft.inputType === "none" && !hasExtraFields(draft)) {
      nextErrors.fields =
        "Tanpa IMEI/SN/ECID, centang minimal satu field: Qnt, Email, Username, atau Notes.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        ...draft,
        priceUsdCents: special ? priceUsdCents : null,
        costUsdCents: special ? costUsdCents : null,
        name: draft.name.trim(),
        description: isBlankRichText(draft.description) ? "" : draft.description.trim(),
        estimate: draft.estimate.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  const importing = creating && tab === "api";

  return (
    <DialogContent
      className={
        !importing && draft.fulfillmentChannel === "supplier"
          ? "max-w-3xl"
          : creating
            ? "max-w-2xl"
            : undefined
      }
      title={creating ? "Tambah layanan" : "Edit layanan"}
      description={
        importing
          ? "Pilih layanan dari supplier API. Harga modal diisi dari harga supplier."
          : "Layanan nonaktif tidak muncul saat user membuat order."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          {importing ? (
            <Button
              type="submit"
              form="supplier-import-form"
              disabled={importCount === 0}
              loading={importBusy}
              loadingLabel="Menambahkan"
            >
              {importCount ? `Tambahkan ${importCount} layanan` : "Pilih layanan"}
            </Button>
          ) : (
            <Button
              type="submit"
              form="service-form"
              loading={saving}
              loadingLabel="Menyimpan"
            >
              Simpan
            </Button>
          )}
        </>
      }
    >
      {creating ? (
        <SegmentedTabs
          label="Cara menambah layanan"
          value={tab}
          onChange={setTab}
          className="mb-5"
          tabs={[
            { id: "manual", label: "Tambah manual" },
            { id: "api", label: "Tambah dari API" },
          ]}
        />
      ) : null}
      {importing ? (
        <SupplierImportPanel
          formId="supplier-import-form"
          suppliers={suppliers}
          existingServices={existingServices}
          usdRate={usdRate}
          onBusyChange={setImportBusy}
          onSelectionChange={setImportCount}
          onImported={onImported}
        />
      ) : (
      <form
        id="service-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        <Field label="Nama layanan" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            value={draft.name}
            invalid={Boolean(errors.name)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </Field>
        {draft.fulfillmentChannel === "supplier" ? (
          <Field
            label="Deskripsi"
            htmlFor="description"
            error={errors.description}
            hint="Tampil di halaman order user. Atur judul, font, warna, daftar, tautan, dan gambar."
          >
            <RichTextEditor
              id="description"
              value={draft.description}
              invalid={Boolean(errors.description)}
              placeholder="Jelaskan layanan, syarat, dan apa yang didapat user…"
              onChange={(html) => setDraft((current) => ({ ...current, description: html }))}
            />
          </Field>
        ) : (
          <Field label="Deskripsi" htmlFor="description">
            <Textarea
              id="description"
              value={draft.description}
              placeholder="Jelaskan singkat apa yang didapat user."
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
        )}
        {special ? (
          <UsdPriceFields
            priceText={usdText.price}
            costText={usdText.cost}
            usdRate={usdRate}
            priceError={errors.price}
            costError={errors.costPrice}
            onChange={setUsdText}
          />
        ) : (
          <>
        <Field label="Harga" htmlFor="price" required error={errors.price}>
          <Input
            id="price"
            inputMode="numeric"
            className="font-data tabular"
            value={draft.price || ""}
            invalid={Boolean(errors.price)}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              setDraft((current) => ({
                ...current,
                price: raw ? Number(raw) : 0,
              }));
            }}
          />
        </Field>
        <Field
          label="Harga modal"
          htmlFor="costPrice"
          error={errors.costPrice}
          hint={
            costPrice > 0 && draft.price > 0
              ? `Untung per order ${formatRupiah(margin)} (${Math.round((margin / draft.price) * 100)}% dari harga default). Tidak terlihat oleh user.`
              : "Biaya per order ke penyedia. Dipakai untuk menghitung untung di dashboard; tidak terlihat oleh user."
          }
        >
          <Input
            id="costPrice"
            inputMode="numeric"
            className="font-data tabular"
            value={costPrice || ""}
            placeholder="0"
            invalid={Boolean(errors.costPrice)}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              setDraft((current) => ({
                ...current,
                costPrice: raw ? Number(raw) : 0,
              }));
            }}
          />
        </Field>
          </>
        )}
        <Field
          label="Estimasi pengerjaan"
          htmlFor="estimate"
          required
          error={errors.estimate}
          hint="Contoh: 1–3 jam, 1–2 hari kerja"
        >
          <Input
            id="estimate"
            value={draft.estimate}
            invalid={Boolean(errors.estimate)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                estimate: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Status" htmlFor="active">
          <Select
            id="active"
            value={draft.active ? "active" : "inactive"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                active: value === "active",
              }))
            }
            options={[
              { value: "active", label: "Online" },
              { value: "inactive", label: "Offline" },
            ]}
          />
        </Field>
        <Field label="Jalur proses order" htmlFor="fulfillmentChannel">
          <Select
            id="fulfillmentChannel"
            value={draft.fulfillmentChannel ?? "telegram"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                fulfillmentChannel: value as FulfillmentChannel,
              }))
            }
            options={[
              { value: "telegram", label: "Telegram (operator)" },
              { value: "whatsapp", label: "WhatsApp (Roamercheck)" },
              { value: "supplier", label: "API Supplier (otomatis)" },
            ]}
          />
        </Field>
        {draft.fulfillmentChannel === "supplier" ? (
          <SupplierPicker
            suppliers={suppliers}
            supplierId={draft.supplierId ?? null}
            supplierServiceId={draft.supplierServiceId ?? null}
            usd={special}
            error={errors.supplier}
            onChange={(next) => {
              setDraft((current) => ({
                ...current,
                supplierId: next.supplierId,
                supplierServiceId: next.supplierServiceId,
                ...(next.credit !== undefined && !special
                  ? { costPrice: Math.round(next.credit) }
                  : {}),
              }));
              if (next.credit !== undefined && special) {
                setUsdText((current) => ({ ...current, cost: next.credit!.toFixed(2) }));
              }
            }}
          />
        ) : null}
        {draft.fulfillmentChannel === "supplier" ? (
          <Field
            label="Tampilkan di menu"
            htmlFor="menu"
            hint="Menu user tempat layanan ini bisa dipesan."
          >
            <Select
              id="menu"
              value={draft.menu ?? "ceir"}
              onValueChange={(value) =>
              {
                setDraft((current) => ({
                  ...current,
                  menu: value as ServiceMenu,
                  ...(value === "ceir" ? { inputType: "imei" as const, ...NO_EXTRA_FIELDS } : {}),
                }));
                if (value === "special" && !usdText.price && draft.price > 0) {
                  setUsdText({
                    price: (draft.price / usdRate).toFixed(2),
                    cost: costPrice > 0 ? (costPrice / usdRate).toFixed(2) : "",
                  });
                }
              }
              }
              options={[
                { value: "ceir", label: SERVICE_MENU_LABEL.ceir },
                { value: "special", label: SERVICE_MENU_LABEL.special },
              ]}
            />
          </Field>
        ) : null}
        {draft.fulfillmentChannel === "supplier" && draft.menu === "special" ? (
          <>
            <Field
              label="Field yang diisi user"
              htmlFor="inputType"
              hint="Khusus Layanan Spesial. Data perangkat yang diisi user saat order."
            >
              <Select
                id="inputType"
                value={draft.inputType ?? "imei"}
                onValueChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    inputType: value as NonNullable<Service["inputType"]>,
                  }));
                  setErrors((current) => ({ ...current, fields: undefined }));
                }}
                options={[
                  { value: "imei", label: "IMEI (15 digit)" },
                  { value: "sn", label: "SN (Serial Number)" },
                  { value: "ecid", label: "ECID" },
                  { value: "none", label: "Tidak ada (tanpa IMEI/SN/ECID)" },
                ]}
              />
            </Field>
            <ExtraFieldPicker
              value={draft}
              error={errors.fields}
              onToggle={(key, checked) => {
                setDraft((current) => ({ ...current, [key]: checked }));
                setErrors((current) => ({ ...current, fields: undefined }));
              }}
            />
          </>
        ) : null}
        {draft.fulfillmentChannel === "telegram" ||
        !draft.fulfillmentChannel ? (
          <OperatorPicker
            operators={operators}
            selected={draft.assignedAdminIds}
            onChange={(assignedAdminIds) =>
              setDraft((current) => ({ ...current, assignedAdminIds }))
            }
          />
        ) : null}
      </form>
      )}
    </DialogContent>
  );
}

function SupplierPicker({
  suppliers,
  supplierId,
  supplierServiceId,
  usd,
  error,
  onChange,
}: {
  suppliers: Supplier[];
  supplierId: string | null;
  supplierServiceId: string | null;
  /** Layanan Spesial: the supplier credit is in USD. */
  usd: boolean;
  error?: string;
  onChange: (next: {
    supplierId: string | null;
    supplierServiceId: string | null;
    credit?: number;
  }) => void;
}) {
  const [loaded, setLoaded] = React.useState<{
    supplierId: string;
    rows: SupplierRemoteService[] | null;
    error: string | null;
  } | null>(null);
  const current = loaded && loaded.supplierId === supplierId ? loaded : null;
  const remote = current?.rows ?? null;
  const loadError = current?.error ?? null;

  React.useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    api<SupplierRemoteService[]>(`/admin/suppliers/${supplierId}/services`)
      .then((rows) => {
        if (!cancelled) setLoaded({ supplierId, rows, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            supplierId,
            rows: null,
            error: err instanceof ApiError ? err.message : "Gagal memuat layanan supplier.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (suppliers.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-body text-ink-soft">
        Belum ada supplier. Tambahkan di halaman Supplier API.
      </p>
    );
  }

  const selected = remote?.find((svc) => svc.id === supplierServiceId);
  const options: SelectOption[] = (remote ?? []).map((svc) => ({
    value: svc.id,
    label: `${svc.name} — ${
      usd ? formatUsd(Math.round(svc.credit * 100)) : formatRupiah(Math.round(svc.credit))
    }`,
    group: svc.group,
  }));
  if (supplierServiceId && !selected) {
    options.unshift({ value: supplierServiceId, label: "Layanan tidak tersedia lagi di supplier" });
  }

  return (
    <div className="space-y-4 rounded-md border border-hairline bg-mist/40 p-3.5">
      <Field label="Supplier" htmlFor="supplierId" error={error}>
        <Select
          id="supplierId"
          value={supplierId ?? undefined}
          placeholder="Pilih supplier"
          invalid={Boolean(error) && !supplierId}
          onValueChange={(value) => onChange({ supplierId: value, supplierServiceId: null })}
          options={suppliers.map((supplier) => ({
            value: supplier.id,
            label: supplier.isActive ? supplier.name : `${supplier.name} (nonaktif)`,
          }))}
        />
      </Field>
      {supplierId ? (
        <Field
          label="Layanan di supplier"
          htmlFor="supplierServiceId"
          hint={
            loadError
              ? undefined
              : selected
                ? `${selected.group}${selected.time ? ` · ${selected.time}` : ""}. Harga modal diisi dari harga supplier.`
                : remote === null
                  ? "Memuat daftar layanan supplier…"
                  : "Order lunas akan diteruskan otomatis ke layanan ini."
          }
          error={loadError ?? undefined}
        >
          <Combobox
            id="supplierServiceId"
            value={supplierServiceId ?? undefined}
            placeholder={remote === null && !loadError ? "Memuat…" : "Pilih layanan supplier"}
            invalid={Boolean(error) && !supplierServiceId}
            onValueChange={(value) =>
              onChange({
                supplierId,
                supplierServiceId: value,
                credit: remote?.find((svc) => svc.id === value)?.credit,
              })
            }
            options={options}
          />
        </Field>
      ) : null}
    </div>
  );
}

function UsdPriceFields({
  priceText,
  costText,
  usdRate,
  priceError,
  costError,
  onChange,
}: {
  priceText: string;
  costText: string;
  usdRate: number;
  priceError?: string;
  costError?: string;
  onChange: (next: { price: string; cost: string }) => void;
}) {
  const price = parseUsdInput(priceText);
  const cost = parseUsdInput(costText) ?? 0;
  const margin = price !== null ? price - cost : null;
  const rateLabel = `kurs ${formatRupiah(usdRate)} per $1`;

  return (
    <>
      <Field
        label="Harga (USD)"
        htmlFor="priceUsd"
        required
        error={priceError}
        hint={
          price !== null
            ? `User membayar ${formatRupiah(usdCentsToIdr(price, usdRate))} (${rateLabel}).`
            : `Layanan Spesial dihargai dalam dolar; Rupiah dihitung dari ${rateLabel}.`
        }
      >
        <UsdInput
          id="priceUsd"
          value={priceText}
          invalid={Boolean(priceError)}
          onChange={(value) => onChange({ price: value, cost: costText })}
        />
      </Field>
      <Field
        label="Harga modal (USD)"
        htmlFor="costPriceUsd"
        error={costError}
        hint={
          cost > 0 && margin !== null
            ? `${formatRupiah(usdCentsToIdr(cost, usdRate))} · untung per order ${formatUsd(margin)} (${formatRupiah(usdCentsToIdr(margin, usdRate))}). Tidak terlihat oleh user.`
            : "Harga dari supplier per order. Tidak terlihat oleh user."
        }
      >
        <UsdInput
          id="costPriceUsd"
          value={costText}
          invalid={Boolean(costError)}
          onChange={(value) => onChange({ price: priceText, cost: value })}
        />
      </Field>
    </>
  );
}

function UsdInput({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body text-ink-soft">
        $
      </span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-7 font-data tabular"
        placeholder="0.00"
        value={value}
        invalid={invalid}
        onChange={(event) => onChange(sanitizeUsdInput(event.target.value))}
      />
    </div>
  );
}
