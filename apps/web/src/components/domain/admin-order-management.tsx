"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MagnifyingGlass, PencilSimple, X } from "@phosphor-icons/react";
import { toast } from "sonner";
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
import { ApiError, api } from "@/lib/api";
import { ORDER_STATUS_OPTIONS } from "@/lib/status";
import { AutoRefreshStatus, useAutoRefresh } from "@/components/domain/auto-refresh";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OrderDetail, OrderStatus } from "@/lib/types";

const STATUS_CHOICES = ORDER_STATUS_OPTIONS.filter(
  (o): o is { value: OrderStatus; label: string } => o.value !== "all",
);

/** Cancelling these goes through the cancel flow so the invoice closes and everyone is notified. */
const CANCEL_FLOW_FROM: OrderStatus[] = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
];

export function AdminOrderManagement({
  orders,
  fetchedAt,
  initialQuery = "",
  showCustomerIdentity = true,
  canEditStatus = false,
}: {
  orders: OrderDetail[];
  fetchedAt: string;
  initialQuery?: string;
  showCustomerIdentity?: boolean;
  canEditStatus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState<OrderStatus | "all">("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const { refreshing } = useAutoRefresh({
    paused: editingId !== null || savingId !== null,
  });

  async function changeStatus(order: OrderDetail, next: OrderStatus) {
    if (next === order.status) {
      setEditingId(null);
      return;
    }
    setSavingId(order.orderId);
    try {
      if (next === "cancel" && CANCEL_FLOW_FROM.includes(order.status)) {
        await api(`/admin/orders/${order.orderId}/cancel`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        toast.success(`Order ${order.orderId} dibatalkan`, {
          description: "User sudah diberi tahu lewat Telegram.",
        });
      } else {
        await api(`/admin/orders/${order.orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        });
        toast.success(`Status ${order.orderId} diperbarui`);
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast.error("Gagal mengubah status", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setSavingId(null);
    }
  }

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
          <MagnifyingGlass
            aria-hidden="true"
            weight="regular"
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
                    <TH>Admin</TH>
                    <TH>Status</TH>
                    <TH>Dibuat</TH>
                    <TH className={canEditStatus ? "w-24" : "w-16"}>Aksi</TH>
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
                          {order.imei}
                        </DataValue>
                      </TD>
                      <TD>
                        <DataValue>{formatRupiah(order.price)}</DataValue>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {order.assignedAdmin ? (
                          <span className="font-medium text-ink">
                            {order.assignedAdmin.fullName}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD>
                        {editingId === order.orderId ? (
                          <div
                            className={
                              savingId === order.orderId
                                ? "pointer-events-none opacity-60"
                                : undefined
                            }
                          >
                            <Select
                              ariaLabel={`Ubah status ${order.orderId}`}
                              value={order.status}
                              onValueChange={(value) =>
                                void changeStatus(order, value as OrderStatus)
                              }
                              options={STATUS_CHOICES}
                              className="h-8 w-40"
                            />
                          </div>
                        ) : (
                          <StatusBadge status={order.status} />
                        )}
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
                        <div className="flex items-center gap-1">
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
                          {canEditStatus ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={
                                editingId === order.orderId
                                  ? `Batal ubah status ${order.orderId}`
                                  : `Ubah status ${order.orderId}`
                              }
                              disabled={savingId === order.orderId}
                              onClick={() =>
                                setEditingId((current) =>
                                  current === order.orderId ? null : order.orderId,
                                )
                              }
                            >
                              {editingId === order.orderId ? (
                                <X className="size-4 text-ink-soft" />
                              ) : (
                                <PencilSimple className="size-4 text-action" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-3 font-data tabular text-body text-ink-soft">
              <p>
                Menampilkan {filtered.length} dari {orders.length} order
              </p>
              <AutoRefreshStatus fetchedAt={fetchedAt} refreshing={refreshing} />
            </div>
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
