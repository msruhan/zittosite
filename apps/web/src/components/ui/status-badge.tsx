import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, RESULT_STATUS } from "@/lib/status";
import type { OrderStatus, PaymentStatus, ResultStatus } from "@/lib/types";

/**
 * Soft-fill status badge — NextAdmin table craft:
 * small radius, medium weight, Title Case, pastel wash (or outline for exits).
 */
const shell = [
  "inline-flex max-w-fit items-center justify-center whitespace-nowrap",
  "rounded-[5px] border px-2.5 py-[3px]",
  "text-body font-medium leading-5",
  "transition-[background-color,color,border-color,transform] duration-300 ease-out-strong",
];

export function StatusBadge({
  status,
  className,
  stampIn = false,
}: {
  status: OrderStatus;
  className?: string;
  stampIn?: boolean;
}) {
  const meta = ORDER_STATUS[status];
  return (
    <span className={cn(shell, meta.stamp, stampIn && "stamp-in", className)}>
      {meta.label}
    </span>
  );
}

export function PaymentBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const meta = PAYMENT_STATUS[status];
  return (
    <span className={cn(shell, meta.stamp, className)}>{meta.label}</span>
  );
}

export function ResultBadge({
  status,
  className,
}: {
  status: ResultStatus;
  className?: string;
}) {
  const meta = RESULT_STATUS[status];
  return (
    <span className={cn(shell, meta.stamp, className)}>{meta.label}</span>
  );
}

/** Neutral soft chip for non-status facts (channel, mock-data tag). */
export function Tag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        shell,
        "border-transparent bg-mist text-nav-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
