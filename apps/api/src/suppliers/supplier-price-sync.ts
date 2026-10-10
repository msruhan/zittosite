import type { MenuCurrency, Prisma } from "@prisma/client";
import { supplierCreditToMenuUnits, usdCentsToIdr } from "../orders/usd-pricing";
import type { RemoteCurrency } from "./dhru-supplier-client";

export type SyncedService = {
  id: string;
  name: string;
  menu: { priceCurrency: MenuCurrency } | null;
  active: boolean;
  price: number;
  costPrice: number;
  costUsdCents: number | null;
  supplierServiceId: string;
};

export type PriceChange = {
  name: string;
  /** USD cents for USD menus, Rupiah otherwise — same units as the import. */
  before: number;
  after: number;
  usd: boolean;
};

export type PriceSyncPlan = {
  updates: Array<{ id: string; data: Prisma.ServiceUpdateInput }>;
  changed: PriceChange[];
  /** Gone from the supplier panel and switched Offline by this sync. */
  offline: string[];
  /** Selling price now below the new cost; the selling price is left for the admin. */
  belowCost: string[];
  unchanged: number;
};

/**
 * Only the cost follows the supplier; selling prices stay as the admin set them.
 * The credit is converted from the supplier's declared currency to the menu's;
 * without one, USD menus read it as dollars and Rupiah menus as Rupiah (as on import).
 */
export function planPriceSync(
  services: SyncedService[],
  remote: Array<{ id: string; credit: number; currency?: RemoteCurrency | null }>,
  usdRate: number,
): PriceSyncPlan {
  const byId = new Map(remote.map((svc) => [svc.id, svc]));
  const plan: PriceSyncPlan = { updates: [], changed: [], offline: [], belowCost: [], unchanged: 0 };

  for (const service of services) {
    const listed = byId.get(service.supplierServiceId);
    if (listed === undefined) {
      if (service.active) {
        plan.updates.push({ id: service.id, data: { active: false } });
        plan.offline.push(service.name);
      } else plan.unchanged++;
      continue;
    }
    // The client reads an unparsable CREDIT as 0; never zero a cost on that.
    if (!(listed.credit > 0)) {
      plan.unchanged++;
      continue;
    }

    const usd = service.menu?.priceCurrency === "USD";
    const before = usd ? (service.costUsdCents ?? 0) : service.costPrice;
    const after = supplierCreditToMenuUnits(
      listed.credit,
      listed.currency ?? null,
      usd ? "USD" : "IDR",
      usdRate,
    );
    const costIdr = usd ? usdCentsToIdr(after, usdRate) : after;
    if (before === after && (!usd || service.costUsdCents !== null)) {
      plan.unchanged++;
    } else {
      plan.updates.push({
        id: service.id,
        data: usd ? { costUsdCents: after, costPrice: costIdr } : { costPrice: after },
      });
      plan.changed.push({ name: service.name, before, after, usd });
    }
    if (service.price < costIdr) plan.belowCost.push(service.name);
  }
  return plan;
}
