import type { Prisma } from "@prisma/client";

/**
 * Orders handled by an upstream Dhru supplier (e.g. CeirBot): already
 * forwarded, or placed on a supplier-routed service and not forwarded yet.
 */
export const SUPPLIER_ROUTED_ORDER: Prisma.OrderWhereInput = {
  OR: [{ supplierId: { not: null } }, { service: { fulfillmentChannel: "supplier" } }],
};

/** Website split: "supplier" = Order Ceir, "manual" = regular orders (Telegram/WhatsApp). */
export type OrderVia = "supplier" | "manual";

export function parseVia(value?: string): OrderVia | undefined {
  return value === "supplier" || value === "manual" ? value : undefined;
}

export function orderViaWhere(via?: OrderVia): Prisma.OrderWhereInput {
  if (via === "supplier") return { AND: [SUPPLIER_ROUTED_ORDER] };
  if (via === "manual") return { NOT: SUPPLIER_ROUTED_ORDER };
  return {};
}

/** CeirBot's Layanan Ceir checks use `ceir-<code>` ids; every other supplier service is Layanan Spesial. */
export function isSpecialSupplierService(supplierServiceId: string | null | undefined): boolean {
  const id = supplierServiceId?.trim().toLowerCase();
  return Boolean(id) && !id!.startsWith("ceir-");
}

export function serviceViaWhere(via?: OrderVia): Prisma.ServiceWhereInput {
  if (via === "supplier") return { fulfillmentChannel: "supplier" };
  if (via === "manual") return { fulfillmentChannel: { not: "supplier" } };
  return {};
}
