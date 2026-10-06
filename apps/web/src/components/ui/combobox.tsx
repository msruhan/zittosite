"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CaretDown, Check } from "@phosphor-icons/react";
import type { SelectOption } from "@/components/ui/select";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * A select whose field is also a search box: typing filters the options by
 * label, hint, and group. Same props as `Select`, so the two swap freely.
 */
export function Combobox({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Pilih…",
  className,
  invalid,
  ariaLabel,
  emptyText = "Tidak ada yang cocok",
}: {
  id?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  ariaLabel?: string;
  emptyText?: string;
}) {
  const autoId = React.useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(-1);

  const selected = options.find((option) => option.value === value);
  const visible = React.useMemo(
    () =>
      options.filter(
        (option) =>
          (!option.disabled || option.disabledLabel) &&
          matchesSearch(query, [option.label, option.hint, option.group]),
      ),
    [options, query],
  );
  const filtered = React.useMemo(() => visible.filter((option) => !option.disabled), [visible]);

  // `index` is the keyboard position among selectable options; disabled rows get -1.
  const groups = React.useMemo(() => {
    const result: { label?: string; items: { option: SelectOption; index: number }[] }[] = [];
    let next = 0;
    for (const option of visible) {
      const index = option.disabled ? -1 : next++;
      const last = result[result.length - 1];
      if (last && last.label === option.group) last.items.push({ option, index });
      else result.push({ label: option.group, items: [{ option, index }] });
    }
    return result;
  }, [visible]);

  function openList() {
    if (open) return;
    setQuery("");
    setOpen(true);
    const current = options.filter((o) => !o.disabled).findIndex((o) => o.value === value);
    setActive(current >= 0 ? current : 0);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(option: SelectOption) {
    onValueChange?.(option.value);
    close();
  }

  // Inside a modal Dialog its scroll lock swallows wheel/touch events on portaled content.
  const setListRef = React.useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    if (!node) return;
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener("wheel", stop);
    node.addEventListener("touchmove", stop);
  }, []);

  React.useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(filtered.length - 1);
        }
        break;
      case "Enter":
        if (open) {
          event.preventDefault();
          const option = filtered[active];
          if (option) choose(option);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? openList() : close())}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("relative w-full", className)}>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filtered[active] ? `${listId}-${active}` : undefined
            }
            value={open ? query : (selected?.label ?? "")}
            placeholder={open && selected ? selected.label : placeholder}
            onChange={(event) => {
              if (!open) setOpen(true);
              setQuery(event.target.value);
              setActive(0);
            }}
            onFocus={openList}
            onClick={openList}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-10 w-full truncate rounded-md border bg-surface pl-3 pr-9 text-body text-ink",
              "placeholder:text-ink-faint",
              "transition-[border-color,box-shadow] duration-150 ease-out-strong",
              "focus:outline-none focus:border-action",
              "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_22%,transparent)]",
              open && selected && "placeholder:text-ink-soft",
              invalid ? "border-refused-edge" : "border-hairline",
            )}
          />
          <CaretDown
            aria-hidden="true"
            weight="regular"
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft",
              "transition-transform duration-150 ease-out-strong",
              open && "rotate-180",
            )}
          />
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (inputRef.current?.parentElement?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden",
            "rounded-md border border-hairline bg-surface shadow-lifted",
            "origin-[var(--radix-popover-content-transform-origin)]",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          <div
            ref={setListRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-72 overflow-y-auto overscroll-contain p-1"
            onMouseDown={(event) => event.preventDefault()}
          >
            {visible.length ? (
              groups.map((group, groupIndex) => (
                <div key={`${group.label ?? ""}-${groupIndex}`} role="group" aria-label={group.label}>
                  {group.label ? (
                    <p className="px-3 pb-1 pt-2 text-label text-ink-faint">{group.label}</p>
                  ) : null}
                  {group.items.map(({ option, index }) => {
                    if (option.disabled) {
                      return (
                        <div
                          key={option.value}
                          role="option"
                          aria-selected={false}
                          aria-disabled="true"
                          className="relative flex cursor-not-allowed select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3 text-body"
                        >
                          <span className="min-w-0 text-ink-faint">
                            {option.label}
                          </span>
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-refused-edge/60 bg-refused-wash px-2 py-0.5 text-label font-bold text-refused-ink">
                            <span aria-hidden="true" className="relative flex size-2">
                              <span className="absolute inset-0 animate-ping rounded-full bg-refused-edge opacity-75 [animation-duration:1.6s]" />
                              <span className="relative size-2 rounded-full bg-[#dc2626]" />
                            </span>
                            {option.disabledLabel}
                          </span>
                        </div>
                      );
                    }
                    const isSelected = option.value === value;
                    return (
                      <div
                        key={option.value}
                        id={`${listId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={isSelected}
                        data-highlighted={index === active || undefined}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(option)}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3",
                          "text-body text-ink",
                          "data-[highlighted]:bg-action-wash data-[highlighted]:text-action",
                        )}
                      >
                        {isSelected ? (
                          <Check
                            className="absolute left-2.5 size-3.5"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="min-w-0">{option.label}</span>
                        {option.hint ? (
                          <span className="ml-auto shrink-0 pl-3 font-data tabular text-body text-ink-soft">
                            {option.hint}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-body text-ink-soft">
                {emptyText}
                {query.trim() ? <> untuk &ldquo;{query.trim()}&rdquo;</> : null}
              </p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
