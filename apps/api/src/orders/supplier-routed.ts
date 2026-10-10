import type { MenuCurrency, MenuStyle, Prisma } from "@prisma/client";
import { MAX_BULK_IMEIS, MAX_SPECIAL_BULK } from "./imei-list";

/**
 * Orders handled by an upstream Dhru supplier (e.g. CeirBot): already
 * forwarded, or placed on a supplier-routed service and not forwarded yet.
 */
export const SUPPLIER_ROUTED_ORDER: Prisma.OrderWhereInput = {
  OR: [{ supplierId: { not: null } }, { service: { fulfillmentChannel: "supplier" } }],
};

/** The parts of a service menu that change how its services behave. */
export type MenuBehaviour = { style: MenuStyle; priceCurrency: MenuCurrency };

export const MENU_SELECT = {
  id: true,
  slug: true,
  label: true,
  enabled: true,
  sortOrder: true,
  style: true,
  priceCurrency: true,
} as const satisfies Prisma.ServiceMenuSelect;

export type MenuInfo = Prisma.ServiceMenuGetPayload<{ select: typeof MENU_SELECT }>;

/**
 * Website split: "manual" = regular orders (Telegram/WhatsApp), "supplier" = every
 * supplier order, any other value = supplier orders under the menu with that slug.
 */
export type OrderVia = "supplier" | "manual" | `menu:${string}`;

const SLUG = /^[a-z0-9][a-z0-9-]{0,19}$/;

export function parseVia(value?: string): OrderVia | undefined {
  if (!value) return undefined;
  if (value === "supplier" || value === "manual") return value;
  return SLUG.test(value) ? `menu:${value}` : undefined;
}

export function orderViaWhere(via?: OrderVia): Prisma.OrderWhereInput {
  if (!via) return {};
  if (via === "manual") return { NOT: SUPPLIER_ROUTED_ORDER };
  if (via === "supplier") return SUPPLIER_ROUTED_ORDER;
  return { AND: [SUPPLIER_ROUTED_ORDER, { service: { menu: { slug: via.slice(5) } } }] };
}

type RoutedService = { fulfillmentChannel: string; menu: Pick<MenuBehaviour, "style"> | null };

export function isSpecialService(service: RoutedService): boolean {
  return service.fulfillmentChannel === "supplier" && service.menu?.style === "special";
}

/** Supplier services in a USD menu keep USD cents; everything else is priced in Rupiah. */
export function isUsdService(service: {
  fulfillmentChannel: string;
  menu: Pick<MenuBehaviour, "priceCurrency"> | null;
}): boolean {
  return service.fulfillmentChannel === "supplier" && service.menu?.priceCurrency === "USD";
}

/** Most IMEI/SN/ECID values one bulk order may carry for this service. */
export function maxBulkFor(service: RoutedService): number {
  return isSpecialService(service) ? MAX_SPECIAL_BULK : MAX_BULK_IMEIS;
}

export function serviceViaWhere(via?: OrderVia): Prisma.ServiceWhereInput {
  if (!via) return {};
  if (via === "manual") return { fulfillmentChannel: { not: "supplier" } };
  if (via === "supplier") return { fulfillmentChannel: "supplier" };
  return { fulfillmentChannel: "supplier", menu: { slug: via.slice(5) } };
}
