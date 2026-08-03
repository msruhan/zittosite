"use client";

import * as React from "react";
import Link from "next/link";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { DataValue } from "@/components/ui/data-value";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelative } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string;
  createdAt: string;
}

export function Notifications({ items }: { items: NotificationItem[] }) {
  const unread = items.length;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        aria-label={
          unread > 0
            ? `Notifikasi, ${unread} pembaruan terbaru`
            : "Notifikasi, tidak ada pembaruan"
        }
        className={cn(
          "relative inline-flex size-11 items-center justify-center rounded-full",
          "border border-hairline bg-surface text-ink-soft shadow-resting",
          "transition-[background-color,color,transform,box-shadow] duration-150 ease-out-strong",
          "hover:bg-mist hover:text-ink hover:shadow-lifted active:scale-[0.97]",
        )}
      >
        <Bell className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-2 rounded-full border-2 border-surface bg-metric-red"
          />
        ) : null}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg",
            "border border-hairline bg-surface shadow-lifted",
            "origin-[var(--radix-popover-content-transform-origin)]",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-title text-ink">Pembaruan order</p>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Belum ada pembaruan"
              description="Notifikasi perubahan status order akan muncul di sini."
              className="py-9"
            />
          ) : (
            <ul className="max-h-80 divide-y divide-hairline overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/app/order/${item.orderId}`}
                    className={cn(
                      "block px-4 py-3 transition-colors duration-150 ease-out-strong",
                      "hover:bg-action-wash/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <DataValue className="text-body">{item.orderId}</DataValue>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-body text-ink-soft">{item.note}</p>
                    <p className="mt-1 font-data text-body text-ink-faint">
                      {formatRelative(item.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
