import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DataValue } from "@/components/ui/data-value";
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
import { formatDateTime, maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const USER_ORDER_COLUMNS = [
  "Order ID",
  "Layanan",
  "IMEI",
  "Status",
  "Tanggal",
  "",
];

export function UserOrderTable({ orders }: { orders: OrderDetail[] }) {
  return (
    <TableScroll>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Order ID</TH>
            <TH>Layanan</TH>
            <TH>IMEI</TH>
            <TH>Status</TH>
            <TH>Tanggal</TH>
            <TH className="w-10">
              <span className="sr-only">Buka detail</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {orders.map((order) => (
            <TR key={order.orderId}>
              <TD>
                <Link
                  href={`/app/order/${order.orderId}`}
                  className="font-data tabular font-medium text-action underline-offset-4 hover:underline"
                >
                  {order.orderId}
                </Link>
              </TD>
              <TD className="whitespace-nowrap">{order.service.name}</TD>
              <TD>
                <DataValue className="text-ink-soft">
                  {maskImei(order.imei)}
                </DataValue>
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
              <TD className="text-right">
                <Link
                  href={`/app/order/${order.orderId}`}
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
