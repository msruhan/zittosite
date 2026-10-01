"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Supplier } from "@/lib/types";

type SupplierDraft = {
  id: string | null;
  name: string;
  baseUrl: string;
  username: string;
  apiKey: string;
  isActive: boolean;
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function SupplierManagement({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = React.useState(initialSuppliers);
  const [editing, setEditing] = React.useState<SupplierDraft | null>(null);
  const [deleting, setDeleting] = React.useState<Supplier | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function reload() {
    setSuppliers(await api<Supplier[]>("/admin/suppliers"));
    router.refresh();
  }

  function openEdit(supplier?: Supplier) {
    setEditing({
      id: supplier?.id ?? null,
      name: supplier?.name ?? "",
      baseUrl: supplier?.baseUrl ?? "",
      username: supplier?.username ?? "",
      apiKey: "",
      isActive: supplier?.isActive ?? true,
    });
  }

  async function handleTest(supplier: Supplier) {
    setTestingId(supplier.id);
    try {
      const updated = await api<Supplier>(`/admin/suppliers/${supplier.id}/test`, {
        method: "POST",
      });
      setSuppliers((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      if (updated.lastError) {
        toast.error("Koneksi gagal", { description: updated.lastError });
      } else if (updated.remoteServiceCount === 0) {
        toast.warning("Terhubung, tetapi supplier tidak membuka layanan", {
          description: `Saldo terbaca (${updated.lastBalance ?? "-"}), namun ${updated.name} mengirim daftar layanan kosong. Aktifkan dan beri harga layanan di panel supplier, lalu sinkron ulang.`,
        });
      } else {
        toast.success("Terhubung", {
          description: `Saldo di ${updated.name}: ${updated.lastBalance ?? "-"} · ${updated.remoteServiceCount ?? 0} layanan tersedia`,
        });
      }
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Tes koneksi gagal") });
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(supplier: Supplier) {
    setBusy(true);
    try {
      await api(`/admin/suppliers/${supplier.id}`, { method: "DELETE" });
      await reload();
      setDeleting(null);
      toast.success("Supplier dihapus");
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Hapus gagal") });
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button onClick={() => openEdit()}>
      <Plus className="size-4" aria-hidden="true" />
      Tambah Supplier
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{addButton}</div>

      <Card>
        {suppliers.length ? (
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Supplier</TH>
                  <TH>Akun</TH>
                  <TH>Saldo</TH>
                  <TH>Layanan</TH>
                  <TH>Status</TH>
                  <TH className="w-32">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {suppliers.map((supplier) => (
                  <TR key={supplier.id}>
                    <TD>
                      <p className="font-medium text-ink">{supplier.name}</p>
                      <p className="mt-0.5 max-w-xs truncate font-data text-label text-ink-soft">
                        {supplier.baseUrl}
                      </p>
                    </TD>
                    <TD>
                      <p className="font-data text-body text-ink">{supplier.username}</p>
                      <p className="font-data text-label text-ink-faint">{supplier.apiKeyHint}</p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {supplier.lastError ? (
                        <p className="max-w-56 text-label text-refused-ink">{supplier.lastError}</p>
                      ) : (
                        <DataValue emphasis>{supplier.lastBalance ?? "—"}</DataValue>
                      )}
                      <p className="text-label text-ink-faint">
                        {supplier.lastCheckedAt
                          ? `Dicek ${formatDateTime(supplier.lastCheckedAt)}`
                          : "Belum dites"}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      <p className="text-body text-ink">
                        <DataValue emphasis>{supplier.remoteServiceCount ?? "—"}</DataValue>{" "}
                        <span className="text-ink-soft">tersedia</span>
                      </p>
                      <p className="text-label text-ink-faint">
                        {supplier.remoteServiceCount === null ? (
                          "Sinkron untuk membaca layanan"
                        ) : supplier.remoteServiceCount === 0 ? (
                          <span className="text-hold-ink">Supplier belum membuka layanan</span>
                        ) : supplier.serviceCount > 0 ? (
                          `${supplier.serviceCount} terhubung ke layanan`
                        ) : (
                          <Link href="/admin/services" className="text-action hover:underline">
                            Belum terhubung · atur di Services
                          </Link>
                        )}
                      </p>
                    </TD>
                    <TD>
                      {supplier.isActive ? (
                        <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                          Aktif
                        </Tag>
                      ) : (
                        <Tag>Nonaktif</Tag>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Tes koneksi ${supplier.name}`}
                          loading={testingId === supplier.id}
                          onClick={() => void handleTest(supplier)}
                        >
                          <ArrowsClockwise className="size-4 text-action" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${supplier.name}`}
                          onClick={() => openEdit(supplier)}
                        >
                          <PencilSimple className="size-4 text-action" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Hapus ${supplier.name}`}
                          onClick={() => setDeleting(supplier)}
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
            title="Belum ada supplier"
            description="Tambahkan panel Dhru Fusion (URL, username, API key), lalu pilih jalur API Supplier di layanan."
            action={addButton}
          />
        )}
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <SupplierFormDialog
            draft={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              await reload();
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <DialogContent
            title={`Hapus ${deleting.name}?`}
            description="Supplier yang masih dipakai layanan tidak bisa dihapus. Nonaktifkan saja jika hanya ingin menghentikan sementara."
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
                  Hapus supplier
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

function SupplierFormDialog({
  draft: initial,
  onCancel,
  onSaved,
}: {
  draft: SupplierDraft;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof SupplierDraft, string>>>({});
  const creating = draft.id === null;

  function set<K extends keyof SupplierDraft>(key: K, value: SupplierDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = "Masukkan nama supplier.";
    if (!/^https?:\/\/\S+$/i.test(draft.baseUrl.trim())) {
      next.baseUrl = "Masukkan URL lengkap, mis. https://api.supplier.com";
    }
    if (!draft.username.trim()) next.username = "Masukkan username akun di supplier.";
    if (creating && !draft.apiKey.trim()) next.apiKey = "Masukkan API key dari supplier.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const body = JSON.stringify({
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        username: draft.username.trim(),
        isActive: draft.isActive,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      });
      if (creating) {
        await api("/admin/suppliers", { method: "POST", body });
      } else {
        await api(`/admin/suppliers/${draft.id}`, { method: "PATCH", body });
      }
      await onSaved();
      toast.success(creating ? "Supplier ditambahkan" : "Supplier diperbarui", {
        description: "Klik tombol tes koneksi untuk mengecek saldo.",
      });
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={creating ? "Tambah supplier" : "Edit supplier"}
      description="Kredensial API Dhru Fusion dari akun reseller Anda di supplier."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" form="supplier-form" loading={saving} loadingLabel="Menyimpan">
            Simpan
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nama supplier" htmlFor="supplierName" required error={errors.name}>
          <Input
            id="supplierName"
            value={draft.name}
            placeholder="CeirBot"
            invalid={Boolean(errors.name)}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field
          label="URL API"
          htmlFor="supplierUrl"
          required
          error={errors.baseUrl}
          hint="Domain API supplier. /api/index.php ditambahkan otomatis."
        >
          <Input
            id="supplierUrl"
            className="font-data"
            value={draft.baseUrl}
            placeholder="https://api.infoceir.com"
            invalid={Boolean(errors.baseUrl)}
            onChange={(event) => set("baseUrl", event.target.value)}
          />
        </Field>
        <Field label="Username" htmlFor="supplierUsername" required error={errors.username}>
          <Input
            id="supplierUsername"
            className="font-data"
            value={draft.username}
            autoComplete="off"
            invalid={Boolean(errors.username)}
            onChange={(event) => set("username", event.target.value)}
          />
        </Field>
        <Field
          label="API key"
          htmlFor="supplierKey"
          required={creating}
          error={errors.apiKey}
          hint={
            creating
              ? "Disimpan terenkripsi."
              : "Kosongkan jika tidak diganti. Disimpan terenkripsi."
          }
        >
          <Input
            id="supplierKey"
            type="password"
            className="font-data"
            value={draft.apiKey}
            autoComplete="new-password"
            invalid={Boolean(errors.apiKey)}
            onChange={(event) => set("apiKey", event.target.value)}
          />
        </Field>
        <Field label="Status" htmlFor="supplierActive">
          <Select
            id="supplierActive"
            value={draft.isActive ? "1" : "0"}
            onValueChange={(value) => set("isActive", value === "1")}
            options={[
              { value: "1", label: "Aktif — order diteruskan" },
              { value: "0", label: "Nonaktif — order tertahan di antrean" },
            ]}
          />
        </Field>
      </form>
    </DialogContent>
  );
}
