"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Every control gets a real label element above it — never a placeholder
 * standing in for one. Error text names both the problem and the fix.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-body font-medium text-ink flex items-center gap-1"
      >
        {label}
        {required ? (
          <span className="text-refused-ink" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children}

      {hint && !error ? (
        <p id={hintId} className="text-body text-ink-soft">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-body font-medium text-refused-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlBase = [
  "w-full rounded-md border bg-surface text-ink text-body",
  "placeholder:text-ink-faint",
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out-strong",
  "focus:outline-none focus:border-action",
  "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_18%,transparent)]",
  "disabled:cursor-not-allowed disabled:bg-mist disabled:text-ink-faint",
];

export function Input({
  className,
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "h-11 px-3.5",
        invalid
          ? "border-refused-edge focus:border-refused-ink focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-refused-ink)_18%,transparent)]"
          : "border-hairline",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "min-h-24 resize-y px-3 py-2.5",
        invalid ? "border-refused-edge" : "border-hairline",
        className,
      )}
      {...props}
    />
  );
}
