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
