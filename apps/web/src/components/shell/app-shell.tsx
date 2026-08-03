"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/shell/brand";
import { LogoutLink, NavList } from "@/components/shell/nav-list";
import type { NavVariant } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "w-[310px]";
const SIDEBAR_PAD = "lg:pl-[310px]";

interface AppShellProps {
  variant: NavVariant;
  /** Section heading above nav items. Defaults to MAIN MENU (NextAdmin). */
  navLabel?: string;
  /** Href paths to omit from the sidebar (e.g. Admins for non–super_admin). */
  hideHrefs?: string[];
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}

function SidebarBody({
  variant,
  navLabel,
  hideHrefs,
  onNavigate,
}: {
  variant: NavVariant;
  navLabel?: string;
  hideHrefs?: string[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col py-8 pl-6 pr-2 sm:py-10 sm:pl-[25px] sm:pr-[7px]">
      <div className="pr-4">
        <BrandLockup />
      </div>

      <div className="mt-8 flex flex-1 flex-col overflow-y-auto pr-3 min-[850px]:mt-10">
        <NavList
          variant={variant}
          sectionLabel={navLabel ?? "MAIN MENU"}
          hideHrefs={hideHrefs}
          onNavigate={onNavigate}
        />

        <div className="mt-auto pt-6">
          <p className="mb-5 text-body font-medium tracking-[0.04em] text-nav-ink">
            OTHERS
          </p>
          <LogoutLink variant={variant} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  variant,
  navLabel,
  hideHrefs,
  topbarRight,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="min-h-dvh bg-mist">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden",
          "border-r border-hairline bg-surface lg:flex",
          SIDEBAR_WIDTH,
        )}
      >
        <SidebarBody
          variant={variant}
          navLabel={navLabel}
          hideHrefs={hideHrefs}
        />
      </aside>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-40 bg-ink/40 lg:hidden",
              "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex max-w-[82vw] flex-col overflow-hidden",
              "border-r border-hairline bg-surface shadow-overlay lg:hidden",
              "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out",
              SIDEBAR_WIDTH,
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              Navigasi
            </DialogPrimitive.Title>
            <div className="absolute right-3 top-6 z-10">
              <DialogPrimitive.Close
                aria-label="Tutup navigasi"
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full border border-hairline text-nav-ink",
                  "transition-[background-color,color,transform] duration-150 ease-out-strong",
                  "hover:bg-mist hover:text-ink active:scale-[0.97]",
                )}
              >
                <X className="size-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <SidebarBody
              variant={variant}
              navLabel={navLabel}
              hideHrefs={hideHrefs}
              onNavigate={closeDrawer}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>

        <div className={SIDEBAR_PAD}>
          <header
            className={cn(
              "sticky top-0 z-20 flex h-16 items-center gap-3",
              "border-b border-hairline bg-surface px-4 shadow-resting sm:px-6",
            )}
          >
            <DialogPrimitive.Trigger
              aria-label="Buka navigasi"
              className={cn(
                "-ml-1 inline-flex size-11 items-center justify-center rounded-full border border-hairline text-nav-ink lg:hidden",
                "transition-[background-color,color,transform] duration-150 ease-out-strong",
                "hover:bg-mist hover:text-ink active:scale-[0.97]",
              )}
            >
              <Menu className="size-5" aria-hidden="true" />
            </DialogPrimitive.Trigger>

            <div className="lg:hidden">
              <BrandLockup />
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {topbarRight}
            </div>
          </header>

          <main className="paper-ground min-h-[calc(100dvh-4rem)]">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </div>
          </main>
        </div>
      </DialogPrimitive.Root>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-display font-bold text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-[68ch] text-body font-medium text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
