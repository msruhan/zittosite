import type { Service } from "@/lib/types";
import { ORDER_MENU_HREF, menuOrderHref } from "@/lib/user-menus";

export type OrderMenu = {
  listHref: string;
  listLabel: string;
  createHref: string;
};

/** Supplier API services are created under their service menu; all orders share one history. */
export function orderMenu(service?: Pick<Service, "via" | "menu"> | null): OrderMenu {
  const slug = service?.via === "supplier" ? service.menu?.slug : undefined;
  return {
    listHref: "/app/riwayat",
    listLabel: "Riwayat order",
    createHref: slug ? menuOrderHref(slug) : ORDER_MENU_HREF,
  };
}
