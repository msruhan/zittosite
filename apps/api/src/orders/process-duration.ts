const MINUTE_MS = 60_000;

/** `55 menit`, `1 jam 22 menit`, `2 hari 3 jam`; under a minute is `< 1 menit`. */
export function formatProcessDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  if (totalMinutes < 1) return "< 1 menit";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} hari ${hours} jam` : `${days} hari`;
  if (hours > 0) return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  return `${minutes} menit`;
}

type DurationSource = {
  createdAt: Date;
  invoice?: { paidAt: Date | null } | null;
  activity?: Array<{ status: string; createdAt: Date }>;
};

/**
 * Time from payment received to the order closing as done/rejected. Falls back
 * to the invoice's paid time, then order creation, and to now for the end.
 */
export function processDurationLabel(order: DurationSource, now = new Date()): string {
  const paidLog = order.activity?.find((log) => log.status === "paid");
  const start = paidLog?.createdAt ?? order.invoice?.paidAt ?? order.createdAt;
  const endLog = order.activity
    ?.filter((log) => log.status === "done" || log.status === "rejected")
    .at(-1);
  const end = endLog?.createdAt ?? now;
  return formatProcessDuration(end.getTime() - start.getTime());
}
