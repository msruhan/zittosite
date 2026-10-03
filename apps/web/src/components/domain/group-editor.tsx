"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  Check,
  MagnifyingGlass,
  PencilSimple,
  Plugs,
  UsersThree,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/status-badge";
import { GroupInfoDialog } from "@/components/domain/group-management";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import {
  GROUP_PRICE_RULES,
  GROUP_ROUND_OPTIONS,
  type GroupPriceAdjustment,
  type GroupPriceRule,
  groupAdjustedPrice,
  groupAdjustmentError,
} from "@/lib/group-pricing";
import { cn } from "@/lib/utils";
import type { Service, User, UserGroup } from "@/lib/types";

type Step = "members" | "manual" | "api";

const UNGROUPED = "__none__";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function matches(service: Service, needle: string) {
  return !needle || service.name.toLowerCase().includes(needle);
}

export function GroupEditor({
  initialGroup,
  services,
  users,
}: {
  initialGroup: UserGroup;
  services: Service[];
  users: User[];
}) {
  const router = useRouter();
  const [group, setGroup] = React.useState(initialGroup);
  const [step, setStep] = React.useState<Step>(
    initialGroup.members.length ? "manual" : "members",
  );
  const [editingInfo, setEditingInfo] = React.useState(false);

  const manualServices = React.useMemo(
    () => services.filter((s) => s.via !== "supplier"),
    [services],
  );
  const apiServices = React.useMemo(() => services.filter((s) => s.via === "supplier"), [services]);
  const priced = React.useMemo(() => new Set(group.prices.map((p) => p.serviceId)), [group]);
  const pricedIn = (list: Service[]) => list.filter((s) => priced.has(s.id)).length;
  const exceptions = React.useMemo(() => {
    const memberIds = new Set(group.members.map((m) => m.id));
    const map = new Map<string, string[]>();
    for (const user of users) {
      if (!memberIds.has(user.id)) continue;
      for (const p of user.customPrices ?? []) {
        map.set(p.serviceId, [...(map.get(p.serviceId) ?? []), user.username]);
      }
    }
    return map;
  }, [group.members, users]);

  function changed(next: UserGroup) {
    setGroup(next);
    router.refresh();
  }

  const steps: { id: Step; title: string; meta: string; icon: React.ElementType }[] = [
    {
      id: "members",
      title: "Member",
      meta: `${group.members.length} user`,
      icon: UsersThree,
    },
    {
      id: "manual",
      title: "Harga service manual",
      meta: `${pricedIn(manualServices)} dari ${manualServices.length} diatur`,
      icon: Wrench,
    },
    {
      id: "api",
      title: "Harga service API",
      meta: `${pricedIn(apiServices)} dari ${apiServices.length} diatur`,
      icon: Plugs,
    },
  ];
  const index = steps.findIndex((s) => s.id === step);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-label uppercase text-ink-soft">Group user</p>
          <h1 className="mt-1 text-display text-ink">{group.name}</h1>
          <p className="mt-1 max-w-2xl text-body text-ink-soft">
            {group.description ||
              "Member group ini membayar harga yang diatur di sini. Layanan yang belum diatur tetap memakai harga default."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingInfo(true)}>
          <PencilSimple aria-hidden="true" />
          Edit info
        </Button>
      </div>

      <div role="tablist" aria-label="Langkah" className="grid gap-2 sm:grid-cols-3">
        {steps.map((item, i) => {
          const active = item.id === step;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStep(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-left",
                "transition-[border-color,background-color,box-shadow] duration-150 ease-out-strong",
                active
                  ? "border-action bg-action-wash shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_14%,transparent)]"
                  : "border-hairline bg-surface hover:border-ink-faint",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full font-data text-label font-bold",
                  active ? "bg-action text-surface" : "bg-mist text-ink-soft",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-body font-medium",
                    active ? "text-action" : "text-ink",
                  )}
                >
                  {item.title}
                </span>
                <span className="block truncate font-data text-label text-ink-soft">
                  {item.meta}
                </span>
              </span>
              <Icon
                className={cn("size-5 shrink-0", active ? "text-action" : "text-ink-faint")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {/* Every step stays mounted so unsaved ticks survive switching steps. */}
      <div role="tabpanel" hidden={step !== "members"}>
        <MemberStep group={group} users={users} onChanged={changed} />
      </div>
      <div role="tabpanel" hidden={step !== "manual"}>
        <PriceStep
          group={group}
          services={manualServices}
          exceptions={exceptions}
          onChanged={changed}
          title="Harga service manual"
          description="Layanan yang diproses admin. Centang satu atau beberapa layanan, lalu tentukan harganya untuk group ini."
        />
      </div>
      <div role="tabpanel" hidden={step !== "api"}>
        <ApiPriceStep
          group={group}
          services={apiServices}
          exceptions={exceptions}
          onChanged={changed}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
        {index > 0 ? (
          <Button variant="ghost" onClick={() => setStep(steps[index - 1].id)}>
            <ArrowLeft aria-hidden="true" />
            {steps[index - 1].title}
          </Button>
        ) : (
          <span />
        )}
        {index < steps.length - 1 ? (
          <Button variant="secondary" onClick={() => setStep(steps[index + 1].id)}>
            Lanjut: {steps[index + 1].title}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => router.push("/admin/groups")}>
            <Check aria-hidden="true" />
            Selesai
          </Button>
        )}
      </div>

      <Dialog open={editingInfo} onOpenChange={(open) => !open && setEditingInfo(false)}>
        {editingInfo ? (
          <GroupInfoDialog
            group={group}
            onCancel={() => setEditingInfo(false)}
            onSaved={(next) => {
              changed(next);
              setEditingInfo(false);
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function MemberStep({
  group,
  users,
  onChanged,
}: {
  group: UserGroup;
  users: User[];
  onChanged: (group: UserGroup) => void;
}) {
  const initial = React.useMemo(() => new Set(group.members.map((m) => m.id)), [group]);
  const [selected, setSelected] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Current members first, fixed at mount so rows don't jump while ticking.
  const [ordered] = React.useState(() =>
    [...users].sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id))),
  );

  const needle = query.trim().toLowerCase();
  const visible = ordered.filter(
    (u) =>
      !needle ||
      u.fullName.toLowerCase().includes(needle) ||
      u.username.toLowerCase().includes(needle),
  );
  const added = [...selected].filter((id) => !initial.has(id)).length;
  const removed = [...initial].filter((id) => !selected.has(id)).length;
  const dirty = added > 0 || removed > 0;
  const movingIn = users.filter((u) => selected.has(u.id) && u.groupId !== group.id);
  const fromOtherGroup = movingIn.filter((u) => u.groupId).length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const next = await api<UserGroup>(`/admin/groups/${group.id}/members`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [...selected] }),
      });
      toast.success("Member disimpan", { description: `${next.members.length} user di ${next.name}.` });
      onChanged(next);
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-title">Pilih member</CardTitle>
          <CardDescription className="mt-1">
            Centang user yang masuk group ini. Satu user hanya bisa berada di satu group.
          </CardDescription>
        </div>
        <Tag className="shrink-0 border-hairline bg-mist text-ink">{selected.size} dipilih</Tag>
      </CardHeader>
      <CardBody className="space-y-3 pt-4">
        <SearchField value={query} onChange={setQuery} placeholder="Cari nama atau username" />
        <div className="max-h-[26rem] divide-y divide-hairline overflow-y-auto rounded-md border border-hairline">
          {visible.length ? (
            visible.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-mist"
              >
                <input
                  type="checkbox"
                  checked={selected.has(user.id)}
                  onChange={(event) => toggle(user.id, event.target.checked)}
                  className="size-4 rounded-sm accent-action"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">
                    {user.fullName}
                  </span>
                  <span className="block truncate font-data text-label text-ink-soft">
                    @{user.username}
                  </span>
                </span>
                {user.groupName && user.groupId !== group.id ? (
                  <Tag className="border-hairline bg-mist text-ink-soft">{user.groupName}</Tag>
                ) : null}
              </label>
            ))
          ) : (
            <p className="px-3.5 py-6 text-center text-body text-ink-soft">
              Tidak ada user yang cocok.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-ink-soft">
            {dirty
              ? [
                  added ? `${added} ditambahkan` : "",
                  removed ? `${removed} dikeluarkan` : "",
                  fromOtherGroup ? `${fromOtherGroup} pindah dari group lain` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Belum ada perubahan."}
          </p>
          <Button onClick={() => void save()} disabled={!dirty} loading={saving} loadingLabel="Menyimpan">
            Simpan member
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ApiPriceStep({
  group,
  services,
  exceptions,
  onChanged,
}: {
  group: UserGroup;
  services: Service[];
  exceptions: Map<string, string[]>;
  onChanged: (group: UserGroup) => void;
}) {
  const suppliers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of services) {
      const id = s.supplierId ?? UNGROUPED;
      const entry = map.get(id) ?? { id, name: s.supplierName ?? "Tanpa supplier", count: 0 };
      entry.count += 1;
      map.set(id, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);
  const [supplierId, setSupplierId] = React.useState(
    suppliers.length === 1 ? suppliers[0].id : "",
  );
  const priced = new Set(group.prices.map((p) => p.serviceId));
  const scoped = services.filter((s) => (s.supplierId ?? UNGROUPED) === supplierId);
  const supplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-title text-ink">Pilih Supplier API</p>
            <p className="mt-1 text-body text-ink-soft">
              Daftar layanan di bawah mengikuti supplier yang dipilih. Harga group disimpan dalam
              Rupiah dan tidak ikut berubah saat kurs USD diganti.
            </p>
          </div>
          <Select
            className="sm:w-72"
            ariaLabel="Supplier API"
            placeholder="Pilih supplier…"
            value={supplierId || undefined}
            onValueChange={setSupplierId}
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.name,
              hint: `${services.filter((x) => (x.supplierId ?? UNGROUPED) === s.id && priced.has(x.id)).length}/${s.count}`,
            }))}
          />
        </div>
      </Card>

      {supplier ? (
        <PriceStep
          key={supplier.id}
          group={group}
          services={scoped}
          exceptions={exceptions}
          onChanged={onChanged}
          grouped
          title={`Harga service ${supplier.name}`}
          description="Centang layanan atau satu grup layanan sekaligus, lalu tentukan harganya untuk group ini."
        />
      ) : (
        <div className="rounded-lg border border-dashed border-hairline px-5 py-10 text-center">
          <Plugs className="mx-auto size-8 text-ink-faint" aria-hidden="true" />
          <p className="mt-2 text-body font-medium text-ink">
            {services.length ? "Pilih Supplier API dulu" : "Belum ada service API"}
          </p>
          <p className="mt-1 text-body text-ink-soft">
            {services.length
              ? "Setelah dipilih, layanan dari supplier tersebut akan tampil di sini."
              : "Tambahkan layanan dari halaman Services → Service API."}
          </p>
        </div>
      )}
    </div>
  );
}

function PriceStep({
  group,
  services,
  exceptions,
  onChanged,
  title,
  description,
  grouped = false,
}: {
  group: UserGroup;
  services: Service[];
  /** Service id → usernames of members with their own price for it. */
  exceptions: Map<string, string[]>;
  onChanged: (group: UserGroup) => void;
  title: string;
  description: string;
  /** Show Layanan Spesial groups as filters and selectable headings. */
  grouped?: boolean;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [query, setQuery] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const priceOf = React.useMemo(
    () => new Map(group.prices.map((p) => [p.serviceId, p.price])),
    [group],
  );
  const serviceGroups = React.useMemo(() => {
    if (!grouped) return [];
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of services) {
      const id = s.serviceGroupId ?? UNGROUPED;
      const entry = map.get(id) ?? { id, name: s.serviceGroupName ?? "Lainnya", count: 0 };
      entry.count += 1;
      map.set(id, entry);
    }
    const list = [...map.values()];
    return list.length === 1 && list[0].id === UNGROUPED ? [] : list;
  }, [services, grouped]);

  const needle = query.trim().toLowerCase();
  const inScope = services.filter(
    (s) =>
      matches(s, needle) &&
      (groupFilter === null || (s.serviceGroupId ?? UNGROUPED) === groupFilter),
  );
  const unset = inScope.filter((s) => !priceOf.has(s.id));
  const done = inScope.filter((s) => priceOf.has(s.id));
  const chosen = services.filter((s) => selected.has(s.id));

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

  async function savePrices(set: { serviceId: string; price: number }[], remove: string[] = []) {
    setBusy(true);
    try {
      const next = await api<UserGroup>(`/admin/groups/${group.id}/prices`, {
        method: "PUT",
        body: JSON.stringify({ set, remove }),
      });
      onChanged(next);
      setSelected(new Set());
      toast.success(remove.length && !set.length ? "Kembali ke harga default" : "Harga disimpan", {
        description: `${set.length + remove.length} layanan di group ${next.name}.`,
      });
      return true;
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const sections = serviceGroups.length
    ? serviceGroups
        .map((g) => ({ ...g, items: unset.filter((s) => (s.serviceGroupId ?? UNGROUPED) === g.id) }))
        .filter((g) => g.items.length)
    : [{ id: "all", name: "", count: unset.length, items: unset }];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-title">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-3 pt-4">
          <SearchField value={query} onChange={setQuery} placeholder="Cari nama layanan" />
          {serviceGroups.length ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter grup layanan">
              <FilterChip active={groupFilter === null} onClick={() => setGroupFilter(null)}>
                Semua grup · {services.length}
              </FilterChip>
              {serviceGroups.map((g) => (
                <FilterChip
                  key={g.id}
                  active={groupFilter === g.id}
                  onClick={() => setGroupFilter(g.id)}
                >
                  {g.name} · {g.count}
                </FilterChip>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-hairline">
            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-mist/60 px-3.5 py-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-body font-medium text-ink">
                <input
                  type="checkbox"
                  className="size-4 rounded-sm accent-action"
                  disabled={unset.length === 0}
                  checked={unset.length > 0 && unset.every((s) => selected.has(s.id))}
                  onChange={(event) => setMany(unset.map((s) => s.id), event.target.checked)}
                />
                Belum diatur
              </label>
              <span className="font-data text-label text-ink-soft">{unset.length} layanan</span>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {unset.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-body text-ink-soft">
                  {services.length && !needle && groupFilter === null
                    ? "Semua layanan sudah diatur harganya."
                    : services.length
                      ? "Tidak ada layanan belum diatur yang cocok."
                      : "Belum ada layanan."}
                </p>
              ) : (
                sections.map((section) => (
                  <div key={section.id}>
                    {section.name ? (
                      <label className="sticky top-0 z-[1] flex cursor-pointer items-center gap-2.5 border-b border-hairline bg-surface/95 px-3.5 py-2 backdrop-blur">
                        <input
                          type="checkbox"
                          className="size-4 rounded-sm accent-action"
                          checked={section.items.every((s) => selected.has(s.id))}
                          onChange={(event) =>
                            setMany(section.items.map((s) => s.id), event.target.checked)
                          }
                        />
                        <span className="text-label font-bold uppercase tracking-wide text-ink-soft">
                          {section.name}
                        </span>
                        <span className="font-data text-label text-ink-faint">
                          {section.items.length}
                        </span>
                      </label>
                    ) : null}
                    <ul className="divide-y divide-hairline">
                      {section.items.map((service) => (
                        <li key={service.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-mist">
                            <input
                              type="checkbox"
                              className="size-4 rounded-sm accent-action"
                              checked={selected.has(service.id)}
                              onChange={(event) => setMany([service.id], event.target.checked)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body text-ink">
                                {service.name}
                              </span>
                              <ExceptionNote users={exceptions.get(service.id)} />
                            </span>
                            {!service.active ? (
                              <Tag className="border-hairline bg-mist text-ink-soft">Offline</Tag>
                            ) : null}
                            <span className="hidden shrink-0 text-right sm:block">
                              <DataValue className="block text-ink">
                                {formatRupiah(service.price)}
                              </DataValue>
                              <DataValue className="block text-label text-ink-soft">
                                Modal {service.costPrice ? formatRupiah(service.costPrice) : "—"}
                              </DataValue>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {chosen.length ? (
        <BulkPriceBar
          chosen={chosen}
          priceOf={priceOf}
          busy={busy}
          onClear={() => setSelected(new Set())}
          onApply={(set) => savePrices(set)}
          onReset={(ids) => savePrices([], ids)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-title">Sudah diatur</CardTitle>
            <CardDescription className="mt-1">
              Ubah angka langsung di kolom harga group, atau kembalikan ke harga default.
            </CardDescription>
          </div>
          <Tag className="shrink-0 border-action/30 bg-action-wash text-action">
            {done.length} layanan
          </Tag>
        </CardHeader>
        <CardBody className="pt-4">
          {done.length === 0 ? (
            <p className="rounded-md border border-dashed border-hairline px-3.5 py-6 text-center text-body text-ink-soft">
              Belum ada. Centang layanan di atas lalu tentukan harganya.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-hairline">
              <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_7rem_7rem_9.5rem_6.5rem_2.75rem] items-center gap-3 border-b border-hairline bg-mist/60 px-3.5 py-2 text-label font-bold uppercase tracking-wide text-ink-soft md:grid">
                <input
                  type="checkbox"
                  aria-label="Pilih semua yang sudah diatur"
                  className="size-4 rounded-sm accent-action"
                  checked={done.every((s) => selected.has(s.id))}
                  onChange={(event) => setMany(done.map((s) => s.id), event.target.checked)}
                />
                <span>Layanan</span>
                <span className="text-right">Default</span>
                <span className="text-right">Modal</span>
                <span className="text-right">Harga group</span>
                <span className="text-right">Untung</span>
                <span className="sr-only">Aksi</span>
              </div>
              <ul className="max-h-[30rem] divide-y divide-hairline overflow-y-auto">
                {done.map((service) => (
                  <PricedRow
                    key={`${service.id}:${priceOf.get(service.id)}`}
                    service={service}
                    price={priceOf.get(service.id)!}
                    exceptionUsers={exceptions.get(service.id)}
                    selected={selected.has(service.id)}
                    busy={busy}
                    onSelect={(checked) => setMany([service.id], checked)}
                    onSave={(price) => savePrices([{ serviceId: service.id, price }])}
                    onReset={() => savePrices([], [service.id])}
                  />
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ExceptionNote({ users }: { users?: string[] }) {
  if (!users?.length) return null;
  return (
    <span
      className="block truncate text-label font-medium text-hold-ink"
      title={`Harga khusus user tetap berlaku: ${users.map((u) => `@${u}`).join(", ")}`}
    >
      {users.length} member punya harga khusus
    </span>
  );
}

function PricedRow({
  service,
  price,
  exceptionUsers,
  selected,
  busy,
  onSelect,
  onSave,
  onReset,
}: {
  service: Service;
  price: number;
  exceptionUsers?: string[];
  selected: boolean;
  busy: boolean;
  onSelect: (checked: boolean) => void;
  onSave: (price: number) => Promise<boolean>;
  onReset: () => void;
}) {
  const [draft, setDraft] = React.useState(String(price));
  const cost = service.costPrice ?? 0;
  const margin = price - cost;
  const diff = service.price ? Math.round(((price - service.price) / service.price) * 100) : 0;

  async function commit() {
    const next = Number(draft);
    if (!draft || !Number.isFinite(next) || next === price) {
      setDraft(String(price));
      return;
    }
    if (!(await onSave(next))) setDraft(String(price));
  }

  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3.5 py-2.5 md:grid-cols-[1.5rem_minmax(0,1fr)_7rem_7rem_9.5rem_6.5rem_2.75rem]">
      <input
        type="checkbox"
        aria-label={`Pilih ${service.name}`}
        className="size-4 rounded-sm accent-action"
        checked={selected}
        onChange={(event) => onSelect(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block truncate text-body text-ink">{service.name}</span>
        {diff !== 0 ? (
          <span className={cn("text-label", diff < 0 ? "text-cleared-ink" : "text-hold-ink")}>
            {diff > 0 ? "+" : ""}
            {diff}% dari default
          </span>
        ) : (
          <span className="text-label text-ink-faint">Sama dengan default</span>
        )}
        <ExceptionNote users={exceptionUsers} />
      </span>
      <DataValue className="hidden text-right text-ink-soft md:block">
        {formatRupiah(service.price)}
      </DataValue>
      <DataValue className="hidden text-right text-ink-soft md:block">
        {cost ? formatRupiah(cost) : "—"}
      </DataValue>
      <div className="relative col-start-2 md:col-start-auto">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label text-ink-soft">
          Rp
        </span>
        <Input
          aria-label={`Harga group ${service.name}`}
          inputMode="numeric"
          className="h-9 pl-9 text-right font-data tabular"
          value={draft}
          disabled={busy}
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
      <DataValue
        className={cn(
          "hidden text-right md:block",
          !cost ? "text-ink-faint" : margin < 0 ? "text-refused-ink" : "text-cleared-ink",
        )}
      >
        {cost ? formatRupiah(margin) : "—"}
      </DataValue>
      <Button
        size="icon"
        variant="ghost"
        className="size-9 justify-self-end"
        aria-label={`Kembalikan ${service.name} ke harga default`}
        title="Kembalikan ke harga default"
        disabled={busy}
        onClick={onReset}
      >
        <ArrowCounterClockwise className="size-4 text-ink-soft" />
      </Button>
    </li>
  );
}

export function BulkPriceBar({
  chosen,
  priceOf,
  busy,
  onClear,
  onApply,
  onReset,
  resetLabel = "default",
  className,
}: {
  /** `price` is the starting point for "naikkan/diskon" rules. */
  chosen: Service[];
  priceOf: Map<string, number>;
  busy: boolean;
  onClear: () => void;
  onApply: (set: { serviceId: string; price: number }[]) => Promise<boolean>;
  onReset: (ids: string[]) => Promise<boolean>;
  resetLabel?: string;
  className?: string;
}) {
  const [rule, setRule] = React.useState<GroupPriceRule>("price_up");
  const [unit, setUnit] = React.useState<GroupPriceAdjustment["unit"]>("percent");
  const [roundTo, setRoundTo] = React.useState<GroupPriceAdjustment["roundTo"]>(100);
  const [raw, setRaw] = React.useState("");

  const percent = rule !== "fixed" && unit === "percent";
  const value = percent ? Number(raw.replace(",", ".")) || 0 : Number(raw) || 0;
  const adjustment: GroupPriceAdjustment = { rule, unit, value, roundTo: percent ? roundTo : 1 };
  const invalid = raw ? groupAdjustmentError(adjustment) : undefined;
  const ready = Boolean(raw) && !invalid;
  const rows = chosen.map((s) => ({
    service: s,
    next: ready ? groupAdjustedPrice(s, adjustment) : null,
  }));
  const belowCost = rows.filter(
    (r) => r.next !== null && (r.service.costPrice ?? 0) > 0 && r.next < (r.service.costPrice ?? 0),
  ).length;
  const missingCost = rule === "cost_up" && chosen.some((s) => !s.costPrice);
  const alreadySet = chosen.filter((s) => priceOf.has(s.id));
  const sample = rows[0];

  async function apply() {
    if (!ready) return;
    const ok = await onApply(rows.map((r) => ({ serviceId: r.service.id, price: r.next! })));
    if (ok) setRaw("");
  }

  return (
    <div
      className={cn(
        "sticky bottom-4 z-10 rounded-lg border border-action bg-surface shadow-lifted",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <p className="text-body font-medium text-ink">
          Atur harga <span className="font-data text-action">{chosen.length}</span> layanan
          terpilih
        </p>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X aria-hidden="true" />
          Batal pilih
        </Button>
      </div>
      <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Field label="Cara menghitung" htmlFor="bulk-rule">
          <Select
            id="bulk-rule"
            value={rule}
            onValueChange={(v) => {
              setRule(v as GroupPriceRule);
              setRaw("");
            }}
            options={GROUP_PRICE_RULES.map((r) => ({
              ...r,
              label: r.label.replace("harga default", `harga ${resetLabel}`),
            }))}
          />
        </Field>
        <Field
          label={rule === "fixed" ? "Harga" : percent ? "Persen" : "Nominal"}
          htmlFor="bulk-value"
          error={invalid}
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              {!percent ? (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-soft">
                  Rp
                </span>
              ) : null}
              <Input
                id="bulk-value"
                inputMode={percent ? "decimal" : "numeric"}
                className={cn("font-data tabular", percent ? "pr-8" : "pl-10")}
                placeholder={rule === "fixed" ? "150000" : percent ? "10" : "5000"}
                value={raw}
                invalid={Boolean(invalid)}
                onChange={(event) =>
                  setRaw(
                    percent
                      ? event.target.value.replace(/[^\d.,]/g, "")
                      : event.target.value.replace(/\D/g, ""),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void apply();
                  }
                }}
              />
              {percent ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-ink-soft">
                  %
                </span>
              ) : null}
            </div>
            {rule !== "fixed" ? (
              <div className="flex shrink-0 rounded-md border border-hairline p-0.5" role="group" aria-label="Satuan">
                {(["percent", "amount"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => {
                      setUnit(u);
                      setRaw("");
                    }}
                    className={cn(
                      "rounded-sm px-2.5 text-body font-medium transition-colors duration-150",
                      unit === u ? "bg-action text-surface" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {u === "percent" ? "%" : "Rp"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Field>
        <Field label="Pembulatan" htmlFor="bulk-round">
          <Select
            id="bulk-round"
            value={percent ? String(roundTo) : "1"}
            onValueChange={(v) => setRoundTo(Number(v) as GroupPriceAdjustment["roundTo"])}
            options={percent ? GROUP_ROUND_OPTIONS : [{ value: "1", label: "Tidak perlu" }]}
          />
        </Field>
        <Button onClick={() => void apply()} disabled={!ready} loading={busy} loadingLabel="Menyimpan">
          <Check aria-hidden="true" />
          Simpan harga
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t border-hairline px-4 py-2.5 text-body sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-ink-soft">
          {sample && sample.next !== null ? (
            <>
              Contoh: <span className="text-ink">{sample.service.name}</span>{" "}
              <DataValue className="text-ink-soft">
                {formatRupiah(priceOf.get(sample.service.id) ?? sample.service.price)}
              </DataValue>{" "}
              →{" "}
              <DataValue emphasis className="text-action">
                {formatRupiah(sample.next)}
              </DataValue>
              {belowCost ? (
                <span className="ml-2 text-refused-ink">
                  · {belowCost} layanan di bawah harga modal
                </span>
              ) : null}
            </>
          ) : missingCost ? (
            <span className="text-hold-ink">
              Ada layanan dengan harga modal Rp 0, hasilnya hanya sebesar keuntungan.
            </span>
          ) : (
            "Isi nilai untuk melihat contoh hasil harga."
          )}
        </p>
        {alreadySet.length ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onReset(alreadySet.map((s) => s.id))}
          >
            <ArrowCounterClockwise aria-hidden="true" />
            Kembalikan {alreadySet.length} ke {resetLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-label font-medium transition-colors duration-150",
        active
          ? "border-action bg-action text-surface"
          : "border-hairline bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <MagnifyingGlass
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </label>
  );
}
