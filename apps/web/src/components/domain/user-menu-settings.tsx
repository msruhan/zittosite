"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Package, Plus, Trash } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api";
import { MENU_STYLE_ICON } from "@/lib/navigation";
import { MENU_STYLE_LABEL, type MenuCurrency, type MenuStyle } from "@/lib/types";
import {
  DEFAULT_USER_MENUS,
  MAX_MENUS,
  MENU_LABEL_MAX,
  menuOrderHref,
  type UserMenu,
  type UserMenus,
  type UserServiceMenu,
} from "@/lib/user-menus";
import { cn } from "@/lib/utils";

const STYLE_HINT: Record<MenuStyle, string> = {
  ceir: "Daftar layanan biasa, maksimal 6 per order.",
  special: "Layanan dikelompokkan per grup, maksimal 2 per order, bisa minta field tambahan.",
};

function MenuRow({
  icon: MenuIcon,
  inputId,
  menu,
  hint,
  placeholder,
  onChange,
  actions,
}: {
  icon: Icon;
  inputId: string;
  menu: UserMenu;
  hint: string;
  placeholder: string;
  onChange: (patch: Partial<UserMenu>) => void;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
          menu.enabled
            ? "border-action/15 bg-action-wash text-action"
            : "border-hairline bg-mist text-ink-faint",
        )}
      >
        <MenuIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">
          Nama menu {placeholder}
        </label>
        <Input
          id={inputId}
          value={menu.label}
          maxLength={MENU_LABEL_MAX}
          placeholder={placeholder}
          onChange={(event) => onChange({ label: event.target.value })}
          aria-invalid={!menu.label.trim() || undefined}
        />
        <p className="mt-1 text-label text-ink-faint">{hint}</p>
      </div>
      <div className="flex items-center gap-2.5 sm:justify-end">
        {actions}
        <span
          className={cn(
            "w-14 text-right text-label font-bold",
            menu.enabled ? "text-cleared-ink" : "text-ink-faint",
          )}
        >
          {menu.enabled ? "Aktif" : "Nonaktif"}
        </span>
        <Switch
          checked={menu.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          ariaLabel={`Aktifkan menu ${menu.label || placeholder}`}
        />
      </div>
    </li>
  );
}

/** Super Admin: name, order, and switch the user ordering menus; add or remove service menus. */
export function UserMenuSettings() {
  const router = useRouter();
  const [menus, setMenus] = React.useState<UserMenus | null>(null);
  const [saved, setSaved] = React.useState<UserMenus | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [newLabel, setNewLabel] = React.useState("");
  const [newStyle, setNewStyle] = React.useState<MenuStyle>("ceir");
  const [newCurrency, setNewCurrency] = React.useState<MenuCurrency>("IDR");
  const [creating, setCreating] = React.useState(false);

  const applyServer = React.useCallback((data: UserMenus) => {
    setMenus(data);
    setSaved(data);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    api<UserMenus>("/admin/user-menus")
      .then((data) => {
        if (!cancelled) applyServer(data);
      })
      .catch(() => {
        if (cancelled) return;
        applyServer(DEFAULT_USER_MENUS);
        toast.error("Gagal memuat pengaturan menu");
      });
    return () => {
      cancelled = true;
    };
  }, [applyServer]);

  const dirty = menus !== null && JSON.stringify(menus) !== JSON.stringify(saved);
  const emptyLabel = menus
    ? !menus.order.label.trim() || menus.menus.some((menu) => !menu.label.trim())
    : false;

  function updateMenu(id: string, patch: Partial<UserServiceMenu>) {
    setMenus((current) =>
      current
        ? {
            ...current,
            menus: current.menus.map((menu) => (menu.id === id ? { ...menu, ...patch } : menu)),
          }
        : current,
    );
  }

  function move(index: number, delta: -1 | 1) {
    setMenus((current) => {
      if (!current) return current;
      const target = index + delta;
      if (target < 0 || target >= current.menus.length) return current;
      const next = [...current.menus];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, menus: next };
    });
  }

  async function handleSave() {
    if (!menus || emptyLabel) return;
    setSaving(true);
    try {
      const result = await api<UserMenus>("/admin/user-menus", {
        method: "PUT",
        body: JSON.stringify({
          order: menus.order,
          menus: menus.menus.map(({ id, label, enabled }) => ({ id, label, enabled })),
        }),
      });
      applyServer(result);
      router.refresh();
      toast.success("Menu user disimpan", {
        description: "Sidebar user langsung memakai nama, urutan, dan status baru.",
      });
    } catch (err) {
      toast.error("Gagal menyimpan", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newLabel.trim() || dirty) return;
    setCreating(true);
    try {
      const menu = await api<UserServiceMenu>("/admin/user-menus", {
        method: "POST",
        body: JSON.stringify({ label: newLabel, style: newStyle, priceCurrency: newCurrency }),
      });
      applyServer(await api<UserMenus>("/admin/user-menus"));
      setNewLabel("");
      router.refresh();
      toast.success(`Menu ${menu.label} dibuat`, {
        description: `Alamat ${menuOrderHref(menu.slug)}. Pilih menu ini saat menambah layanan Supplier API.`,
      });
    } catch (err) {
      toast.error("Gagal membuat menu", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(menu: UserServiceMenu) {
    setDeleting(true);
    try {
      await api(`/admin/user-menus/${menu.id}`, { method: "DELETE" });
      applyServer(await api<UserMenus>("/admin/user-menus"));
      router.refresh();
      toast.success(`Menu ${menu.label} dihapus`);
    } catch (err) {
      toast.error("Gagal menghapus menu", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader className="items-start">
        <div className="min-w-0">
          <CardTitle>Menu user</CardTitle>
          <p className="mt-1 text-body text-ink-soft">
            Atur menu order di sidebar user. Layanan Supplier API tampil di menu yang dipilih saat
            layanan dibuat. Menu yang dinonaktifkan disembunyikan dan order baru dari website ditolak.
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-3">
        {menus ? (
          <ul className="divide-y divide-hairline rounded-card border border-hairline">
            <MenuRow
              icon={Package}
              inputId="menu-label-order"
              menu={menus.order}
              hint="Layanan manual yang dikerjakan admin (Telegram/WhatsApp)."
              placeholder={DEFAULT_USER_MENUS.order.label}
              onChange={(patch) =>
                setMenus((current) =>
                  current ? { ...current, order: { ...current.order, ...patch } } : current,
                )
              }
            />
            {menus.menus.map((menu, index) => (
              <MenuRow
                key={menu.id}
                icon={MENU_STYLE_ICON[menu.style]}
                inputId={`menu-label-${menu.id}`}
                menu={menu}
                hint={`${MENU_STYLE_LABEL[menu.style]} · harga ${menu.priceCurrency} · /app/m/${menu.slug}`}
                placeholder={menu.slug}
                onChange={(patch) => updateMenu(menu.id, patch)}
                actions={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Naikkan ${menu.label}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Turunkan ${menu.label}`}
                      disabled={index === menus.menus.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    {confirmDelete === menu.id ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={deleting}
                        loadingLabel="Menghapus"
                        onClick={() => void handleDelete(menu)}
                        onBlur={() => !deleting && setConfirmDelete(null)}
                      >
                        Hapus?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`Hapus menu ${menu.label}`}
                        disabled={dirty}
                        onClick={() => setConfirmDelete(menu.id)}
                      >
                        <Trash aria-hidden="true" />
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-label text-ink-soft">
            {emptyLabel ? "Nama menu tidak boleh kosong." : "Order lewat Telegram dan API tidak terpengaruh."}
          </p>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || emptyLabel}
            loading={saving}
            loadingLabel="Menyimpan"
          >
            Simpan menu
          </Button>
        </div>

        {menus ? (
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="mt-6 rounded-card border border-dashed border-hairline p-4"
          >
            <h3 className="text-title text-ink">Tambah menu</h3>
            <p className="mt-1 text-label text-ink-soft">
              {menus.menus.length >= MAX_MENUS
                ? `Maksimal ${MAX_MENUS} menu.`
                : dirty
                  ? "Simpan perubahan di atas dulu sebelum menambah menu."
                  : STYLE_HINT[newStyle]}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] sm:items-end">
              <Field label="Nama menu" htmlFor="new-menu-label">
                <Input
                  id="new-menu-label"
                  value={newLabel}
                  maxLength={MENU_LABEL_MAX}
                  placeholder="Cek Nomor HP"
                  onChange={(event) => setNewLabel(event.target.value)}
                />
              </Field>
              <Field label="Tipe" htmlFor="new-menu-style">
                <Select
                  id="new-menu-style"
                  value={newStyle}
                  onValueChange={(value) => setNewStyle(value as MenuStyle)}
                  options={[
                    { value: "ceir", label: MENU_STYLE_LABEL.ceir },
                    { value: "special", label: MENU_STYLE_LABEL.special },
                  ]}
                />
              </Field>
              <Field label="Harga dalam" htmlFor="new-menu-currency">
                <Select
                  id="new-menu-currency"
                  value={newCurrency}
                  onValueChange={(value) => setNewCurrency(value as MenuCurrency)}
                  options={[
                    { value: "IDR", label: "Rupiah" },
                    { value: "USD", label: "USD" },
                  ]}
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                loading={creating}
                loadingLabel="Membuat"
                disabled={!newLabel.trim() || dirty || menus.menus.length >= MAX_MENUS}
              >
                <Plus aria-hidden="true" />
                Tambah
              </Button>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
