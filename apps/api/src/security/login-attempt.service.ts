import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

type AttemptState = { failures: number; firstFailureAt: number; lockedUntil: number };

/**
 * Per-account brute-force lockout (complements per-IP throttling, which a
 * distributed attacker can spread across many IPs). In-memory: state resets on
 * restart and is not shared between API replicas.
 */
@Injectable()
export class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptState>();

  assertNotLocked(key: string) {
    const state = this.attempts.get(key);
    if (!state) return;
    const now = Date.now();
    if (state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60_000);
      throw new HttpException(
        `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (now - state.firstFailureAt > FAILURE_WINDOW_MS) {
      this.attempts.delete(key);
    }
  }

  /** Returns true when this failure triggered a lock. */
  recordFailure(key: string): boolean {
    const now = Date.now();
    let state = this.attempts.get(key);
    if (!state || now - state.firstFailureAt > FAILURE_WINDOW_MS) {
      state = { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    }
    state.failures += 1;
    const locked = state.failures >= MAX_FAILURES;
    if (locked) {
      state.lockedUntil = now + LOCK_MS;
      state.failures = 0;
      state.firstFailureAt = now;
    }
    this.attempts.set(key, state);
    this.prune(now);
    return locked;
  }

  recordSuccess(key: string) {
    this.attempts.delete(key);
  }

  private prune(now: number) {
    if (this.attempts.size <= MAX_TRACKED_KEYS) return;
    for (const [key, state] of this.attempts) {
      if (
        state.lockedUntil <= now &&
        now - state.firstFailureAt > FAILURE_WINDOW_MS
      ) {
        this.attempts.delete(key);
      }
    }
  }
}
