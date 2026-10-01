"use client";

import * as React from "react";
import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  Wallet,
} from "@phosphor-icons/react";
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
import type { Service, User, UserGroup } from "@/lib/types";

const NO_GROUP = "__none";

export function UserManagement({
  initialUsers,
  services,
  groups,
}: {
  initialUsers: User[];
  services: Service[];
  groups: UserGroup[];
}) {
  const [users, setUsers] = React.useState(initialUsers);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<User | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState<User | null>(null);

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
        (user.telegramHandle ?? "").toLowerCase().includes(needle) ||
        (user.telegramLinked?.label ?? "").toLowerCase().includes(needle),
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
            groupId: next.groupId ?? null,
            role: next.role ?? "customer",
            botAccess: next.botAccess,
            apiEnabled: next.apiEnabled ?? false,
          }),
        });
      } else {
        await api(`/admin/users/${next.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: next.fullName,
            telegramHandle: next.telegramHandle,
            customPrices: next.customPrices ?? [],
            groupId: next.groupId ?? null,
            role: next.role ?? "customer",
            status: next.status,
            botAccess: next.botAccess,
            apiEnabled: next.apiEnabled ?? false,
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
              groupId: null,
              role: "customer",
              status: "active",
              botAccess: true,
              apiEnabled: false,
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
                    <TH>Group</TH>
                    <TH>Saldo</TH>
                    <TH>Status</TH>
                    <TH>Bot</TH>
                    <TH>Akses API</TH>
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
                          <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                            {user.fullName}
                            {user.role === "testing" ? (
                              <Tag className="border-working-edge bg-working-wash text-working-ink">🧪 Testing</Tag>
                            ) : null}
                          </p>
                          <p className="font-data text-body text-ink-soft">
                            @{user.username}
                          </p>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {user.telegramLinked ? (
                          <div>
                            <p className="font-medium text-ink">
                              {user.telegramLinked.label}
                            </p>
                            <p
                              className={
                                user.telegramLinked.chatReady
                                  ? "text-label text-cleared-ink"
                                  : "text-label text-hold-ink"
                              }
                            >
                              {user.telegramLinked.chatReady
                                ? "Tertaut"
                                : "Tertaut, bot belum di-start"}
                            </p>
                          </div>
                        ) : user.telegramHandle ? (
                          <div>
                            <p className="font-medium text-ink">
                              {user.telegramHandle}
                            </p>
                            <p className="text-label text-ink-faint">
                              Belum tertaut
                            </p>
                          </div>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </TD>
                      <TD>
                        {user.groupName ? (
                          <Tag className="border-action bg-action-wash text-action-deep">
                            {user.groupName}
                          </Tag>
                        ) : (
                          <div className="whitespace-nowrap">
                            <p className="text-ink-soft">Tanpa group</p>
                            {(user.customPrices ?? []).length > 0 ? (
                              <p className="text-label text-hold-ink">
                                Harga khusus
                              </p>
                            ) : null}
                          </div>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <DataValue
                            className={
                              (user.creditBalance ?? 0) < 0
                                ? "text-refused-ink"
                                : undefined
                            }
                          >
                            {formatRupiah(user.creditBalance ?? 0)}
                          </DataValue>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Atur saldo ${user.fullName}`}
                            onClick={() => setAdjusting(user)}
                          >
                            <Wallet className="size-4 text-action" />
                          </Button>
                        </div>
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
                        {user.apiEnabled ? (
                          <Tag className="border-action bg-action-wash text-action-deep">
                            Aktif
                          </Tag>
                        ) : (
                          <Tag>Nonaktif</Tag>
                        )}
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
            groups={groups}
            creating={creating}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={handleSave}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(adjusting)}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null);
        }}
      >
        {adjusting ? (
          <BalanceDialog
            user={adjusting}
            onCancel={() => setAdjusting(null)}
            onDone={async () => {
              await reload();
              setAdjusting(null);
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function BalanceDialog({
  user,
  onCancel,
  onDone,
}: {
  user: User;
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [direction, setDirection] = React.useState<"add" | "subtract">("add");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ amount?: string; note?: string }>({});
  const current = user.creditBalance ?? 0;
  const value = Number(amount || 0);
  const next = direction === "add" ? current + value : current - value;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!value) nextErrors.amount = "Masukkan nominal lebih dari 0.";
    else if (direction === "subtract" && value > current) {
      nextErrors.amount = "Pengurangan melebihi saldo user.";
    }
    if (!note.trim()) nextErrors.note = "Tulis alasan perubahan saldo.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await api(`/admin/users/${user.id}/balance`, {
        method: "POST",
        body: JSON.stringify({
          amount: direction === "add" ? value : -value,
          note: note.trim(),
        }),
      });
      toast.success(
        direction === "add" ? "Saldo ditambahkan" : "Saldo dikurangi",
        { description: `Saldo ${user.fullName} sekarang ${formatRupiah(next)}.` },
      );
      await onDone();
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Ubah saldo gagal",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title="Atur saldo"
      description={`${user.fullName} (@${user.username}) · saldo saat ini ${formatRupiah(current)}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="submit"
            form="balance-form"
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan
          </Button>
        </>
      }
    >
      <form id="balance-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Jenis" htmlFor="balanceDirection">
          <Select
            id="balanceDirection"
            value={direction}
            onValueChange={(v) => setDirection(v as "add" | "subtract")}
            options={[
              { value: "add", label: "Tambah saldo" },
              { value: "subtract", label: "Kurangi saldo" },
            ]}
          />
        </Field>
        <Field
          label="Nominal (Rp)"
          htmlFor="balanceAmount"
          required
          error={errors.amount}
          hint={value ? `Saldo setelah disimpan: ${formatRupiah(next)}` : undefined}
        >
          <Input
            id="balanceAmount"
            inputMode="numeric"
            className="font-data tabular"
            placeholder="0"
            value={amount}
            invalid={Boolean(errors.amount)}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Catatan" htmlFor="balanceNote" required error={errors.note}>
          <Input
            id="balanceNote"
            maxLength={300}
            placeholder="Misalnya: koreksi refund manual"
            value={note}
            invalid={Boolean(errors.note)}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </form>
    </DialogContent>
  );
}

function UserFormDialog({
  user,
  services,
  groups,
  creating,
  onCancel,
  onSave,
}: {
  user: User;
  services: Service[];
  groups: UserGroup[];
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
  const selectedGroup = groups.find((group) => group.id === draft.groupId) ?? null;
  const hadCustomPrices = (user.customPrices ?? []).length > 0;
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
        groupId: draft.groupId || null,
        customPrices: draft.groupId
          ? []
          : Object.entries(prices)
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
        <Field
          label="Group"
          htmlFor="groupId"
          hint={
            groups.length
              ? "Member group memakai harga group; harga khusus pribadi tidak berlaku."
              : "Belum ada group. Buat di menu Groups."
          }
        >
          <Select
            id="groupId"
            value={draft.groupId ?? NO_GROUP}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                groupId: value === NO_GROUP ? null : value,
              }))
            }
            options={[
              { value: NO_GROUP, label: "Tanpa group" },
              ...groups.map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
        </Field>
        {selectedGroup ? (
          <div className="space-y-2 rounded-md border border-action/30 bg-action-wash px-3.5 py-3">
            <p className="text-body font-medium text-ink">
              Harga mengikuti {selectedGroup.name}
            </p>
            <ul className="space-y-0.5">
              {services.map((service) => {
                const groupPrice = selectedGroup.prices.find(
                  (p) => p.serviceId === service.id,
                )?.price;
                return (
                  <li key={service.id} className="flex justify-between gap-3 text-body">
                    <span className="text-ink-soft">{service.name}</span>
                    <DataValue>{formatRupiah(groupPrice ?? service.price)}</DataValue>
                  </li>
                );
              })}
            </ul>
            {hadCustomPrices ? (
              <p className="text-body text-working-ink">
                Harga khusus pribadi user ini akan dihapus saat disimpan.
              </p>
            ) : null}
          </div>
        ) : services.length > 0 ? (
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
        <Field
          label="Role"
          htmlFor="role"
          hint={
            draft.role === "testing"
              ? "Order akun ini tetap diproses & dibayar seperti biasa, tapi tidak dihitung di statistik dan pendapatan."
              : undefined
          }
        >
          <Select
            id="role"
            value={draft.role ?? "customer"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                role: value === "testing" ? "testing" : "customer",
              }))
            }
            options={[
              { value: "customer", label: "User" },
              { value: "testing", label: "Testing" },
            ]}
          />
        </Field>
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
        <Field
          label="Akses API"
          htmlFor="apiEnabled"
          hint="User dapat membuat API key dan menerima order dari website / panel Dhru miliknya. Order API dibayar dari saldo."
        >
          <Select
            id="apiEnabled"
            value={draft.apiEnabled ? "1" : "0"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                apiEnabled: value === "1",
              }))
            }
            options={[
              { value: "0", label: "Nonaktif" },
              { value: "1", label: "Aktif" },
            ]}
          />
        </Field>
      </form>
    </DialogContent>
  );
}
