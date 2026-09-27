import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Infrastructure card: quiet surface, crisp hairline, and content-first depth.
 */
export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("card-shell relative overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-headline text-ink", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-body text-ink-soft", className)} {...props}>
      {children}
    </p>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-5 py-5 sm:px-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A labelled row inside a detail card. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5",
        className,
      )}
    >
      <dt className="text-body text-ink-soft">{label}</dt>
      <dd className="text-body font-bold text-ink">{children}</dd>
    </div>
  );
}
