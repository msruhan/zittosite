"use client";

import * as React from "react";
import { SearchInput } from "@/components/ui/search-input";
import { UserOrderTable } from "@/components/domain/user-order-table";
import { matchesSearch } from "@/lib/search";
import type { OrderDetail } from "@/lib/types";

export function SearchableUserOrderTable({ orders }: { orders: OrderDetail[] }) {
  const [query, setQuery] = React.useState("");
  const filtered = orders.filter((order) =>
    matchesSearch(query, [order.orderId, order.imei, order.service.name]),
  );

  return (
    <>
      <div className="border-b border-hairline p-3 sm:px-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari order terbaru"
          placeholder="Cari Order ID, IMEI, atau layanan"
        />
      </div>
      {filtered.length ? (
        <UserOrderTable orders={filtered} />
      ) : (
        <p className="py-8 text-center text-body text-ink-soft">
          Tidak ada order yang cocok dengan &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
    </>
  );
}
