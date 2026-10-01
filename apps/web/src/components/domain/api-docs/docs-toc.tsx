"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TocGroup {
  label: string;
  items: Array<{ id: string; label: string; mono?: boolean }>;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0] ?? "");
  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(atBottom ? ids[ids.length - 1] ?? current : current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function jump(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

/** Sticky "on this page" rail on wide screens (`rail`), a scrollable chip bar below xl (`chips`). */
export function DocsToc({ groups, variant }: { groups: TocGroup[]; variant: "rail" | "chips" }) {
  const ids = React.useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups]);
  const active = useActiveSection(ids);
  const chipBar = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const bar = chipBar.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (bar && chip) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2 });
  }, [active]);

  if (variant === "rail") {
    return (
      <nav aria-label="Di halaman ini" className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto pb-6 xl:block">
        <p className="mb-3 text-label font-bold uppercase tracking-wide text-ink-faint">Di halaman ini</p>
        <div className="space-y-5 border-l border-hairline">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 pl-4 text-label font-bold text-ink">{group.label}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(event) => jump(event, item.id)}
                      aria-current={active === item.id ? "location" : undefined}
                      className={cn(
                        "-ml-px block border-l-2 py-1 pl-4 text-label transition-colors duration-150",
                        item.mono && "font-mono",
                        active === item.id
                          ? "border-action font-bold text-action"
                          : "border-transparent text-ink-soft hover:border-ink-faint hover:text-ink",
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Lompat ke bagian"
      className="sticky top-14 z-10 -mx-4 mb-6 border-b border-hairline bg-ground/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:hidden"
    >
      <div ref={chipBar} className="scroll-region relative flex gap-1.5">
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <a
              key={item.id}
              data-id={item.id}
              href={`#${item.id}`}
              onClick={(event) => jump(event, item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-label transition-colors duration-150",
                item.mono && "font-mono",
                active === item.id
                  ? "border-action bg-action-wash font-bold text-action"
                  : "border-hairline bg-surface text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </a>
          )),
        )}
      </div>
    </nav>
);
}
