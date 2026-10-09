import type { Prisma, ServiceMenu } from "@prisma/client";
import { usdCentsToIdr } from "../orders/usd-pricing";

export type SyncedService = {
  id: string;
  name: string;
  menu: ServiceMenu;
  active: boolean;
  price: number;
  costPrice: number;
  costUsdCents: number | null;
  supplierServiceId: string;
};

export type PriceChange = {
  name: string;
  /** USD cents for Layanan Spesial, Rupiah otherwise — same units as the import. */
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
 * Layanan Spesial read the supplier credit as USD, Order Ceir as Rupiah (as on import).
 */
export function planPriceSync(
  services: SyncedService[],
  remote: Array<{ id: string; credit: number }>,
  usdRate: number,
): PriceSyncPlan {
  const credits = new Map(remote.map((svc) => [svc.id, svc.credit]));
  const plan: PriceSyncPlan = { updates: [], changed: [], offline: [], belowCost: [], unchanged: 0 };

  for (const service of services) {
    const credit = credits.get(service.supplierServiceId);
    if (credit === undefined) {
      if (service.active) {
        plan.updates.push({ id: service.id, data: { active: false } });
        plan.offline.push(service.name);
      } else plan.unchanged++;
      continue;
    }
    // The client reads an unparsable CREDIT as 0; never zero a cost on that.
    if (!(credit > 0)) {
      plan.unchanged++;
      continue;
    }

    const usd = service.menu === "special";
    const before = usd ? (service.costUsdCents ?? 0) : service.costPrice;
    const after = Math.round(credit * (usd ? 100 : 1));
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
