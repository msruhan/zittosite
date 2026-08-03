"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/shell/user-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
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
import type { Admin } from "@/lib/types";

type AdminDraft = Admin & { password?: string };

export function AdminManagement({
  initialAdmins,
}: {
  initialAdmins: Admin[];
}) {
  const [admins, setAdmins] = React.useState(initialAdmins);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<AdminDraft | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    setAdmins(initialAdmins);
  }, [initialAdmins]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return admins;
    return admins.filter(
      (admin) =>
        admin.fullName.toLowerCase().includes(needle) ||
        admin.username.toLowerCase().includes(needle) ||
        (admin.telegramHandle ?? "").toLowerCase().includes(needle),
    );
  }, [admins, query]);

  async function reload() {
    const next = await api<Admin[]>("/admin/admins");
    setAdmins(next);
  }

  async function handleSave(next: AdminDraft) {
    try {
      if (creating) {
        await api("/admin/admins", {
          method: "POST",
          body: JSON.stringify({
            username: next.username,
            fullName: next.fullName,
            password: next.password,
            role: next.role ?? "admin",
          }),
        });
      } else {
        await api(`/admin/admins/${next.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: next.fullName,
            role: next.role,
            status: next.active ? "active" : "blocked",
            ...(next.password ? { password: next.password } : {}),
          }),
        });
      }
      await reload();
      setEditing(null);
      setCreating(false);
      toast.success(creating ? "Admin ditambahkan" : "Perubahan disimpan");
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
    }
  }

  async function handleToggle(admin: Admin) {
    try {
      await api(`/admin/admins/${admin.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: admin.active ? "blocked" : "active",
        }),
      });
      await reload();
      toast.success(admin.active ? "Admin diblokir" : "Admin diaktifkan", {
        description: `${admin.fullName} ${admin.active ? "tidak lagi" : "kembali"} dapat login.`,
      });
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Update gagal",
      });
    }
  }

  async function handleDelete(admin: Admin) {
    try {
      const result = await api<{
        deleted: boolean;
        blocked?: boolean;
        message?: string;
      }>(`/admin/admins/${admin.id}`, { method: "DELETE" });
      await reload();
      toast.success(
        result.deleted ? "Admin dihapus" : "Admin diblokir",
        {
          description:
            result.message ??
            `${admin.fullName} tidak lagi memiliki akses.`,
        },
      );
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Hapus gagal",
      });
    }
  }

  function openCreate() {
    setCreating(true);
    setEditing({
      id: "",
      username: "",
      fullName: "",
      role: "admin",
      telegramHandle: null,
      active: true,
      handledCount: 0,
      password: "",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari admin</span>
          <Search
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, username, atau Telegram"
            className="pl-9"
          />
        </label>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Tambah Admin
        </Button>
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Admin</TH>
                    <TH>Role</TH>
                    <TH>Telegram</TH>
                    <TH>Order ditangani</TH>
                    <TH>Status</TH>
                    <TH className="w-36">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((admin) => (
                    <TR key={admin.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar fullName={admin.fullName} />
                          <div>
                            <p className="font-medium text-ink">
                              {admin.fullName}
                            </p>
                            <p className="font-data text-body text-ink-soft">
                              @{admin.username}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <span className="text-body text-ink-soft">
                          {admin.role === "super_admin"
                            ? "Super Admin"
                            : "Admin"}
                        </span>
                      </TD>
                      <TD>
                        {admin.telegramHandle ? (
                          <span className="font-medium text-ink">
                            {admin.telegramHandle}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Belum ditautkan</span>
                        )}
                      </TD>
                      <TD>
                        <DataValue emphasis>{admin.handledCount}</DataValue>
                      </TD>
                      <TD>
                        {admin.active ? (
                          <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                            Aktif
                          </Tag>
                        ) : (
                          <Tag className="border-refused-edge bg-refused-wash text-refused-ink">
                            Diblokir
                          </Tag>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${admin.fullName}`}
                            onClick={() => {
                              setCreating(false);
                              setEditing({ ...admin, password: "" });
                            }}
                          >
                            <Pencil className="size-4 text-action" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(admin)}
                          >
                            {admin.active ? "Blokir" : "Aktifkan"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Hapus ${admin.fullName}`}
                            onClick={() => handleDelete(admin)}
                          >
                            <Trash2 className="size-4 text-refused-ink" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <p className="border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              Menampilkan {filtered.length} dari {admins.length} admin
            </p>
          </>
        ) : (
          <EmptyState
            title={
              admins.length === 0
                ? "Belum ada admin"
                : "Tidak ada admin yang cocok"
            }
            description={
              admins.length === 0
                ? "Tambahkan admin agar order bisa diproses lewat Telegram."
                : "Coba ubah kata kunci pencarian."
            }
            action={
              admins.length === 0 ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" aria-hidden="true" />
                  Tambah Admin
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
          <AdminFormDialog
            admin={editing}
            creating={creating}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={handleSave}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function AdminFormDialog({
  admin,
  creating,
  onCancel,
  onSave,
}: {
  admin: AdminDraft;
  creating: boolean;
  onCancel: () => void;
  onSave: (admin: AdminDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(admin);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    fullName?: string;
    username?: string;
    password?: string;
  }>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.fullName.trim()) {
      nextErrors.fullName = "Masukkan nama lengkap admin.";
    }
    if (creating && !draft.username.trim()) {
      nextErrors.username = "Masukkan username unik.";
    }
    if (creating && (!draft.password || draft.password.length < 8)) {
      nextErrors.password = "Password minimal 8 karakter.";
    }
    if (
      !creating &&
      draft.password &&
      draft.password.length > 0 &&
      draft.password.length < 8
    ) {
      nextErrors.password = "Password minimal 8 karakter.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        ...draft,
        fullName: draft.fullName.trim(),
        username: draft.username.trim().toLowerCase(),
        role: draft.role ?? "admin",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={creating ? "Tambah admin" : "Edit admin"}
      description="Telegram ditautkan sendiri oleh admin di halaman Security setelah login."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="submit"
            form="admin-form"
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan
          </Button>
        </>
      }
    >
      <form
        id="admin-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        <Field
          label="Nama lengkap"
          htmlFor="fullName"
          required
          error={errors.fullName}
        >
          <Input
            id="fullName"
            value={draft.fullName}
            invalid={Boolean(errors.fullName)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
          />
        </Field>
        <Field
          label="Username"
          htmlFor="username"
          required={creating}
          error={errors.username}
        >
          <Input
            id="username"
            value={draft.username}
            className="font-data"
            disabled={!creating}
            invalid={Boolean(errors.username)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                username: event.target.value,
              }))
            }
          />
        </Field>
        <Field
          label={creating ? "Password" : "Password baru"}
          htmlFor="password"
          required={creating}
          error={errors.password}
          hint={creating ? undefined : "Kosongkan jika tidak diganti."}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={draft.password ?? ""}
            invalid={Boolean(errors.password)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Role" htmlFor="role">
          <Select
            id="role"
            value={draft.role ?? "admin"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                role: value as "admin" | "super_admin",
              }))
            }
            options={[
              { value: "admin", label: "Admin (operator)" },
              { value: "super_admin", label: "Super Admin" },
            ]}
          />
        </Field>
        {!creating ? (
          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={draft.active ? "active" : "blocked"}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  active: value === "active",
                }))
              }
              options={[
                { value: "active", label: "Aktif" },
                { value: "blocked", label: "Diblokir" },
              ]}
            />
          </Field>
        ) : null}
      </form>
    </DialogContent>
  );
}
