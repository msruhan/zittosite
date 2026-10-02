"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { List, X } from "@phosphor-icons/react";
import { BrandLockup } from "@/components/shell/brand";
import { LogoutLink, NavList } from "@/components/shell/nav-list";
import type { NavVariant } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "w-[240px]";
const SIDEBAR_PAD = "lg:pl-[240px]";

interface AppShellProps {
  variant: NavVariant;
  navLabel?: string;
  hideHrefs?: string[];
  /** Label overrides by nav href. */
  navLabels?: Record<string, string>;
  topbarRight?: React.ReactNode;
  /** Full-width strip under the top bar (e.g. the announcement ticker). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

function SidebarBody({
  variant,
  navLabel,
  hideHrefs,
  navLabels,
  onNavigate,
}: {
  variant: NavVariant;
  navLabel?: string;
  hideHrefs?: string[];
  navLabels?: Record<string, string>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 py-5">
      <BrandLockup className="[&_.brand-mark]:text-cyan [&_.brand-word]:text-white" />

      <div className="mt-7 flex flex-1 flex-col overflow-y-auto">
        <NavList
          variant={variant}
          sectionLabel={navLabel ?? "Menu"}
          hideHrefs={hideHrefs}
          labels={navLabels}
          onNavigate={onNavigate}
        />

        <div className="mt-auto pt-6">
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
  navLabels,
  topbarRight,
  banner,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="min-h-dvh bg-ground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden",
          "border-r border-white/10 bg-rail lg:flex",
          SIDEBAR_WIDTH,
        )}
      >
        <SidebarBody
          variant={variant}
          navLabel={navLabel}
          hideHrefs={hideHrefs}
          navLabels={navLabels}
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
              "border-r border-white/10 bg-rail shadow-overlay lg:hidden",
              "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out",
              SIDEBAR_WIDTH,
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              Navigasi
            </DialogPrimitive.Title>
            <div className="absolute right-3 top-5 z-10">
              <DialogPrimitive.Close
                aria-label="Tutup navigasi"
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-lg border border-white/10 text-nav-ink",
                  "transition-[background-color,color,transform] duration-150 ease-out-strong",
                  "hover:bg-white/10 hover:text-white active:scale-[0.97]",
                )}
              >
                <X className="size-4" weight="regular" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <SidebarBody
              variant={variant}
              navLabel={navLabel}
              hideHrefs={hideHrefs}
              navLabels={navLabels}
              onNavigate={closeDrawer}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>

        <div className={SIDEBAR_PAD}>
          <header
            className={cn(
              "sticky top-0 z-20 flex h-14 items-center gap-3",
              "border-b border-hairline bg-white/78 px-4 backdrop-blur-xl sm:px-6",
            )}
          >
            <DialogPrimitive.Trigger
              aria-label="Buka navigasi"
              className={cn(
                "-ml-1 inline-flex size-10 items-center justify-center rounded-lg border border-hairline bg-surface/80 text-nav-ink lg:hidden",
                "transition-[background-color,color,transform] duration-150 ease-out-strong",
                "hover:bg-mist hover:text-ink active:scale-[0.97]",
              )}
            >
              <List className="size-5" weight="regular" aria-hidden="true" />
            </DialogPrimitive.Trigger>

            <div className="lg:hidden">
              <BrandLockup />
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {topbarRight}
            </div>
          </header>

          {banner}

          <main className="paper-ground min-h-[calc(100dvh-3.5rem)]">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 min-[1920px]:max-w-none min-[1920px]:px-10">
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
        "mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5",
        className,
      )}
    >
      <div>
        <h1 className="text-display text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
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
