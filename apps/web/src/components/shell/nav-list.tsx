"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  NAV_BY_VARIANT,
  isNavItemActive,
  type NavVariant,
} from "@/lib/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Sidebar nav — larger hit targets & type than the base NextAdmin item.
 */
const itemBase = [
  "flex w-full items-center gap-3.5 rounded-lg px-4 py-3.5",
  "text-title font-medium",
  "transition-[background-color,color] duration-200 ease-out-strong",
];

export function NavList({
  variant,
  onNavigate,
  sectionLabel = "MAIN MENU",
  hideHrefs,
}: {
  variant: NavVariant;
  onNavigate?: () => void;
  sectionLabel?: string;
  hideHrefs?: string[];
}) {
  const pathname = usePathname();
  const hidden = new Set(hideHrefs ?? []);
  const items = NAV_BY_VARIANT[variant].filter(
    (item) => !hidden.has(item.href),
  );

  return (
    <div>
      <h2 className="mb-5 text-body font-medium tracking-[0.04em] text-nav-ink">
        {sectionLabel}
      </h2>

      <nav aria-label={sectionLabel}>
        <ul className="space-y-2.5">
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
                      ? "bg-action/[0.07] text-action"
                      : "text-nav-ink hover:bg-mist hover:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className={cn(
                      "size-7 shrink-0",
                      active ? "text-action" : "text-nav-ink",
                    )}
                  />
                  <span>{item.label}</span>
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
  const router = useRouter();

  async function handleLogout() {
    onNavigate?.();
    try {
      if (variant === "admin") {
        await api("/admin/auth/logout", { method: "POST" });
        router.replace("/admin/login");
      } else {
        await api("/auth/logout", { method: "POST" });
        router.replace("/login");
      }
      router.refresh();
    } catch {
      toast.error("Logout gagal", {
        description: "Coba lagi atau tutup tab ini.",
      });
      router.replace(variant === "admin" ? "/admin/login" : "/login");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={cn(
        itemBase,
        "text-left text-nav-ink hover:bg-refused-wash hover:text-refused-ink",
      )}
    >
      <LogOut
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-7 shrink-0"
      />
      <span>Logout</span>
    </button>
  );
}
