import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, RESULT_STATUS } from "@/lib/status";
import type { OrderStatus, PaymentStatus, ResultStatus } from "@/lib/types";

const shell = [
  "inline-flex max-w-fit items-center justify-center whitespace-nowrap",
  "rounded-full border px-2.5 py-[3px]",
  "text-label font-bold leading-4",
  "transition-[background-color,color,border-color,transform] duration-200 ease-out-strong",
];

/** Supplier API orders skip the admin queue, so admin-centric labels are renamed. */
const SUPPLIER_LABEL: Partial<Record<OrderStatus, string>> = {
  waiting_action: "Dikirim",
  in_process: "Diproses",
};

export function StatusBadge({
  status,
  via,
  className,
  stampIn = false,
}: {
  status: OrderStatus;
  via?: "supplier" | "manual";
  className?: string;
  stampIn?: boolean;
}) {
  const meta = ORDER_STATUS[status];
  const label = (via === "supplier" && SUPPLIER_LABEL[status]) || meta.label;
  return (
    <span className={cn(shell, meta.stamp, stampIn && "stamp-in", className)}>
      {label}
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
        "border-hairline bg-mist text-nav-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
