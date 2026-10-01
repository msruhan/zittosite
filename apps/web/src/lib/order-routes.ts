import type { Service } from "@/lib/types";

export type OrderMenu = {
  listHref: string;
  listLabel: string;
  createHref: string;
};

const REGULAR: OrderMenu = {
  listHref: "/app/riwayat",
  listLabel: "Riwayat order",
  createHref: "/app/order",
};

const CEIR: OrderMenu = {
  listHref: "/app/riwayat",
  listLabel: "Riwayat order",
  createHref: "/app/ceir/order",
};

/** Supplier API services are created under Order Ceir; all orders share one history. */
export function orderMenu(service?: Pick<Service, "via"> | null): OrderMenu {
  return service?.via === "supplier" ? CEIR : REGULAR;
}
