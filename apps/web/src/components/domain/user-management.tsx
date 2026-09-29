"use client";

import * as React from "react";
import { MagnifyingGlass, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
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
import { formatDate, formatRupiah } from "@/lib/format";
import { ApiError, api } from "@/lib/api";
import { passwordPolicyError } from "@/lib/password";
import type { Service, User } from "@/lib/types";

export function UserManagement({
  initialUsers,
  services,
}: {
  initialUsers: User[];
  services: Service[];
}) {
  const [users, setUsers] = React.useState(initialUsers);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<User | null>(null);
  const [creating, setCreating] = React.useState(false);

  const [syncedUsers, setSyncedUsers] = React.useState(initialUsers);
  if (initialUsers !== syncedUsers) {
    setSyncedUsers(initialUsers);
    setUsers(initialUsers);
  }

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle) ||
        (user.telegramHandle ?? "").toLowerCase().includes(needle),
    );
  }, [users, query]);

  async function reload() {
    const next = await api<User[]>("/admin/users");
    setUsers(next);
  }

  async function handleSave(next: User & { password?: string }) {
    try {
      if (creating) {
        await api("/admin/users", {
          method: "POST",
          body: JSON.stringify({
            username: next.username,
            fullName: next.fullName,
            password: next.password,
            telegramHandle: next.telegramHandle,
            customPrices: next.customPrices ?? [],
            botAccess: next.botAccess,
          }),
        });
      } else {
        await api(`/admin/users/${next.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: next.fullName,
            telegramHandle: next.telegramHandle,
            customPrices: next.customPrices ?? [],
            status: next.status,
            botAccess: next.botAccess,
            ...(next.password ? { password: next.password } : {}),
          }),
        });
      }
      await reload();
      setEditing(null);
      setCreating(false);
      toast.success(
        creating
          ? "User ditambahkan"
          : next.password
            ? "Password user diganti"
            : "Perubahan disimpan",
        !creating && next.password
          ? { description: "Sesi login user lama sudah dikeluarkan." }
          : undefined,
      );
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
    }
  }

  async function handleDelete(user: User) {
    try {
      const result = await api<{
        deleted: boolean;
        suspended?: boolean;
        message?: string;
      }>(`/admin/users/${user.id}`, { method: "DELETE" });
      await reload();
      toast.success(
        result.deleted ? "User dihapus" : "User di-suspend",
        {
          description:
            result.message ?? `${user.fullName} tidak lagi memiliki akses penuh.`,
        },
      );
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Hapus gagal",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari user</span>
          <MagnifyingGlass
            aria-hidden="true"
            weight="regular"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, username, atau Telegram"
            className="pl-9"
          />
        </label>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing({
              id: `usr-${Date.now()}`,
              username: "",
              fullName: "",
              telegramHandle: null,
              customPrices: [],
              status: "active",
              botAccess: true,
              createdAt: new Date().toISOString(),
            });
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah User
        </Button>
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>No</TH>
                    <TH>User</TH>
                    <TH>Telegram</TH>
                    <TH>Harga khusus</TH>
                    <TH>Status</TH>
                    <TH>Bot</TH>
                    <TH>Bergabung</TH>
                    <TH className="w-24">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((user, index) => (
                    <TR key={user.id}>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {index + 1}
                        </DataValue>
                      </TD>
                      <TD>
                        <div>
                          <p className="font-medium text-ink">{user.fullName}</p>
                          <p className="font-data text-body text-ink-soft">
                            @{user.username}
                          </p>
                        </div>
                      </TD>
                      <TD>
                        {user.telegramHandle ? (
                          <span className="font-medium text-ink">
                            {user.telegramHandle}
                          </span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </TD>
                      <TD>
                        <CustomPriceSummary user={user} services={services} />
                      </TD>
                      <TD>
                        {user.status === "active" ? (
                          <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                            Aktif
                          </Tag>
                        ) : (
                          <Tag className="border-refused-edge bg-refused-wash text-refused-ink">
                            Suspended
                          </Tag>
                        )}
                      </TD>
                      <TD>
                        <Tag>{user.botAccess ? "Aktif" : "Nonaktif"}</Tag>
                      </TD>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {formatDate(user.createdAt)}
                        </DataValue>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${user.fullName}`}
                            onClick={() => {
                              setCreating(false);
                              setEditing(user);
                            }}
                          >
                            <PencilSimple className="size-4 text-action" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Hapus ${user.fullName}`}
                            onClick={() => handleDelete(user)}
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
              Menampilkan {filtered.length} dari {users.length} user
            </p>
          </>
        ) : (
          <EmptyState
            title={users.length === 0 ? "Belum ada user terdaftar" : "Tidak ada user yang cocok"}
            description={
              users.length === 0
                ? "Tambahkan user pertama untuk mulai menerima order."
                : "Coba ubah kata kunci pencarian."
            }
            action={
              users.length === 0 ? undefined : (
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
          <UserFormDialog
            user={editing}
            services={services}
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

function CustomPriceSummary({
  user,
  services,
}: {
  user: User;
  services: Service[];
}) {
  const overrides = (user.customPrices ?? [])
    .map((p) => ({
      ...p,
      service: services.find((s) => s.id === p.serviceId),
    }))
    .filter((p) => p.service);
  if (overrides.length === 0) {
    return <span className="text-ink-soft">Default</span>;
  }
  return (
    <ul className="space-y-0.5">
      {overrides.map((p) => (
        <li key={p.serviceId} className="whitespace-nowrap text-body">
          <span className="text-ink-soft">{p.service!.name}: </span>
          <DataValue>{formatRupiah(p.price)}</DataValue>
        </li>
      ))}
    </ul>
  );
}

function UserFormDialog({
  user,
  services,
  creating,
  onCancel,
  onSave,
}: {
  user: User;
  services: Service[];
  creating: boolean;
  onCancel: () => void;
  onSave: (user: User & { password?: string }) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(user);
  const [password, setPassword] = React.useState("");
  const [prices, setPrices] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      (user.customPrices ?? []).map((p) => [p.serviceId, String(p.price)]),
    ),
  );
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    fullName?: string;
    username?: string;
    password?: string;
  }>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!creating && !draft.fullName.trim()) {
      nextErrors.fullName = "Masukkan nama lengkap user.";
    }
    if (!draft.username.trim()) {
      nextErrors.username = "Masukkan username unik.";
    }
    const policyError =
      creating || password ? passwordPolicyError(password) : null;
    if (policyError) nextErrors.password = policyError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        ...draft,
        fullName: draft.fullName.trim(),
        username: draft.username.trim(),
        telegramHandle: draft.telegramHandle?.trim() || null,
        customPrices: Object.entries(prices)
          .filter(([, value]) => value !== "")
          .map(([serviceId, value]) => ({ serviceId, price: Number(value) })),
        ...(password ? { password } : {}),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={creating ? "Tambah user" : "Edit user"}
      description={
        creating
          ? "Akun baru akan langsung bisa login ke portal user."
          : "Kosongkan password jika tidak ingin mengubahnya."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="submit"
            form="user-form"
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {creating ? null : (
          <Field label="Nama lengkap" htmlFor="fullName" required error={errors.fullName}>
            <Input
              id="fullName"
              value={draft.fullName}
              invalid={Boolean(errors.fullName)}
              onChange={(event) =>
                setDraft((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </Field>
        )}
        <Field label="Username" htmlFor="username" required error={errors.username}>
          <Input
            id="username"
            value={draft.username}
            className="font-data"
            invalid={Boolean(errors.username)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, username: event.target.value }))
            }
          />
        </Field>
        <Field
          label={creating ? "Password" : "Password baru"}
          htmlFor="password"
          hint={
            creating
              ? "Password awal untuk login user."
              : "Isi untuk mengganti password user. User akan keluar dari semua perangkat dan login dengan password baru. Kosongkan jika tidak diganti."
          }
          error={errors.password}
          required={creating}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={creating ? "Masukkan password" : "Ketik password baru"}
            value={password}
            invalid={Boolean(errors.password)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Username Telegram" htmlFor="telegram">
          <Input
            id="telegram"
            value={draft.telegramHandle ?? ""}
            placeholder="@username"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                telegramHandle: event.target.value,
              }))
            }
          />
        </Field>
        {services.length > 0 ? (
          <fieldset className="space-y-3 rounded-md border border-hairline p-3.5">
            <legend className="px-1 text-body font-medium text-ink">
              Harga khusus per layanan
            </legend>
            <p className="text-body text-ink-soft">
              Kosongkan untuk mengikuti harga default di menu Services.
            </p>
            {services.map((service) => (
              <Field
                key={service.id}
                label={service.name}
                htmlFor={`price-${service.id}`}
                hint={`Default ${formatRupiah(service.price)}${service.active ? "" : " · layanan nonaktif"}`}
              >
                <Input
                  id={`price-${service.id}`}
                  inputMode="numeric"
                  className="font-data tabular"
                  value={prices[service.id] ?? ""}
                  placeholder={String(service.price)}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "");
                    setPrices((current) => ({ ...current, [service.id]: raw }));
                  }}
                />
              </Field>
            ))}
          </fieldset>
        ) : null}
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                status: value as User["status"],
              }))
            }
            options={[
              { value: "active", label: "Aktif" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
        </Field>
        <Field label="Akses bot" htmlFor="botAccess">
          <Select
            id="botAccess"
            value={draft.botAccess ? "1" : "0"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                botAccess: value === "1",
              }))
            }
            options={[
              { value: "1", label: "Aktif" },
              { value: "0", label: "Nonaktif" },
            ]}
          />
        </Field>
      </form>
    </DialogContent>
  );
}
