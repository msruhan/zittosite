"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { ORDER_STATUS_OPTIONS } from "@/lib/status";
import { formatDateTime, formatRupiah, maskImei } from "@/lib/format";
import type { OrderDetail, OrderStatus } from "@/lib/types";

export function AdminOrderManagement({
  orders,
  initialQuery = "",
  showCustomerIdentity = true,
}: {
  orders: OrderDetail[];
  initialQuery?: string;
  showCustomerIdentity?: boolean;
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState<OrderStatus | "all">("all");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!needle) return true;
      const matchesIdOrImei =
        order.orderId.toLowerCase().includes(needle) ||
        order.imei.toLowerCase().includes(needle);
      if (!showCustomerIdentity || !order.user) return matchesIdOrImei;
      return (
        matchesIdOrImei ||
        order.user.fullName.toLowerCase().includes(needle) ||
        order.user.username.toLowerCase().includes(needle)
      );
    });
  }, [orders, query, status, showCustomerIdentity]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
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
            placeholder={
              showCustomerIdentity
                ? "Cari Order ID, IMEI, atau nama user"
                : "Cari Order ID atau IMEI"
            }
            className="pl-9"
          />
        </label>
        <Select
          ariaLabel="Filter status"
          value={status}
          onValueChange={(value) => setStatus(value as OrderStatus | "all")}
          options={ORDER_STATUS_OPTIONS}
          className="lg:w-52"
        />
      </div>

      <Card>
        {filtered.length > 0 ? (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Order ID</TH>
                    {showCustomerIdentity ? <TH>User</TH> : null}
                    <TH>IMEI</TH>
                    <TH>Harga</TH>
                    <TH>Status</TH>
                    <TH>Dibuat</TH>
                    <TH className="w-16">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((order) => (
                    <TR key={order.orderId}>
                      <TD>
                        <DataValue emphasis>{order.orderId}</DataValue>
                      </TD>
                      {showCustomerIdentity ? (
                        <TD className="whitespace-nowrap">
                          {order.user ? (
                            <div>
                              <p className="font-medium text-ink">
                                {order.user.fullName}
                              </p>
                              <p className="font-data text-body text-ink-soft">
                                @{order.user.username}
                              </p>
                            </div>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </TD>
                      ) : null}
                      <TD>
                        <DataValue className="text-ink-soft">
                          {maskImei(order.imei)}
                        </DataValue>
                      </TD>
                      <TD>
                        <DataValue>{formatRupiah(order.price)}</DataValue>
                      </TD>
                      <TD>
                        <StatusBadge status={order.status} />
                      </TD>
                      <TD>
                        <time
                          dateTime={order.createdAt}
                          className="font-data tabular whitespace-nowrap text-ink-soft"
                        >
                          {formatDateTime(order.createdAt)}
                        </time>
                      </TD>
                      <TD>
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          aria-label={`Detail order ${order.orderId}`}
                        >
                          <Link href={`/admin/orders/${order.orderId}`}>
                            <Eye className="size-4 text-action" />
                          </Link>
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <p className="border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              Menampilkan {filtered.length} dari {orders.length} order
            </p>
          </>
        ) : (
          <EmptyState
            title="Tidak ada order sesuai filter"
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
