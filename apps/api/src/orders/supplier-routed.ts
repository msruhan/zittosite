import type { Prisma, ServiceMenu } from "@prisma/client";
import { MAX_BULK_IMEIS, MAX_SPECIAL_BULK } from "./imei-list";

/**
 * Orders handled by an upstream Dhru supplier (e.g. CeirBot): already
 * forwarded, or placed on a supplier-routed service and not forwarded yet.
 */
export const SUPPLIER_ROUTED_ORDER: Prisma.OrderWhereInput = {
  OR: [{ supplierId: { not: null } }, { service: { fulfillmentChannel: "supplier" } }],
};

/**
 * Website split: "manual" = regular orders (Telegram/WhatsApp), "supplier" = every
 * supplier order, "ceir" / "special" = supplier orders under Order Ceir / Layanan Spesial.
 */
export type OrderVia = "supplier" | "manual" | "ceir" | "special";

const VIAS: readonly OrderVia[] = ["supplier", "manual", "ceir", "special"];

export function parseVia(value?: string): OrderVia | undefined {
  return VIAS.find((via) => via === value);
}

function menuOf(via: OrderVia): ServiceMenu | undefined {
  return via === "ceir" || via === "special" ? via : undefined;
}

export function orderViaWhere(via?: OrderVia): Prisma.OrderWhereInput {
  if (!via) return {};
  if (via === "manual") return { NOT: SUPPLIER_ROUTED_ORDER };
  const menu = menuOf(via);
  return { AND: [SUPPLIER_ROUTED_ORDER, ...(menu ? [{ service: { menu } }] : [])] };
}

export function isSpecialService(service: {
  fulfillmentChannel: string;
  menu: ServiceMenu;
}): boolean {
  return service.fulfillmentChannel === "supplier" && service.menu === "special";
}

/** Most IMEI/SN/ECID values one bulk order may carry for this service. */
export function maxBulkFor(service: { fulfillmentChannel: string; menu: ServiceMenu }): number {
  return isSpecialService(service) ? MAX_SPECIAL_BULK : MAX_BULK_IMEIS;
}

export function serviceViaWhere(via?: OrderVia): Prisma.ServiceWhereInput {
  if (!via) return {};
  if (via === "manual") return { fulfillmentChannel: { not: "supplier" } };
  const menu = menuOf(via);
  return { fulfillmentChannel: "supplier", ...(menu ? { menu } : {}) };
}
