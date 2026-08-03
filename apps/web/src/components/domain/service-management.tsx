"use client";

import * as React from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
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
import { formatRupiah } from "@/lib/format";
import { ApiError, api } from "@/lib/api";
import type { Service } from "@/lib/types";

export function ServiceManagement({
  initialServices,
}: {
  initialServices: Service[];
}) {
  const [services, setServices] = React.useState(initialServices);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Service | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    setServices(initialServices);
  }, [initialServices]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (service) =>
        service.name.toLowerCase().includes(needle) ||
        service.description.toLowerCase().includes(needle) ||
        (service.code ?? "").toLowerCase().includes(needle),
    );
  }, [services, query]);

  async function reload() {
    setServices(await api<Service[]>("/admin/services"));
  }

  async function handleSave(next: Service) {
    try {
      if (creating) {
        await api("/admin/services", {
          method: "POST",
          body: JSON.stringify({
            code: next.code || next.name.toLowerCase().replace(/\s+/g, "-"),
            name: next.name,
            description: next.description,
            price: next.price,
            estimate: next.estimate,
            active: next.active,
          }),
        });
      } else {
        await api(`/admin/services/${next.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: next.name,
            description: next.description,
            price: next.price,
            estimate: next.estimate,
            active: next.active,
          }),
        });
      }
      await reload();
      setEditing(null);
      setCreating(false);
      toast.success(creating ? "Layanan ditambahkan" : "Perubahan disimpan");
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Simpan gagal",
      });
    }
  }

  async function handleToggle(service: Service) {
    try {
      await api(`/admin/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !service.active }),
      });
      await reload();
      toast.success(
        service.active ? "Layanan dinonaktifkan" : "Layanan diaktifkan",
        { description: service.name },
      );
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Update gagal",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari layanan</span>
          <Search
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau deskripsi layanan"
            className="pl-9"
          />
        </label>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing({
              id: `svc-${Date.now()}`,
              code: "",
              name: "",
              description: "",
              price: 150_000,
              estimate: "1–3 jam",
              active: true,
            });
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah Layanan
        </Button>
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Layanan</TH>
                    <TH>Harga</TH>
                    <TH>Estimasi</TH>
                    <TH>Status</TH>
                    <TH className="w-28">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((service) => (
                    <TR key={service.id}>
                      <TD>
                        <div className="max-w-md">
                          <p className="font-medium text-ink">{service.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-body text-ink-soft">
                            {service.description}
                          </p>
                        </div>
                      </TD>
                      <TD>
                        <DataValue emphasis>
                          {formatRupiah(service.price)}
                        </DataValue>
                      </TD>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {service.estimate}
                        </DataValue>
                      </TD>
                      <TD>
                        {service.active ? (
                          <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                            Aktif
                          </Tag>
                        ) : (
                          <Tag className="border-void-edge bg-void-wash text-void-ink">
                            Nonaktif
                          </Tag>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${service.name}`}
                            onClick={() => {
                              setCreating(false);
                              setEditing(service);
                            }}
                          >
                            <Pencil className="size-4 text-action" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(service)}
                          >
                            {service.active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <p className="border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              Menampilkan {filtered.length} dari {services.length} layanan
            </p>
          </>
        ) : (
          <EmptyState
            title={
              services.length === 0
                ? "Belum ada layanan"
                : "Tidak ada layanan yang cocok"
            }
            description={
              services.length === 0
                ? "Tambahkan layanan pertama agar user bisa membuat order."
                : "Coba ubah kata kunci pencarian."
            }
            action={
              services.length === 0 ? (
                <Button
                  onClick={() => {
                    setCreating(true);
                    setEditing({
                      id: `svc-${Date.now()}`,
                      name: "",
                      description: "",
                      price: 150_000,
                      estimate: "1–3 jam",
                      active: true,
                    });
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Tambah Layanan
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
          <ServiceFormDialog
            service={editing}
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

function ServiceFormDialog({
  service,
  creating,
  onCancel,
  onSave,
}: {
  service: Service;
  creating: boolean;
  onCancel: () => void;
  onSave: (service: Service) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(service);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    name?: string;
    code?: string;
    price?: string;
    estimate?: string;
  }>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.name.trim()) {
      nextErrors.name = "Masukkan nama layanan.";
    }
    if (creating && !(draft.code ?? "").trim()) {
      nextErrors.code = "Masukkan code unik (mis. activation).";
    }
    if (!draft.price || draft.price < 1) {
      nextErrors.price = "Harga harus lebih dari Rp0.";
    }
    if (!draft.estimate.trim()) {
      nextErrors.estimate = "Masukkan estimasi pengerjaan.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        ...draft,
        code: (draft.code ?? "").trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        estimate: draft.estimate.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title={creating ? "Tambah layanan" : "Edit layanan"}
      description="Layanan nonaktif tidak muncul saat user membuat order."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="submit"
            form="service-form"
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan
          </Button>
        </>
      }
    >
      <form
        id="service-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        {creating ? (
          <Field label="Code" htmlFor="code" required error={errors.code} hint="Unik, huruf kecil (mis. activation).">
            <Input
              id="code"
              className="font-data"
              value={draft.code ?? ""}
              invalid={Boolean(errors.code)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
        ) : null}
        <Field label="Nama layanan" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            value={draft.name}
            invalid={Boolean(errors.name)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </Field>
        <Field label="Deskripsi" htmlFor="description">
          <Textarea
            id="description"
            value={draft.description}
            placeholder="Jelaskan singkat apa yang didapat user."
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Harga" htmlFor="price" required error={errors.price}>
          <Input
            id="price"
            inputMode="numeric"
            className="font-data tabular"
            value={draft.price || ""}
            invalid={Boolean(errors.price)}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              setDraft((current) => ({
                ...current,
                price: raw ? Number(raw) : 0,
              }));
            }}
          />
        </Field>
        <Field
          label="Estimasi pengerjaan"
          htmlFor="estimate"
          required
          error={errors.estimate}
          hint="Contoh: 1–3 jam, 1–2 hari kerja"
        >
          <Input
            id="estimate"
            value={draft.estimate}
            invalid={Boolean(errors.estimate)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                estimate: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Status" htmlFor="active">
          <Select
            id="active"
            value={draft.active ? "active" : "inactive"}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                active: value === "active",
              }))
            }
            options={[
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Nonaktif" },
            ]}
          />
        </Field>
      </form>
    </DialogContent>
  );
}
