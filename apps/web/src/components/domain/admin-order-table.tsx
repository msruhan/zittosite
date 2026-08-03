import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/shell/user-chip";
import { DataValue } from "@/components/ui/data-value";
import { StatusBadge, Tag } from "@/components/ui/status-badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { formatDateTime, formatRupiah, maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const ADMIN_ORDER_COLUMNS = [
  "Order ID",
  "User",
  "Layanan",
  "IMEI",
  "Harga",
  "Status",
  "Admin",
  "Tanggal",
];

/** The Super Admin ledger runs tighter than the user portal: more rows, less air. */
export function AdminOrderTable({
  orders,
  compact = false,
}: {
  orders: OrderDetail[];
  compact?: boolean;
}) {
  return (
    <TableScroll>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Order ID</TH>
            <TH>User</TH>
            <TH>Layanan</TH>
            {compact ? null : <TH>IMEI</TH>}
            <TH className="text-right">Harga</TH>
            <TH>Status</TH>
            <TH>Admin</TH>
            <TH>Tanggal</TH>
            <TH className="w-10">
              <span className="sr-only">Buka detail</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {orders.map((order) => (
            <TR key={order.orderId}>
              <TD className="py-2.5">
                <Link
                  href={`/admin/orders/${order.orderId}`}
                  className="font-data tabular font-medium text-action underline-offset-4 hover:underline"
                >
                  {order.orderId}
                </Link>
              </TD>
              <TD className="py-2.5">
                {order.user ? (
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Avatar fullName={order.user.fullName} className="size-6" />
                    <span>
                      <span className="block text-body text-ink">
                        {order.user.fullName}
                      </span>
                      <span className="block font-data text-body text-ink-soft">
                        @{order.user.username}
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </TD>
              <TD className="whitespace-nowrap py-2.5">{order.service.name}</TD>
              {compact ? null : (
                <TD className="py-2.5">
                  <DataValue className="text-ink-soft">
                    {maskImei(order.imei)}
                  </DataValue>
                </TD>
              )}
              <TD className="py-2.5 text-right">
                <DataValue>{formatRupiah(order.price)}</DataValue>
              </TD>
              <TD className="py-2.5">
                <StatusBadge status={order.status} />
              </TD>
              <TD className="whitespace-nowrap py-2.5">
                {order.assignedAdmin ? (
                  order.assignedAdmin.fullName
                ) : (
                  <span className="text-ink-faint">Belum diambil</span>
                )}
              </TD>
              <TD className="py-2.5">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <time
                    dateTime={order.createdAt}
                    className="font-data tabular text-ink-soft"
                  >
                    {formatDateTime(order.createdAt)}
                  </time>
                  <Tag className="hidden xl:inline-flex">
                    {order.channel === "telegram" ? "TG" : "Web"}
                  </Tag>
                </span>
              </TD>
              <TD className="py-2.5 text-right">
                <Link
                  href={`/admin/orders/${order.orderId}`}
                  aria-label={`Buka detail order ${order.orderId}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors duration-150 ease-out-strong hover:bg-mist hover:text-ink"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}
