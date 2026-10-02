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

const SPECIAL: OrderMenu = {
  listHref: "/app/riwayat",
  listLabel: "Riwayat order",
  createHref: "/app/spesial/order",
};

/** Supplier API services are created under Order Ceir or Layanan Spesial; all orders share one history. */
export function orderMenu(service?: Pick<Service, "via" | "menu"> | null): OrderMenu {
  if (service?.via !== "supplier") return REGULAR;
  return service.menu === "special" ? SPECIAL : CEIR;
}
