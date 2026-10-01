"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import type { Service, User, UserGroup } from "@/lib/types";

type GroupDraft = {
  id: string | null;
  name: string;
  description: string;
  prices: Record<string, string>;
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function GroupManagement({
  initialGroups,
  services,
  users,
}: {
  initialGroups: UserGroup[];
  services: Service[];
  users: User[];
}) {
  const router = useRouter();
  const [groups, setGroups] = React.useState(initialGroups);
  const [editing, setEditing] = React.useState<GroupDraft | null>(null);
  const [managing, setManaging] = React.useState<UserGroup | null>(null);
  const [deleting, setDeleting] = React.useState<UserGroup | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function reload() {
    setGroups(await api<UserGroup[]>("/admin/groups"));
    router.refresh();
  }

  function openEdit(group?: UserGroup) {
    setEditing({
      id: group?.id ?? null,
      name: group?.name ?? "",
      description: group?.description ?? "",
      prices: Object.fromEntries(
        (group?.prices ?? []).map((p) => [p.serviceId, String(p.price)]),
      ),
    });
  }

  async function handleDelete(group: UserGroup) {
    setBusy(true);
    try {
      await api(`/admin/groups/${group.id}`, { method: "DELETE" });
      await reload();
      setDeleting(null);
      toast.success("Group dihapus", {
        description: `${group.members.length} member kembali ke harga default.`,
      });
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Hapus gagal") });
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button onClick={() => openEdit()}>
      <Plus className="size-4" aria-hidden="true" />
      Tambah Group
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{addButton}</div>

      <Card>
        {groups.length ? (
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Group</TH>
                  <TH>Harga group</TH>
                  <TH>Member</TH>
                  <TH className="w-32">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {groups.map((group) => (
                  <TR key={group.id}>
                    <TD>
                      <p className="font-medium text-ink">{group.name}</p>
                      {group.description ? (
                        <p className="mt-0.5 max-w-sm text-body text-ink-soft">
                          {group.description}
                        </p>
                      ) : null}
                    </TD>
                    <TD>
                      <ul className="space-y-0.5">
                        {services.map((service) => {
                          const price = group.prices.find(
                            (p) => p.serviceId === service.id,
                          )?.price;
                          return (
                            <li
                              key={service.id}
                              className="whitespace-nowrap text-body"
                            >
                              <span className="text-ink-soft">
                                {service.name}:{" "}
                              </span>
                              {price != null ? (
                                <DataValue emphasis>
                                  {formatRupiah(price)}
                                </DataValue>
                              ) : (
                                <span className="text-ink-faint">default</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </TD>
                    <TD>
                      <button
                        type="button"
                        onClick={() => setManaging(group)}
                        className="inline-flex items-center gap-1.5 rounded-md text-body font-medium text-action underline-offset-4 hover:underline"
                      >
                        <UsersThree className="size-4" aria-hidden="true" />
                        {group.members.length} user
                      </button>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Atur member ${group.name}`}
                          onClick={() => setManaging(group)}
                        >
                          <UsersThree className="size-4 text-action" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${group.name}`}
                          onClick={() => openEdit(group)}
                        >
                          <PencilSimple className="size-4 text-action" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Hapus ${group.name}`}
                          onClick={() => setDeleting(group)}
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
        ) : (
          <EmptyState
            title="Belum ada group"
            description="Buat group, atur harganya, lalu masukkan user ke dalamnya."
            action={addButton}
          />
        )}
      </Card>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        {editing ? (
          <GroupFormDialog
            draft={editing}
            services={services}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              await reload();
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(managing)}
        onOpenChange={(open) => !open && setManaging(null)}
      >
        {managing ? (
          <MembersDialog
            group={managing}
            users={users}
            onCancel={() => setManaging(null)}
            onSaved={async () => {
              await reload();
              setManaging(null);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        {deleting ? (
          <DialogContent
            title={`Hapus ${deleting.name}?`}
            description={`${deleting.members.length} member akan kembali ke harga default layanan. Order yang sudah ada tidak berubah.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDeleting(null)}>
                  Batal
                </Button>
                <Button
                  variant="danger"
                  loading={busy}
                  loadingLabel="Menghapus"
                  onClick={() => void handleDelete(deleting)}
                >
                  Hapus group
                </Button>
              </>
            }
          >
            <p className="text-body text-ink-soft">
              Tindakan ini tidak bisa dibatalkan.
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function GroupFormDialog({
  draft: initial,
  services,
  onCancel,
  onSaved,
}: {
  draft: GroupDraft;
  services: Service[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [nameError, setNameError] = React.useState<string>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setNameError("Masukkan nama group.");
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      const body = JSON.stringify({
        name,
        description: draft.description.trim(),
        prices: Object.entries(draft.prices)
          .filter(([, value]) => value !== "")
          .map(([serviceId, value]) => ({ serviceId, price: Number(value) })),
      });
      if (draft.id) {
        await api(`/admin/groups/${draft.id}`, { method: "PATCH", body });
      } else {
        await api("/admin/groups", { method: "POST", body });
      }
      toast.success(draft.id ? "Group disimpan" : "Group dibuat");
      await onSaved();
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={initial.id ? "Edit group" : "Tambah group"}
      description="Harga berlaku untuk order baru dari semua member group ini."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="submit"
            form="group-form"
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan
          </Button>
        </>
      }
    >
      <form
        id="group-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        <Field
          label="Nama group"
          htmlFor="groupName"
          required
          error={nameError}
        >
          <Input
            id="groupName"
            maxLength={60}
            value={draft.name}
            invalid={Boolean(nameError)}
            placeholder="Group A"
            onChange={(event) =>
              setDraft((d) => ({ ...d, name: event.target.value }))
            }
          />
        </Field>
        <Field
          label="Deskripsi"
          htmlFor="groupDescription"
          hint="Opsional, hanya terlihat oleh Super Admin."
        >
          <Input
            id="groupDescription"
            maxLength={300}
            value={draft.description}
            placeholder="Reseller besar, dll."
            onChange={(event) =>
              setDraft((d) => ({ ...d, description: event.target.value }))
            }
          />
        </Field>
        <fieldset className="space-y-3 rounded-md border border-hairline p-3.5">
          <legend className="px-1 text-body font-medium text-ink">
            Harga per layanan
          </legend>
          <p className="text-body text-ink-soft">
            Kosongkan untuk memakai harga default layanan.
          </p>
          {services.map((service) => (
            <Field
              key={service.id}
              label={service.name}
              htmlFor={`group-price-${service.id}`}
              hint={`Default ${formatRupiah(service.price)}${service.active ? "" : " · layanan nonaktif"}`}
            >
              <Input
                id={`group-price-${service.id}`}
                inputMode="numeric"
                className="font-data tabular"
                value={draft.prices[service.id] ?? ""}
                placeholder={String(service.price)}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "");
                  setDraft((d) => ({
                    ...d,
                    prices: { ...d.prices, [service.id]: raw },
                  }));
                }}
              />
            </Field>
          ))}
        </fieldset>
      </form>
    </DialogContent>
  );
}

function MembersDialog({
  group,
  users,
  onCancel,
  onSaved,
}: {
  group: UserGroup;
  users: User[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [selected, setSelected] = React.useState(
    () => new Set(group.members.map((m) => m.id)),
  );
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const needle = query.trim().toLowerCase();
  const visible = users.filter(
    (user) =>
      !needle ||
      user.fullName.toLowerCase().includes(needle) ||
      user.username.toLowerCase().includes(needle),
  );
  const movingIn = users.filter(
    (u) => selected.has(u.id) && u.groupId !== group.id,
  );
  const losingCustom = movingIn.filter(
    (u) => (u.customPrices ?? []).length > 0,
  ).length;
  const fromOtherGroup = movingIn.filter((u) => u.groupId).length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api(`/admin/groups/${group.id}/members`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [...selected] }),
      });
      toast.success("Member disimpan", {
        description: `${selected.size} user di ${group.name}.`,
      });
      await onSaved();
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={`Member ${group.name}`}
      description="Centang user yang masuk group ini. Satu user hanya bisa di satu group."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan ({selected.size})
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Cari user</span>
          <MagnifyingGlass
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau username"
            className="pl-9"
          />
        </label>
        <div className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-md border border-hairline">
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
                  className="size-4 rounded-sm border-hairline accent-action"
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
                  <Tag className="border-hairline bg-mist text-ink-soft">
                    {user.groupName}
                  </Tag>
                ) : null}
                {!user.groupId && (user.customPrices ?? []).length ? (
                  <Tag className="border-hold-edge bg-hold-wash text-hold-ink">
                    Harga khusus
                  </Tag>
                ) : null}
              </label>
            ))
          ) : (
            <p className="px-3.5 py-3 text-body text-ink-soft">
              Tidak ada user yang cocok.
            </p>
          )}
        </div>
        {fromOtherGroup || losingCustom ? (
          <p className="text-body text-working-ink">
            {[
              fromOtherGroup
                ? `${fromOtherGroup} user pindah dari group lain`
                : "",
              losingCustom
                ? `${losingCustom} user kehilangan harga khusus pribadinya`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            .
          </p>
        ) : null}
      </div>
    </DialogContent>
  );
}
