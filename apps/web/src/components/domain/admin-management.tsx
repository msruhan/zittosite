"use client";

import * as React from "react";
import {
  Check,
  Copy,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
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
import { passwordPolicyError } from "@/lib/password";
import type { Admin } from "@/lib/types";

type AdminDraft = Admin & { password?: string; totpCode?: string };

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: (totpCode: string) => Promise<void>;
};

const TOTP_HINT = "Wajib bila Google Authenticator aktif di akun Anda.";

function totpHeaders(code?: string): HeadersInit {
  const trimmed = code?.replace(/\s/g, "");
  return trimmed ? { "X-TOTP-Code": trimmed } : {};
}

type InviteLink = { admin: Admin; botUrl: string; expiresAt: string };

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function isOperator(admin: Pick<Admin, "role">) {
  return (admin.role ?? "admin") === "admin";
}

export function AdminManagement({
  initialAdmins,
}: {
  initialAdmins: Admin[];
}) {
  const [admins, setAdmins] = React.useState(initialAdmins);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<AdminDraft | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [confirm, setConfirm] = React.useState<PendingConfirm | null>(null);
  const [inviteLink, setInviteLink] = React.useState<InviteLink | null>(null);

  const [syncedAdmins, setSyncedAdmins] = React.useState(initialAdmins);
  if (initialAdmins !== syncedAdmins) {
    setSyncedAdmins(initialAdmins);
    setAdmins(initialAdmins);
  }

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
    const password =
      !isOperator(next) && next.password ? next.password : undefined;
    try {
      if (creating) {
        await api("/admin/admins", {
          method: "POST",
          headers: totpHeaders(next.totpCode),
          body: JSON.stringify({
            username: next.username,
            fullName: next.fullName,
            role: next.role ?? "admin",
            ...(password ? { password } : {}),
          }),
        });
      } else {
        await api(`/admin/admins/${next.id}`, {
          method: "PATCH",
          headers: totpHeaders(next.totpCode),
          body: JSON.stringify({
            fullName: next.fullName,
            role: next.role,
            status: next.active ? "active" : "blocked",
            ...(password ? { password } : {}),
          }),
        });
      }
      await reload();
      setEditing(null);
      setCreating(false);
      if (creating && isOperator(next)) {
        toast.success("Operator ditambahkan", {
          description:
            "Klik “Buat undangan” di kolom Telegram untuk menautkan akun Telegram-nya.",
        });
      } else {
        toast.success(creating ? "Admin ditambahkan" : "Perubahan disimpan");
      }
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
    }
  }

  async function runQuiet(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await reload();
      toast.success(success);
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Aksi gagal",
      });
    }
  }

  function handleCreateInvite(admin: Admin) {
    setConfirm({
      title: "Buat undangan Telegram",
      description: `Link sekali pakai untuk ${admin.fullName}, berlaku 24 jam. Undangan lama otomatis dibatalkan.`,
      confirmLabel: "Buat link",
      run: async (totpCode) => {
        const result = await api<{ botUrl: string; expiresAt: string }>(
          `/admin/admins/${admin.id}/telegram/invite`,
          { method: "POST", headers: totpHeaders(totpCode) },
        );
        await reload();
        setInviteLink({ admin, ...result });
      },
    });
  }

  function handleRevokeInvite(admin: Admin) {
    void runQuiet(
      () =>
        api(`/admin/admins/${admin.id}/telegram/invite`, { method: "DELETE" }),
      "Undangan dibatalkan",
    );
  }

  function handleApprove(admin: Admin) {
    const who = admin.telegramInvite?.telegramUsername
      ? `@${admin.telegramInvite.telegramUsername}`
      : `ID ${admin.telegramInvite?.telegramUserId ?? "-"}`;
    setConfirm({
      title: "Setujui tautan Telegram",
      description: `Telegram ${who} akan menerima dan memproses order sebagai ${admin.fullName}.`,
      confirmLabel: "Setujui",
      run: async (totpCode) => {
        await api(`/admin/admins/${admin.id}/telegram/approve`, {
          method: "POST",
          headers: totpHeaders(totpCode),
        });
        await reload();
        toast.success("Operator tertaut", {
          description: `${admin.fullName} sekarang menerima order di Telegram.`,
        });
      },
    });
  }

  function handleReject(admin: Admin) {
    void runQuiet(
      () =>
        api(`/admin/admins/${admin.id}/telegram/reject`, { method: "POST" }),
      "Permintaan ditolak",
    );
  }

  function handleUnlink(admin: Admin) {
    setConfirm({
      title: "Putuskan Telegram",
      description: `${admin.fullName} berhenti menerima order di Telegram sampai ditautkan lagi lewat undangan baru.`,
      confirmLabel: "Putuskan",
      danger: true,
      run: async (totpCode) => {
        await api(`/admin/admins/${admin.id}/telegram`, {
          method: "DELETE",
          headers: totpHeaders(totpCode),
        });
        await reload();
        toast.success("Telegram diputuskan");
      },
    });
  }

  function handleToggle(admin: Admin) {
    const access = isOperator(admin) ? "memproses order di Telegram" : "login";
    setConfirm({
      title: admin.active ? "Blokir admin" : "Aktifkan admin",
      description: `${admin.fullName} ${admin.active ? "tidak akan bisa" : "akan kembali bisa"} ${access}.`,
      confirmLabel: admin.active ? "Blokir" : "Aktifkan",
      danger: admin.active,
      run: async (totpCode) => {
        await api(`/admin/admins/${admin.id}`, {
          method: "PATCH",
          headers: totpHeaders(totpCode),
          body: JSON.stringify({
            status: admin.active ? "blocked" : "active",
          }),
        });
        await reload();
        toast.success(admin.active ? "Admin diblokir" : "Admin diaktifkan", {
          description: `${admin.fullName} ${admin.active ? "tidak lagi" : "kembali"} dapat login.`,
        });
      },
    });
  }

  function handleDelete(admin: Admin) {
    setConfirm({
      title: "Hapus admin",
      description: `${admin.fullName} akan kehilangan akses. Admin dengan riwayat order diblokir, bukan dihapus.`,
      confirmLabel: "Hapus",
      danger: true,
      run: async (totpCode) => {
        const result = await api<{
          deleted: boolean;
          blocked?: boolean;
          message?: string;
        }>(`/admin/admins/${admin.id}`, {
          method: "DELETE",
          headers: totpHeaders(totpCode),
        });
        await reload();
        toast.success(result.deleted ? "Admin dihapus" : "Admin diblokir", {
          description:
            result.message ?? `${admin.fullName} tidak lagi memiliki akses.`,
        });
      },
    });
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
                            : "Operator"}
                        </span>
                      </TD>
                      <TD>
                        <TelegramCell
                          admin={admin}
                          onInvite={() => handleCreateInvite(admin)}
                          onRevoke={() => handleRevokeInvite(admin)}
                          onApprove={() => handleApprove(admin)}
                          onReject={() => handleReject(admin)}
                          onUnlink={() => handleUnlink(admin)}
                        />
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
                            <PencilSimple className="size-4 text-action" />
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

      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        {confirm ? (
          <TotpConfirmDialog
            pending={confirm}
            onDone={() => setConfirm(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(inviteLink)}
        onOpenChange={(open) => {
          if (!open) setInviteLink(null);
        }}
      >
        {inviteLink ? (
          <InviteLinkDialog
            invite={inviteLink}
            onDone={() => setInviteLink(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function TelegramCell({
  admin,
  onInvite,
  onRevoke,
  onApprove,
  onReject,
  onUnlink,
}: {
  admin: Admin;
  onInvite: () => void;
  onRevoke: () => void;
  onApprove: () => void;
  onReject: () => void;
  onUnlink: () => void;
}) {
  const invite = admin.telegramInvite;
  const linked = admin.telegramLinked ?? Boolean(admin.telegramHandle);

  if (!isOperator(admin)) {
    return linked ? (
      <span className="font-medium text-ink">
        {admin.telegramHandle ?? "Tertaut"}
      </span>
    ) : (
      <span className="text-ink-faint">Belum ditautkan</span>
    );
  }

  if (linked) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-ink">
          {admin.telegramHandle ?? "Tertaut"}
        </span>
        <Button size="sm" variant="ghost" onClick={onUnlink}>
          Putuskan
        </Button>
      </div>
    );
  }

  if (invite?.status === "claimed") {
    const who = invite.telegramUsername
      ? `@${invite.telegramUsername}`
      : (invite.telegramName ?? `ID ${invite.telegramUserId ?? "-"}`);
    return (
      <div className="space-y-1">
        <p className="text-body text-ink">
          Menunggu persetujuan:{" "}
          <span className="font-medium">{who}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={onApprove}>
            Setujui
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            Tolak
          </Button>
        </div>
      </div>
    );
  }

  if (invite?.status === "pending") {
    return (
      <div className="space-y-1">
        <p className="text-body text-ink-soft">
          Undangan aktif s/d {dateTime.format(new Date(invite.expiresAt))}
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onInvite}>
            Buat ulang
          </Button>
          <Button size="sm" variant="ghost" onClick={onRevoke}>
            Batalkan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onInvite}
      disabled={!admin.active}
    >
      Buat undangan
    </Button>
  );
}

function InviteLinkDialog({
  invite,
  onDone,
}: {
  invite: InviteLink;
  onDone: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invite.botUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tidak dapat menyalin", {
        description: "Salin link secara manual.",
      });
    }
  }

  return (
    <DialogContent
      title="Link undangan Telegram"
      description={`Kirim link ini hanya ke ${invite.admin.fullName} lewat chat pribadi. Berlaku sampai ${dateTime.format(new Date(invite.expiresAt))} dan hanya bisa dipakai sekali.`}
      footer={
        <Button type="button" onClick={onDone}>
          Selesai
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={invite.botUrl}
            aria-label="Link undangan"
            className="font-data text-body"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={copied ? "Tersalin" : "Salin link"}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="size-4 text-cleared-ink" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-body text-ink-soft">
          <li>Operator membuka link, lalu menekan Start di bot.</li>
          <li>
            Anda menerima permintaan persetujuan di Telegram, atau di kolom
            Telegram halaman ini.
          </li>
          <li>Setelah disetujui, order baru langsung masuk ke Telegram operator.</li>
        </ol>
      </div>
    </DialogContent>
  );
}

function TotpConfirmDialog({
  pending,
  onDone,
}: {
  pending: PendingConfirm;
  onDone: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await pending.run(code);
      onDone();
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Aksi gagal",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent
      title={pending.title}
      description={pending.description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onDone}>
            Batal
          </Button>
          <Button
            type="submit"
            form="totp-confirm-form"
            variant={pending.danger ? "danger" : "primary"}
            loading={busy}
            loadingLabel="Memproses"
          >
            {pending.confirmLabel}
          </Button>
        </>
      }
    >
      <form id="totp-confirm-form" onSubmit={handleSubmit} noValidate>
        <TotpField value={code} onChange={setCode} />
      </form>
    </DialogContent>
  );
}

function TotpField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Kode Google Authenticator" htmlFor="totpCode" hint={TOTP_HINT}>
      <Input
        id="totpCode"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        className="font-data tracking-widest"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      />
    </Field>
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
  const operator = isOperator(draft);
  const needsPassword =
    !operator && (creating || isOperator(admin));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.fullName.trim()) {
      nextErrors.fullName = "Masukkan nama lengkap admin.";
    }
    if (creating && !draft.username.trim()) {
      nextErrors.username = "Masukkan username unik.";
    }
    if (needsPassword || (!operator && draft.password)) {
      const policyError = passwordPolicyError(draft.password ?? "");
      if (policyError) nextErrors.password = policyError;
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
      description={
        operator
          ? "Operator tidak login ke website. Tautkan Telegram-nya lewat link undangan setelah akun dibuat."
          : "Super Admin login ke website dan menautkan Telegram sendiri di halaman Security."
      }
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
              { value: "admin", label: "Operator (hanya bot Telegram)" },
              { value: "super_admin", label: "Super Admin" },
            ]}
          />
        </Field>
        {!operator ? (
          <Field
            label={needsPassword ? "Password" : "Password baru"}
            htmlFor="password"
            required={needsPassword}
            error={errors.password}
            hint={needsPassword ? undefined : "Kosongkan jika tidak diganti."}
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
        ) : null}
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
        <TotpField
          value={draft.totpCode ?? ""}
          onChange={(totpCode) =>
            setDraft((current) => ({ ...current, totpCode }))
          }
        />
      </form>
    </DialogContent>
  );
}
