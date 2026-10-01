import * as crypto from "crypto";
import { getAdminJwtSecret } from "../config/env";

/** Newest key first; decryption also tries the ADMIN_JWT_SECRET-derived key. */
function encryptionKeys(): Buffer[] {
  const fallback = crypto.createHash("sha256").update(getAdminJwtSecret()).digest();
  const dedicated = process.env.SUPPLIER_ENCRYPTION_KEY?.trim();
  if (!dedicated) return [fallback];
  return [crypto.createHash("sha256").update(dedicated).digest(), fallback];
}

export function encryptSupplierKey(plain: string): string {
  const [key] = encryptionKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key!, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decryptSupplierKey(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  let lastError: unknown;
  for (const key of encryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function maskSupplierKey(plain: string): string {
  if (plain.length <= 10) return "••••";
  return `${plain.slice(0, 6)}••••${plain.slice(-4)}`;
}
