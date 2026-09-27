"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg font-bold select-none",
    "transition-[transform,background-color,border-color,color,box-shadow,opacity]",
    "duration-150 ease-out-strong",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-55",
    "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-action text-surface shadow-action hover:bg-action-pressed hover:text-surface",
        secondary:
          "border border-action bg-surface text-action hover:bg-action-wash",
        outline:
          "border border-hairline bg-surface text-ink hover:bg-mist hover:border-ink-faint",
        ghost: "text-ink-soft hover:bg-mist hover:text-ink",
        danger: "bg-refused-ink text-surface hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-5 text-sm",
        icon: "size-11 rounded-lg px-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingLabel = "Memproses",
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot
        data-size={size ?? "md"}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-size={size ?? "md"}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">
            {children}
          </span>
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Spinner label={loadingLabel} />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { buttonVariants };
