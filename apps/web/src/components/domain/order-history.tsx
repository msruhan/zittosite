"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { UserOrderTable } from "@/components/domain/user-order-table";
import { ORDER_STATUS_OPTIONS } from "@/lib/status";
import type { OrderDetail, OrderStatus } from "@/lib/types";

export function OrderHistory({ orders }: { orders: OrderDetail[] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<OrderStatus | "all">("all");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!needle) return true;
      return (
        order.orderId.toLowerCase().includes(needle) ||
        order.imei.toLowerCase().includes(needle) ||
        order.service.name.toLowerCase().includes(needle)
      );
    });
  }, [orders, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari order</span>
          <Search
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Order ID, IMEI, atau layanan"
            className="pl-9"
          />
        </label>
        <Select
          ariaLabel="Filter status"
          value={status}
          onValueChange={(value) => setStatus(value as OrderStatus | "all")}
          options={ORDER_STATUS_OPTIONS}
          className="sm:w-48"
        />
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <UserOrderTable orders={filtered} />
            <p className="border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              Menampilkan {filtered.length} dari {orders.length} order
            </p>
          </>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package strokeWidth={1.5} />}
            title="Belum ada order"
            description="Mulai buat order pertamamu."
            action={
              <Button asChild>
                <Link href="/app/order">Buat Order</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Search strokeWidth={1.5} />}
            title="Tidak ada order yang cocok"
            description="Coba ubah kata kunci atau reset filter status."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Reset filter
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}
