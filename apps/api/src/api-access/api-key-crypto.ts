import { createHash, randomBytes, timingSafeEqual } from "crypto";

const KEY_PREFIX = "al_live_";
const KEY_RANDOM_BYTES = 24;
/** `al_live_` plus 8 random hex characters; unique per key and safe to display. */
export const KEY_PREFIX_LENGTH = 16;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString("hex")}`;
  return { key, prefix: key.slice(0, KEY_PREFIX_LENGTH), hash: hashApiKey(key) };
}

export function looksLikeApiKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === KEY_PREFIX.length + KEY_RANDOM_BYTES * 2;
}

export function apiKeyMatches(key: string, storedHash: string): boolean {
  const a = Buffer.from(hashApiKey(key), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
