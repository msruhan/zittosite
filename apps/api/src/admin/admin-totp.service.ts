import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import * as QRCode from "qrcode";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { getAdminJwtSecret } from "../config/env";

export type TotpAction = "login" | "password";
export type TotpPrefs = Record<TotpAction, boolean>;

export const DEFAULT_TOTP_PREFS: TotpPrefs = {
  login: true,
  password: true,
};

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encryptSecret(plain: string): string {
  const key = crypto.createHash("sha256").update(getAdminJwtSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptSecret(payload: string): string {
  const key = crypto.createHash("sha256").update(getAdminJwtSecret()).digest();
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

function randomBase32(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const cleaned = secret.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const code = String(token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32ToBuffer(secretBase32);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (hotp(key, step + w) === code) return true;
  }
  return false;
}

export function parseTotpPrefs(raw: unknown): TotpPrefs {
  const base = { ...DEFAULT_TOTP_PREFS };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.login === "boolean") base.login = obj.login;
  if (typeof obj.password === "boolean") base.password = obj.password;
  return base;
}

@Injectable()
export class AdminTotpService {
  constructor(private readonly prisma: PrismaService) {}

  async status(adminId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { totpEnabledAt: true, totpPrefs: true, username: true },
    });
    return {
      enabled: Boolean(admin.totpEnabledAt),
      enabledAt: admin.totpEnabledAt,
      prefs: parseTotpPrefs(admin.totpPrefs),
    };
  }

  async needsLoginTotp(admin: {
    totpEnabledAt: Date | null;
    totpPrefs: unknown;
  }) {
    if (!admin.totpEnabledAt) return false;
    return parseTotpPrefs(admin.totpPrefs).login;
  }

  async verifyForAdmin(adminId: string, code: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (!admin.totpEnabledAt || !admin.totpSecret) return false;
    return verifyTotp(decryptSecret(admin.totpSecret), code);
  }

  async assertAction(adminId: string, action: TotpAction, code?: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { totpEnabledAt: true, totpPrefs: true, totpSecret: true },
    });
    if (!admin.totpEnabledAt) return;
    const prefs = parseTotpPrefs(admin.totpPrefs);
    if (!prefs[action]) return;
    if (!admin.totpSecret || !verifyTotp(decryptSecret(admin.totpSecret), String(code ?? ""))) {
      throw new UnauthorizedException("Kode authenticator salah atau diperlukan.");
    }
  }

  async beginSetup(adminId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { username: true, totpEnabledAt: true },
    });
    if (admin.totpEnabledAt) {
      throw new BadRequestException("2FA sudah aktif.");
    }
    const secret = randomBase32();
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpSecret: encryptSecret(secret) },
    });
    const label = encodeURIComponent(`ZITTOSITE:${admin.username}`);
    const issuer = encodeURIComponent("ZITTOSITE");
    const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
    return { secret, qrDataUrl };
  }

  async enable(adminId: string, code: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (admin.totpEnabledAt) {
      throw new BadRequestException("2FA sudah aktif.");
    }
    if (!admin.totpSecret) {
      throw new BadRequestException("Jalankan setup 2FA terlebih dahulu.");
    }
    if (!verifyTotp(decryptSecret(admin.totpSecret), code)) {
      throw new UnauthorizedException("Kode authenticator salah.");
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        totpEnabledAt: new Date(),
        totpPrefs: DEFAULT_TOTP_PREFS,
      },
    });
    return { ok: true };
  }

  async disable(adminId: string, password: string, code: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.totpEnabledAt) {
      throw new BadRequestException("2FA belum aktif.");
    }
    const okPw = await bcrypt.compare(password, admin.passwordHash);
    if (!okPw) throw new UnauthorizedException("Password salah.");
    if (!admin.totpSecret || !verifyTotp(decryptSecret(admin.totpSecret), code)) {
      throw new UnauthorizedException("Kode authenticator salah.");
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpPrefs: Prisma.DbNull,
      },
    });
    return { ok: true };
  }
}
