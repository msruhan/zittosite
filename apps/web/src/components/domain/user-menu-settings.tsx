"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DeviceMobile, Package, Sparkle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api";
import {
  DEFAULT_USER_MENUS,
  MENU_LABEL_MAX,
  USER_MENU_KEYS,
  type UserMenuKey,
  type UserMenus,
} from "@/lib/user-menus";
import { cn } from "@/lib/utils";

const MENU_META: Record<UserMenuKey, { icon: Icon; hint: string }> = {
  order: { icon: Package, hint: "Layanan manual yang dikerjakan admin (Telegram/WhatsApp)." },
  ceir: { icon: DeviceMobile, hint: "Layanan Supplier API dengan menu Order Ceir." },
  special: { icon: Sparkle, hint: "Layanan Supplier API dengan menu Layanan Spesial." },
};

/** Super Admin: rename the three user ordering menus and switch them on or off. */
export function UserMenuSettings() {
  const router = useRouter();
  const [menus, setMenus] = React.useState<UserMenus | null>(null);
  const [saved, setSaved] = React.useState<UserMenus | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api<UserMenus>("/admin/user-menus")
      .then((data) => {
        if (cancelled) return;
        setMenus(data);
        setSaved(data);
      })
      .catch(() => {
        if (cancelled) return;
        setMenus(DEFAULT_USER_MENUS);
        setSaved(DEFAULT_USER_MENUS);
        toast.error("Gagal memuat pengaturan menu");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = menus !== null && JSON.stringify(menus) !== JSON.stringify(saved);
  const emptyLabel = menus ? USER_MENU_KEYS.some((key) => !menus[key].label.trim()) : false;

  function update(key: UserMenuKey, patch: Partial<UserMenus[UserMenuKey]>) {
    setMenus((current) => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));
  }

  async function handleSave() {
    if (!menus || emptyLabel) return;
    setSaving(true);
    try {
      const result = await api<UserMenus>("/admin/user-menus", {
        method: "PUT",
        body: JSON.stringify(menus),
      });
      setMenus(result);
      setSaved(result);
      router.refresh();
      toast.success("Menu user disimpan", {
        description: "Sidebar user langsung memakai nama dan status baru.",
      });
    } catch (err) {
      toast.error("Gagal menyimpan", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="items-start">
        <div className="min-w-0">
          <CardTitle>Menu user</CardTitle>
          <p className="mt-1 text-body text-ink-soft">
            Atur nama menu order di sidebar user. Menu yang dinonaktifkan disembunyikan dan
            order baru dari website ditolak.
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-3">
        {menus ? (
          <ul className="divide-y divide-hairline rounded-card border border-hairline">
            {USER_MENU_KEYS.map((key) => {
              const { icon: MenuIcon, hint } = MENU_META[key];
              const menu = menus[key];
              const inputId = `menu-label-${key}`;
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
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
                      Nama menu {DEFAULT_USER_MENUS[key].label}
                    </label>
                    <Input
                      id={inputId}
                      value={menu.label}
                      maxLength={MENU_LABEL_MAX}
                      placeholder={DEFAULT_USER_MENUS[key].label}
                      onChange={(event) => update(key, { label: event.target.value })}
                      aria-invalid={!menu.label.trim() || undefined}
                    />
                    <p className="mt-1 text-label text-ink-faint">{hint}</p>
                  </div>
                  <div className="flex items-center gap-2.5 sm:w-28 sm:justify-end">
                    <span
                      className={cn(
                        "text-label font-bold",
                        menu.enabled ? "text-cleared-ink" : "text-ink-faint",
                      )}
                    >
                      {menu.enabled ? "Aktif" : "Nonaktif"}
                    </span>
                    <Switch
                      checked={menu.enabled}
                      onCheckedChange={(enabled) => update(key, { enabled })}
                      ariaLabel={`Aktifkan menu ${menu.label || DEFAULT_USER_MENUS[key].label}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-2">
            {USER_MENU_KEYS.map((key) => (
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
      </CardBody>
    </Card>
  );
}
