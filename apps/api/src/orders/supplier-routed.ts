import type { Prisma } from "@prisma/client";

/**
 * Orders handled by an upstream Dhru supplier (e.g. CeirBot): already
 * forwarded, or placed on a supplier-routed service and not forwarded yet.
 */
export const SUPPLIER_ROUTED_ORDER: Prisma.OrderWhereInput = {
  OR: [{ supplierId: { not: null } }, { service: { fulfillmentChannel: "supplier" } }],
};
