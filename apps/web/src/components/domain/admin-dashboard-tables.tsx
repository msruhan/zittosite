"use client";

import * as React from "react";
import Link from "next/link";
import { DataValue } from "@/components/ui/data-value";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, TD, TH, THead, TR, Table, TableScroll } from "@/components/ui/table";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import type { OrderDetail } from "@/lib/types";

type ServiceProfitRow = {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
};

function marginPct(row: ServiceProfitRow): number {
  return row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0;
}

function NoMatch({ query }: { query: string }) {
  return (
    <p className="py-8 text-center text-body text-ink-soft">
      Tidak ada yang cocok dengan &ldquo;{query.trim()}&rdquo;.
    </p>
  );
}

export function ServiceProfitTable({ rows }: { rows: ServiceProfitRow[] }) {
  const [query, setQuery] = React.useState("");
  const filtered = rows.filter((row) => matchesSearch(query, [row.name]));

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-body text-ink-soft">
        Belum ada order sukses 30 hari terakhir.
      </p>
    );
  }

  return (
    <>
      <div className="border-b border-hairline p-3 sm:px-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari layanan"
          placeholder="Cari layanan"
        />
      </div>
      {filtered.length ? (
        <TableScroll>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Layanan</TH>
                <TH className="text-right">Order</TH>
                <TH className="text-right">Pendapatan</TH>
                <TH className="text-right">Modal</TH>
                <TH className="text-right">Untung</TH>
                <TH className="text-right">Margin</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium text-ink">{row.name}</TD>
                  <TD className="text-right">
                    <DataValue>{row.orders}</DataValue>
                  </TD>
                  <TD className="text-right">
                    <DataValue>{formatRupiah(row.revenue)}</DataValue>
                  </TD>
                  <TD className="text-right">
                    <DataValue className="text-ink-soft">{formatRupiah(row.cost)}</DataValue>
                  </TD>
                  <TD className="text-right">
                    <DataValue
                      emphasis
                      className={row.profit < 0 ? "text-refused-ink" : "text-cleared-ink"}
                    >
                      {formatRupiah(row.profit)}
                    </DataValue>
                  </TD>
                  <TD className="text-right">
                    <DataValue>{marginPct(row)}%</DataValue>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : (
        <NoMatch query={query} />
      )}
    </>
  );
}

export function RecentOrdersTable({ orders }: { orders: OrderDetail[] }) {
  const [query, setQuery] = React.useState("");
  const filtered = orders.filter((order) =>
    matchesSearch(query, [
      order.orderId,
      order.imei,
      order.user?.fullName,
      order.user?.username,
      order.service.name,
    ]),
  );

  return (
    <>
      <div className="border-b border-hairline p-3 sm:px-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari order terbaru"
          placeholder="Cari Order ID, IMEI, user, atau layanan"
        />
      </div>
      {filtered.length ? (
        <TableScroll>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Order ID</TH>
                <TH>User</TH>
                <TH>IMEI</TH>
                <TH>Status</TH>
                <TH>Dibuat</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((order) => (
                <TR key={order.id}>
                  <TD>
                    <Link
                      href={`/admin/orders/${order.orderId}`}
                      className="font-data text-action hover:underline"
                    >
                      {order.orderId}
                    </Link>
                  </TD>
                  <TD>{order.user?.fullName ?? "-"}</TD>
                  <TD>
                    <DataValue>{order.imei}</DataValue>
                  </TD>
                  <TD>
                    <StatusBadge status={order.status} />
                  </TD>
                  <TD>
                    <DataValue className="text-ink-soft">
                      {formatDateTime(order.createdAt)}
                    </DataValue>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : orders.length ? (
        <NoMatch query={query} />
      ) : (
        <p className="py-10 text-center text-body text-ink-soft">Belum ada order.</p>
      )}
    </>
  );
}
