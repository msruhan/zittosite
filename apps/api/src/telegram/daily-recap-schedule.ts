import type { AdminDayStats, SuperAdminRecap } from "./order-recap.service";

export const DAILY_RECAP_HOUR = 23;
export const DAILY_RECAP_MINUTE = 0;

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds from `now` until the next hh:mm in Asia/Jakarta (UTC+7, no DST). */
export function msUntilJakartaTime(now: Date, hour: number, minute: number): number {
  const local = now.getTime() + JAKARTA_OFFSET_MS;
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  let target = dayStart + (hour * 60 + minute) * 60 * 1000;
  if (target <= local) target += DAY_MS;
  return target - local;
}

function handledAny(stats: AdminDayStats): boolean {
  return stats.taken + stats.done + stats.rejected > 0;
}

/** A day without new orders, payments or handled orders gets no scheduled recap. */
export function recapHasActivity(recap: SuperAdminRecap): boolean {
  return (
    recap.created.total > 0 ||
    recap.revenue.payments > 0 ||
    handledAny(recap.handled) ||
    handledAny(recap.whatsapp) ||
    recap.perAdmin.some((admin) => admin.orders.length > 0)
  );
}
