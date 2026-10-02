"use client";

import * as React from "react";
import Link from "next/link";
import { MagnifyingGlass, Package } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { AutoRefreshStatus, useAutoRefresh } from "@/components/domain/auto-refresh";
import { UserOrderTable } from "@/components/domain/user-order-table";
import { ORDER_STATUS_OPTIONS } from "@/lib/status";
import type { OrderDetail, OrderStatus } from "@/lib/types";

export function OrderHistory({
  orders,
  fetchedAt,
  emptyTitle = "Belum ada order",
  emptyDescription = "Mulai buat order pertamamu.",
  createHref = "/app/order",
}: {
  orders: OrderDetail[];
  fetchedAt: string;
  emptyTitle?: string;
  emptyDescription?: string;
  createHref?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<OrderStatus | "all">("all");
  const [service, setService] = React.useState("all");
  const { refreshing } = useAutoRefresh();

  const serviceOptions = React.useMemo(() => {
    const names = new Map<string, string>();
    for (const order of orders) names.set(order.service.id, order.service.name);
    return [
      { value: "all", label: "Semua Layanan" },
      ...[...names]
        .sort((a, b) => a[1].localeCompare(b[1], "id"))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [orders]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (service !== "all" && order.service.id !== service) return false;
      if (!needle) return true;
      return (
        order.orderId.toLowerCase().includes(needle) ||
        order.imei.toLowerCase().includes(needle) ||
        order.service.name.toLowerCase().includes(needle)
      );
    });
  }, [orders, query, status, service]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari order</span>
          <MagnifyingGlass
            aria-hidden="true"
            weight="regular"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Order ID, IMEI, atau layanan"
            className="pl-9"
          />
        </label>
        <Combobox
          ariaLabel="Filter layanan"
          value={service}
          onValueChange={setService}
          options={serviceOptions}
          className="sm:w-56"
        />
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              <p>
                Menampilkan {filtered.length} dari {orders.length} order
              </p>
              <AutoRefreshStatus fetchedAt={fetchedAt} refreshing={refreshing} />
            </div>
          </>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package weight="regular" />}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button asChild>
                <Link href={createHref}>Buat Order</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<MagnifyingGlass weight="regular" />}
            title="Tidak ada order yang cocok"
            description="Coba ubah kata kunci atau reset filter."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setService("all");
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
