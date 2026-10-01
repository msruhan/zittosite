/**
 * In-memory fixed-window counter keyed by an arbitrary string (API key id,
 * IP). The API runs as a single process, so memory is the source of truth.
 */
export class RateWindow {
  private readonly hits = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Counts a hit; returns false once the key is over the limit for this window. */
  take(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: now, count: 1 });
      this.prune(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** True while the key is over the limit, without counting a hit. */
  blocked(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    return Boolean(entry && now - entry.windowStart < this.windowMs && entry.count >= this.limit);
  }

  private prune(now: number) {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
    }
  }
}
