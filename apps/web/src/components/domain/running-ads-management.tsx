"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
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
import {
  AD_TAG_CLASS,
  AdTag,
  AdsRunnerTicker,
} from "@/components/domain/ads-runner-ticker";
import { ApiError, api } from "@/lib/api";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { RunningAd, RunningAdColor } from "@/lib/types";

const COLORS: Array<{ value: RunningAdColor; label: string }> = [
  { value: "yellow", label: "Kuning" },
  { value: "red", label: "Merah" },
  { value: "green", label: "Hijau" },
  { value: "blue", label: "Biru" },
  { value: "white", label: "Putih" },
];

type Draft = {
  id: string | null;
  text: string;
  tag: string;
  tagColor: RunningAdColor;
  linkUrl: string;
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  text: "",
  tag: "",
  tagColor: "yellow",
  linkUrl: "",
  isActive: true,
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function RunningAdsManagement({ initialAds }: { initialAds: RunningAd[] }) {
  const [ads, setAds] = React.useState(initialAds);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [deleting, setDeleting] = React.useState<RunningAd | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");

  const activeAds = ads.filter((ad) => ad.isActive);
  const filteredAds = ads
    .map((ad, index) => ({ ad, index }))
    .filter(({ ad }) => matchesSearch(query, [ad.text, ad.tag, ad.linkUrl]));

  async function reload() {
    setAds(await api<RunningAd[]>("/admin/running-ads"));
  }

  async function handleToggle(ad: RunningAd) {
    const next = !ad.isActive;
    setBusyId(ad.id);
    setAds((current) => current.map((a) => (a.id === ad.id ? { ...a, isActive: next } : a)));
    try {
      await api(`/admin/running-ads/${ad.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      toast.success(next ? "Ads ditampilkan" : "Ads disembunyikan");
    } catch (err) {
      setAds((current) =>
        current.map((a) => (a.id === ad.id ? { ...a, isActive: ad.isActive } : a)),
      );
      toast.error("Gagal", { description: errorMessage(err, "Update gagal") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(ad: RunningAd, direction: "up" | "down") {
    setBusyId(ad.id);
    try {
      setAds(
        await api<RunningAd[]>(`/admin/running-ads/${ad.id}/move`, {
          method: "POST",
          body: JSON.stringify({ direction }),
        }),
      );
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Urutan gagal diubah") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSave(draft: Draft) {
    const body = JSON.stringify({
      text: draft.text,
      tag: draft.tag || null,
      tagColor: draft.tagColor,
      linkUrl: draft.linkUrl || null,
      isActive: draft.isActive,
    });
    if (draft.id) {
      await api(`/admin/running-ads/${draft.id}`, { method: "PATCH", body });
    } else {
      await api("/admin/running-ads", { method: "POST", body });
    }
    await reload();
    setEditing(null);
    toast.success(draft.id ? "Perubahan disimpan" : "Ads ditambahkan");
  }

  async function handleDelete(ad: RunningAd) {
    setBusyId(ad.id);
    try {
      await api(`/admin/running-ads/${ad.id}`, { method: "DELETE" });
      setAds((current) => current.filter((a) => a.id !== ad.id));
      setDeleting(null);
      toast.success("Ads dihapus");
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Hapus gagal") });
    } finally {
      setBusyId(null);
    }
  }

  const addButton = (
    <Button onClick={() => setEditing(EMPTY_DRAFT)}>
      <Plus className="size-4" aria-hidden="true" />
      Tambah Ads
    </Button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Pratinjau</CardTitle>
            <p className="mt-0.5 text-body text-ink-soft">
              Seperti yang dilihat user. Arahkan kursor untuk menjeda.
            </p>
          </div>
          {addButton}
        </CardHeader>
        <CardBody className="pt-3">
          {activeAds.length ? (
            <div className="overflow-hidden rounded-md">
              <AdsRunnerTicker items={activeAds} />
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-hairline px-3.5 py-3 text-body text-ink-soft">
              Tidak ada ads aktif, jadi ticker tidak tampil di portal user.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        {ads.length ? (
          <div className="border-b border-hairline p-3 sm:px-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Cari ads"
              placeholder="Cari teks, label, atau link"
            />
          </div>
        ) : null}
        {ads.length && !filteredAds.length ? (
          <EmptyState
            title="Tidak ada ads yang cocok"
            description={`Tidak ada ads yang cocok dengan "${query.trim()}".`}
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                Reset pencarian
              </Button>
            }
          />
        ) : ads.length ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-24">Urutan</TH>
                    <TH>Teks</TH>
                    <TH>Link</TH>
                    <TH>Status</TH>
                    <TH className="w-28">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filteredAds.map(({ ad, index }) => (
                    <TR key={ad.id}>
                      <TD>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Naikkan ${ad.text}`}
                            disabled={index === 0 || busyId === ad.id}
                            onClick={() => void handleMove(ad, "up")}
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Turunkan ${ad.text}`}
                            disabled={index === ads.length - 1 || busyId === ad.id}
                            onClick={() => void handleMove(ad, "down")}
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex max-w-lg items-center gap-2">
                          {ad.tag ? <AdTag tag={ad.tag} color={ad.tagColor} /> : null}
                          <span className="text-body text-ink">{ad.text}</span>
                        </div>
                      </TD>
                      <TD>
                        {ad.linkUrl ? (
                          <span className="block max-w-56 truncate font-data text-body text-ink-soft">
                            {ad.linkUrl}
                          </span>
                        ) : (
                          <span className="text-body text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={Boolean(ad.isActive)}
                            disabled={busyId === ad.id}
                            onCheckedChange={() => void handleToggle(ad)}
                            ariaLabel={`${ad.text}: ${ad.isActive ? "tampil" : "disembunyikan"}`}
                          />
                          <span
                            className={cn(
                              "text-body font-medium",
                              ad.isActive ? "text-cleared-ink" : "text-ink-soft",
                            )}
                          >
                            {ad.isActive ? "Tampil" : "Sembunyi"}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${ad.text}`}
                            onClick={() =>
                              setEditing({
                                id: ad.id,
                                text: ad.text,
                                tag: ad.tag ?? "",
                                tagColor: ad.tagColor,
                                linkUrl: ad.linkUrl ?? "",
                                isActive: Boolean(ad.isActive),
                              })
                            }
                          >
                            <PencilSimple className="size-4 text-action" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Hapus ${ad.text}`}
                            onClick={() => setDeleting(ad)}
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
              {activeAds.length} dari {ads.length} ads tampil
            </p>
          </>
        ) : (
          <EmptyState
            title="Belum ada ads"
            description="Tambahkan teks pertama, misalnya promo atau info jam operasional."
            action={addButton}
          />
        )}
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <AdFormDialog draft={editing} onCancel={() => setEditing(null)} onSave={handleSave} />
        ) : null}
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <DialogContent
            title="Hapus ads?"
            description="Teks ini langsung hilang dari ticker portal user. Kalau hanya ingin menyembunyikan sementara, matikan statusnya saja."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDeleting(null)}>
                  Batal
                </Button>
                <Button
                  variant="danger"
                  loading={busyId === deleting.id}
                  loadingLabel="Menghapus"
                  onClick={() => void handleDelete(deleting)}
                >
                  Hapus
                </Button>
              </>
            }
          >
            <p className="rounded-md border border-hairline bg-mist px-3.5 py-3 text-body text-ink">
              {deleting.text}
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function AdFormDialog({
  draft: initial,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onCancel: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ text?: string; linkUrl?: string }>({});

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      ...draft,
      text: draft.text.trim(),
      tag: draft.tag.trim().toUpperCase(),
      linkUrl: draft.linkUrl.trim(),
    };
    const nextErrors: typeof errors = {};
    if (!next.text) nextErrors.text = "Masukkan teks yang akan berjalan.";
    if (next.linkUrl && !/^(https?:\/\/|\/(?!\/))/.test(next.linkUrl)) {
      nextErrors.linkUrl = "Awali dengan https:// atau / untuk halaman internal.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await onSave(next);
    } catch (err) {
      toast.error("Gagal", { description: errorMessage(err, "Simpan gagal") });
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={initial.id ? "Edit ads" : "Tambah ads"}
      description="Ads yang tampil berjalan di bawah header semua halaman portal user."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" form="running-ad-form" loading={saving} loadingLabel="Menyimpan">
            Simpan
          </Button>
        </>
      }
    >
      <form id="running-ad-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Teks"
          htmlFor="adText"
          required
          error={errors.text}
          hint={`${draft.text.length}/200 karakter`}
        >
          <Input
            id="adText"
            maxLength={200}
            value={draft.text}
            invalid={Boolean(errors.text)}
            placeholder="Promo 3B Fast Rp150.000 — proses 10 menit"
            onChange={(event) => update("text", event.target.value)}
          />
        </Field>

        <Field label="Label" htmlFor="adTag" hint="Opsional, maksimal 16 huruf (mis. PROMO, INFO, BARU).">
          <Input
            id="adTag"
            maxLength={16}
            className="font-data uppercase"
            value={draft.tag}
            placeholder="PROMO"
            onChange={(event) => update("tag", event.target.value)}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-body font-medium text-ink">Warna label</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-pressed={draft.tagColor === color.value}
                onClick={() => update("tagColor", color.value)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-body transition-colors duration-150 ease-out-strong",
                  draft.tagColor === color.value
                    ? "border-action bg-action-wash font-medium text-action"
                    : "border-hairline bg-surface text-ink hover:bg-mist",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-3.5 rounded-sm border", AD_TAG_CLASS[color.value])}
                />
                {color.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field
          label="Link"
          htmlFor="adLink"
          error={errors.linkUrl}
          hint="Opsional. https://… dibuka di tab baru; /app/… membuka halaman portal."
        >
          <Input
            id="adLink"
            className="font-data"
            value={draft.linkUrl}
            invalid={Boolean(errors.linkUrl)}
            placeholder="/app/topup"
            onChange={(event) => update("linkUrl", event.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3.5 py-3">
          <div>
            <p className="text-body font-medium text-ink">Tampilkan</p>
            <p className="text-body text-ink-soft">Matikan untuk menyimpan tanpa menampilkan.</p>
          </div>
          <Switch
            checked={draft.isActive}
            onCheckedChange={(checked) => update("isActive", checked)}
            ariaLabel="Tampilkan ads"
          />
        </div>

        <div>
          <p className="mb-1.5 text-body font-medium text-ink">Pratinjau</p>
          <div className="overflow-hidden rounded-md">
            <AdsRunnerTicker
              items={[
                {
                  id: "preview",
                  text: draft.text.trim() || "Teks ads tampil di sini",
                  tag: draft.tag.trim().toUpperCase() || null,
                  tagColor: draft.tagColor,
                  linkUrl: null,
                },
              ]}
            />
          </div>
        </div>
      </form>
    </DialogContent>
  );
}
