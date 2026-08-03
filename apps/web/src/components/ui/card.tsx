import * as React from "react";
import {
  CardAtmosphere,
  type CardAtmosphereTone,
} from "@/components/ui/card-atmosphere";
import { cn } from "@/lib/utils";

/**
 * Soft dashboard card: 24px radius, mesh glow + hatch atmosphere.
 * A card never contains another card — use a hairline divider instead.
 */
export function Card({
  className,
  children,
  atmosphere = true,
  tone = "action",
  ...props
}: React.ComponentProps<"div"> & {
  atmosphere?: boolean;
  tone?: CardAtmosphereTone;
}) {
  return (
    <div
      className={cn(
        "card-shell relative overflow-hidden",
        "transition-[box-shadow,border-color,transform] duration-200 ease-out-strong",
        className,
      )}
      {...props}
    >
      {atmosphere ? <CardAtmosphere tone={tone} /> : null}
      <div className="relative z-10">{children}</div>
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
        "flex items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7",
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
    <h2 className={cn("text-headline font-bold text-ink", className)} {...props}>
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
    <div className={cn("px-5 py-5 sm:px-7 sm:py-6", className)} {...props}>
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
        "flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4 sm:px-7",
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
      <dd className="text-body font-medium text-ink">{children}</dd>
    </div>
  );
}
