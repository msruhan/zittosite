"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * A popover scales in from its trigger, not from the viewport centre, so the
 * transform-origin comes from Radix rather than being hardcoded.
 */
export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Pilih…",
  className,
  invalid,
  ariaLabel,
}: {
  id?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3",
          "text-body text-ink",
          "transition-[border-color,box-shadow] duration-150 ease-out-strong",
          "focus:outline-none focus:border-action",
          "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_22%,transparent)]",
          "data-[placeholder]:text-ink-faint",
          "disabled:cursor-not-allowed disabled:bg-mist disabled:text-ink-faint",
          invalid ? "border-refused-edge" : "border-hairline",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className="size-4 shrink-0 text-ink-soft"
            aria-hidden="true"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-md border border-hairline bg-surface shadow-lifted",
            "origin-[var(--radix-select-content-transform-origin)]",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3",
                  "text-body text-ink outline-none",
                  "data-[highlighted]:bg-action-wash data-[highlighted]:text-action",
                  "data-[disabled]:pointer-events-none data-[disabled]:text-ink-faint",
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5 inline-flex">
                  <Check className="size-3.5" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                {option.hint ? (
                  <span className="ml-auto font-data tabular text-body text-ink-soft">
                    {option.hint}
                  </span>
                ) : null}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
