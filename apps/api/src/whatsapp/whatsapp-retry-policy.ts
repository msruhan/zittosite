export const MAX_ATTEMPTS = 10;

const BACKOFF_MINUTES = [1, 2, 5, 10];
const MAX_BACKOFF_MINUTES = 30;

/** Delay before the next try after `attempts` failed sends (1-based). */
export function backoffMs(attempts: number): number {
  const minutes = BACKOFF_MINUTES[attempts - 1] ?? MAX_BACKOFF_MINUTES;
  return minutes * 60_000;
}

export function shouldGiveUp(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
