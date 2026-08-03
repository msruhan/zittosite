import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The ledger: horizontal rules only. No vertical grid lines, no outer box,
 * no zebra striping. Tables scroll inside their own region so the page
 * never scrolls sideways.
 */
export function TableScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("scroll-region -mx-px", className)}>
      <div className="min-w-max">{children}</div>
    </div>
  );
}

export function Table({
  className,
  children,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-left", className)}
      {...props}
    >
      {children}
    </table>
  );
}

export function THead({
  className,
  children,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead className={cn("bg-mist", className)} {...props}>
      {children}
    </thead>
  );
}

export function TH({
  className,
  children,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-12 border-b border-hairline px-4 text-left align-middle",
        "text-label font-medium uppercase tracking-[0.02em] text-ink-soft whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({
  className,
  children,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody className={cn(className)} {...props}>
      {children}
    </tbody>
  );
}

export function TR({
  className,
  children,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-hairline last:border-b-0",
        "transition-colors duration-150 ease-out-strong hover:bg-action-wash/50",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  children,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("px-4 py-3.5 text-body text-ink align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}
