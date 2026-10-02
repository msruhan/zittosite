"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Screen-reader label. */
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block flex-1", className)}>
      <span className="sr-only">{label}</span>
      <MagnifyingGlass
        aria-hidden="true"
        weight="regular"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </label>
  );
}
