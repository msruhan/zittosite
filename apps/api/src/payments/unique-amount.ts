export const UNIQUE_CODE_MAX = 999;

/** First free addition in 1..999, walking from `start`. The payable is `charge + code`. */
export function pickUniqueCode(charge: number, used: Set<number>, start: number): number | null {
  for (let offset = 0; offset < UNIQUE_CODE_MAX; offset += 1) {
    const code = ((start + offset - 1) % UNIQUE_CODE_MAX) + 1;
    if (!used.has(charge + code)) return code;
  }
  return null;
}
