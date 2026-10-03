"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  NAV_BY_VARIANT,
  isNavItemActive,
  type NavVariant,
} from "@/lib/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const itemBase = [
  "flex w-full items-center gap-3 rounded-md px-3 py-2.5",
  "text-body",
  "transition-[background-color,color,transform] duration-150 ease-out-strong",
  "active:scale-[0.98]",
];

export function NavList({
  variant,
  onNavigate,
  sectionLabel = "Menu",
  hideHrefs,
  labels,
}: {
  variant: NavVariant;
  onNavigate?: () => void;
  sectionLabel?: string;
  hideHrefs?: string[];
  labels?: Record<string, string>;
}) {
  const pathname = usePathname();
  const hidden = new Set(hideHrefs ?? []);
  const items = NAV_BY_VARIANT[variant].filter(
    (item) => !hidden.has(item.href),
  );

  return (
    <div>
      <h2 className="mb-3 px-3 text-label text-white/42">{sectionLabel}</h2>

      <nav aria-label={sectionLabel}>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemBase,
                    active
                      ? "bg-white/10 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-nav-ink/76 hover:bg-white/7 hover:text-white",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    weight="regular"
                    className="size-5 shrink-0"
                  />
                  <span>{labels?.[item.href] ?? item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function LogoutLink({
  variant,
  onNavigate,
}: {
  variant: NavVariant;
  onNavigate?: () => void;
}) {
  async function handleLogout() {
    onNavigate?.();
    const loginHref = variant === "admin" ? "/admin/login" : "/login";
    try {
      await api(variant === "admin" ? "/admin/auth/logout" : "/auth/logout", {
        method: "POST",
      });
    } catch {
      toast.error("Logout gagal", {
        description: "Coba lagi atau tutup tab ini.",
      });
    }
    // Full page load drops the client router cache of logged-in pages.
    window.location.replace(loginHref);
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={cn(
        itemBase,
        "text-left text-nav-ink/70 hover:bg-refused-wash/10 hover:text-white",
      )}
    >
      <SignOut aria-hidden="true" weight="regular" className="size-5 shrink-0" />
      <span>Logout</span>
    </button>
  );
}
