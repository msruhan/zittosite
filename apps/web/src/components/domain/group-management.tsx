"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import type { Service, UserGroup } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function GroupManagement({
  initialGroups,
  services,
}: {
  initialGroups: UserGroup[];
  services: Service[];
}) {
  const router = useRouter();
  const [groups, setGroups] = React.useState(initialGroups);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<UserGroup | null>(null);
  const [busy, setBusy] = React.useState(false);

  const viaOf = React.useMemo(
    () => new Map(services.map((s) => [s.id, s.via === "supplier" ? "api" : "manual"])),
    [services],
  );
  const manualTotal = services.filter((s) => s.via !== "supplier").length;
  const apiTotal = services.length - manualTotal;

  async function handleDelete(group: UserGroup) {
    setBusy(true);
    try {
      await api(`/admin/groups/${group.id}`, { method: "DELETE" });
      setGroups(await api<UserGroup[]>("/admin/groups"));
      router.refresh();
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
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" aria-hidden="true" />
      Tambah Group
    </Button>
  );

  return (
    <div className="space-y-4">
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["Buat group", "Beri nama, misalnya Reseller atau Member VIP."],
          ["Pilih member", "Centang user yang masuk group. Satu user hanya di satu group."],
          ["Atur harga", "Service manual dan service API. Yang tidak diatur memakai harga default."],
        ].map(([title, text], index) => (
          <li
            key={title}
            className="flex gap-3 rounded-lg border border-hairline bg-surface px-4 py-3"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-action-wash font-data text-label font-bold text-action">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink">{title}</span>
              <span className="block text-label text-ink-soft">{text}</span>
            </span>
          </li>
        ))}
      </ol>

      {groups.length ? <div className="flex justify-end">{addButton}</div> : null}

      <Card>
        {groups.length ? (
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Group</TH>
                  <TH>Member</TH>
                  <TH>Service manual</TH>
                  <TH>Service API</TH>
                  <TH className="w-48 text-right">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {groups.map((group) => {
                  const manual = group.prices.filter((p) => viaOf.get(p.serviceId) === "manual")
                    .length;
                  const viaApi = group.prices.filter((p) => viaOf.get(p.serviceId) === "api")
                    .length;
                  return (
                    <TR key={group.id}>
                      <TD>
                        <Link
                          href={`/admin/groups/${group.id}`}
                          className="font-medium text-ink underline-offset-4 hover:text-action hover:underline"
                        >
                          {group.name}
                        </Link>
                        {group.description ? (
                          <p className="mt-0.5 max-w-sm text-body text-ink-soft">
                            {group.description}
                          </p>
                        ) : null}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 text-body text-ink">
                          <UsersThree className="size-4 text-ink-soft" aria-hidden="true" />
                          {group.members.length} user
                        </span>
                      </TD>
                      <TD>
                        <PricedCount count={manual} total={manualTotal} />
                      </TD>
                      <TD>
                        <PricedCount count={viaApi} total={apiTotal} />
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => router.push(`/admin/groups/${group.id}`)}
                          >
                            Kelola
                            <ArrowRight aria-hidden="true" />
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
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState
            title="Belum ada group"
            description="Buat group, masukkan user, lalu atur harga layanannya."
            action={addButton}
          />
        )}
      </Card>

      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        {creating ? (
          <GroupInfoDialog
            group={null}
            onCancel={() => setCreating(false)}
            onSaved={(group) => router.push(`/admin/groups/${group.id}`)}
          />
        ) : null}
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
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
            <p className="text-body text-ink-soft">Tindakan ini tidak bisa dibatalkan.</p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function PricedCount({ count, total }: { count: number; total: number }) {
  if (count === 0) return <span className="text-body text-ink-faint">Semua default</span>;
  return (
    <Tag className="border-action/30 bg-action-wash text-action">
      {count} dari {total} diatur
    </Tag>
  );
}

/** Name and description only; prices and members live on the group page. */
export function GroupInfoDialog({
  group,
  onCancel,
  onSaved,
}: {
  group: Pick<UserGroup, "id" | "name" | "description"> | null;
  onCancel: () => void;
  onSaved: (group: UserGroup) => void | Promise<void>;
}) {
  const [name, setName] = React.useState(group?.name ?? "");
  const [description, setDescription] = React.useState(group?.description ?? "");
  const [nameError, setNameError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Masukkan nama group.");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() });
      const saved = group
        ? await api<UserGroup>(`/admin/groups/${group.id}`, { method: "PATCH", body })
        : await api<UserGroup>("/admin/groups", { method: "POST", body });
      toast.success(group ? "Group disimpan" : "Group dibuat", {
        description: group ? undefined : "Lanjut pilih member dan atur harga.",
      });
      await onSaved(saved);
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={group ? "Edit info group" : "Tambah group"}
      description={
        group
          ? undefined
          : "Setelah dibuat, Anda langsung diarahkan untuk memilih member dan mengatur harga."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" form="group-info-form" loading={saving} loadingLabel="Menyimpan">
            {group ? "Simpan" : "Buat dan lanjutkan"}
          </Button>
        </>
      }
    >
      <form id="group-info-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nama group" htmlFor="groupName" required error={nameError}>
          <Input
            id="groupName"
            maxLength={60}
            value={name}
            invalid={Boolean(nameError)}
            placeholder="Reseller"
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
            }}
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
            value={description}
            placeholder="Reseller besar, dll."
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </form>
    </DialogContent>
  );
}
