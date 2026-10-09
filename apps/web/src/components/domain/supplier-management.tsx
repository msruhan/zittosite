"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowsClockwise,
  CurrencyCircleDollar,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatRupiah, formatUsd } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import type { Supplier, SupplierKind, SupplierPriceSync } from "@/lib/types";

const GCONTACT_URL = "https://gcontact.id/api";

type SupplierDraft = {
  id: string | null;
  kind: SupplierKind;
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
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [syncResult, setSyncResult] = React.useState<SupplierPriceSync | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const filtered = suppliers.filter((supplier) =>
    matchesSearch(query, [supplier.name, supplier.baseUrl, supplier.username]),
  );

  async function reload() {
    setSuppliers(await api<Supplier[]>("/admin/suppliers"));
    router.refresh();
  }

  function openEdit(supplier?: Supplier) {
    setEditing({
      id: supplier?.id ?? null,
      kind: supplier?.kind ?? "dhru",
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
      } else if (updated.kind === "gcontact") {
        toast.success("Token GContact valid", {
          description: updated.lastBalance
            ? `Sisa ${updated.lastBalance} (terbaca dari order terakhir).`
            : "Sisa kuota terbaca setelah order pertama.",
        });
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

  async function handleSync(supplier: Supplier) {
    setSyncingId(supplier.id);
    try {
      const result = await api<SupplierPriceSync>(`/admin/suppliers/${supplier.id}/sync`, {
        method: "POST",
      });
      setSyncResult(result);
      await reload();
    } catch (err) {
      toast.error("Sync gagal", { description: errorMessage(err, "Sync ulang harga gagal") });
    } finally {
      setSyncingId(null);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari supplier"
          placeholder="Cari nama, URL, atau username"
        />
        {addButton}
      </div>

      <Card>
        {suppliers.length && !filtered.length ? (
          <EmptyState
            title="Tidak ada supplier yang cocok"
            description={`Tidak ada supplier yang cocok dengan "${query.trim()}".`}
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                Reset pencarian
              </Button>
            }
          />
        ) : suppliers.length ? (
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Supplier</TH>
                  <TH>Akun</TH>
                  <TH>Saldo</TH>
                  <TH>Layanan</TH>
                  <TH>Status</TH>
                  <TH className="w-40">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((supplier) => (
                  <TR key={supplier.id}>
                    <TD>
                      <p className="font-medium text-ink">{supplier.name}</p>
                      <p className="mt-0.5 max-w-xs truncate font-data text-label text-ink-soft">
                        {supplier.baseUrl}
                      </p>
                    </TD>
                    <TD>
                      <p className="font-data text-body text-ink">
                        {supplier.kind === "gcontact" ? "GContact+ (token)" : supplier.username}
                      </p>
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
                        {supplier.kind === "dhru" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Sync ulang harga ${supplier.name}`}
                            title="Sync ulang harga dari panel supplier"
                            loading={syncingId === supplier.id}
                            disabled={syncingId !== null}
                            onClick={() => void handleSync(supplier)}
                          >
                            <CurrencyCircleDollar className="size-4 text-action" />
                          </Button>
                        ) : null}
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
            description="Tambahkan panel supplier API (URL, username, API key), lalu pilih jalur API Supplier di layanan."
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

      <Dialog open={Boolean(syncResult)} onOpenChange={(open) => !open && setSyncResult(null)}>
        {syncResult ? (
          <SyncResultDialog result={syncResult} onClose={() => setSyncResult(null)} />
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
  const gcontact = draft.kind === "gcontact";

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
    if (!gcontact && !draft.username.trim()) next.username = "Masukkan username akun di supplier.";
    if (creating && !draft.apiKey.trim()) {
      next.apiKey = gcontact ? "Masukkan token GContact." : "Masukkan API key dari supplier.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const body = JSON.stringify({
        ...(creating ? { kind: draft.kind } : {}),
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        ...(gcontact ? {} : { username: draft.username.trim() }),
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
      description="Kredensial API dari akun reseller Anda di supplier."
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
        <Field
          label="Jenis supplier"
          htmlFor="supplierKind"
          hint={
            creating
              ? gcontact
                ? "Cek nomor HP; hasil langsung keluar, satu order memakai satu kuota."
                : "Panel Dhru Fusion (iSpider, InfoCeir, nexusone, dll)."
              : "Jenis tidak bisa diubah setelah supplier dibuat."
          }
        >
          <Select
            id="supplierKind"
            value={draft.kind}
            disabled={!creating}
            onValueChange={(value) => {
              const kind = value as SupplierKind;
              setDraft((current) => ({
                ...current,
                kind,
                baseUrl:
                  kind === "gcontact" && !current.baseUrl.trim()
                    ? GCONTACT_URL
                    : kind === "dhru" && current.baseUrl === GCONTACT_URL
                      ? ""
                      : current.baseUrl,
              }));
              setErrors({});
            }}
            options={[
              { value: "dhru", label: "Dhru Fusion API" },
              { value: "gcontact", label: "GContact+ (cek nomor HP)" },
            ]}
          />
        </Field>
        <Field label="Nama supplier" htmlFor="supplierName" required error={errors.name}>
          <Input
            id="supplierName"
            value={draft.name}
            placeholder={gcontact ? "GContact" : "CeirBot"}
            invalid={Boolean(errors.name)}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field
          label="URL API"
          htmlFor="supplierUrl"
          required
          error={errors.baseUrl}
          hint={
            gcontact
              ? "Endpoint GContact, biarkan default."
              : "Domain API supplier. /api/index.php ditambahkan otomatis."
          }
        >
          <Input
            id="supplierUrl"
            className="font-data"
            value={draft.baseUrl}
            placeholder={gcontact ? GCONTACT_URL : "https://api.infoceir.com"}
            invalid={Boolean(errors.baseUrl)}
            onChange={(event) => set("baseUrl", event.target.value)}
          />
        </Field>
        {gcontact ? null : (
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
        )}
        <Field
          label={gcontact ? "Token" : "API key"}
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

function SyncList({ title, tone, items }: { title: string; tone?: string; items: React.ReactNode[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h3 className={`text-label font-bold uppercase ${tone ?? "text-ink-soft"}`}>
        {title} ({items.length})
      </h3>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-hairline px-3 py-2 text-body">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function SyncResultDialog({ result, onClose }: { result: SupplierPriceSync; onClose: () => void }) {
  const money = (amount: number, usd: boolean) => (usd ? formatUsd(amount) : formatRupiah(amount));
  return (
    <DialogContent
      title={`Sync harga ${result.supplierName}`}
      description={`${result.checked} layanan dicek · ${result.changed.length} harga modal berubah · ${result.unchanged} tetap. Harga jual tidak diubah.`}
      footer={<Button onClick={onClose}>Tutup</Button>}
    >
      <div className="space-y-4">
        {!result.changed.length && !result.offline.length && !result.belowCost.length ? (
          <p className="text-body text-ink-soft">Semua harga modal sudah sesuai panel supplier.</p>
        ) : null}
        <SyncList
          title="Harga modal berubah"
          items={result.changed.map((c) => (
            <span key={c.name} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-ink">{c.name}</span>
              <span className="shrink-0 font-data tabular text-ink-soft">
                {money(c.before, c.usd)} → <span className="text-ink">{money(c.after, c.usd)}</span>
              </span>
            </span>
          ))}
        />
        <SyncList
          title="Di-Offline-kan (tidak ada lagi di panel supplier)"
          tone="text-hold-ink"
          items={result.offline}
        />
        <SyncList
          title="Harga jual di bawah modal, perlu disesuaikan"
          tone="text-refused-ink"
          items={result.belowCost}
        />
      </div>
    </DialogContent>
  );
}
