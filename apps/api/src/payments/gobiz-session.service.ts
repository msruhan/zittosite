import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decryptSupplierKey, encryptSupplierKey } from "../suppliers/supplier-secret";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { GobizAuthError, GobizClient, type GobizTokens, normalizeGobizPhone } from "./gobiz.client";
import { newGobizDeviceId } from "./gobiz.constants";

export const GOBIZ_SESSION_KEY = "gobiz.session";
export const GOBIZ_PENDING_OTP_KEY = "gobiz.pending_otp";

const OTP_TTL_MS = 10 * 60 * 1000;

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  merchantId: string;
  merchantName: string | null;
  phoneMasked: string | null;
  connectedAt: string;
  refreshedAt: string;
  dead: boolean;
  deadReason?: string | null;
  deviceId?: string;
};

type StoredPendingOtp = {
  otpToken: string;
  phoneMasked: string;
  expiresAt: string;
  deviceId?: string;
};

type GobizSession = StoredSession & { deviceId: string };

export type GobizSessionStatus = {
  connected: boolean;
  dead: boolean;
  deadReason: string | null;
  merchantId: string | null;
  merchantName: string | null;
  phoneMasked: string | null;
  connectedAt: string | null;
  refreshedAt: string | null;
  pendingOtp: { phoneMasked: string; expiresAt: string } | null;
};

@Injectable()
export class GobizSessionService {
  private readonly logger = new Logger(GobizSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GobizClient,
    private readonly adminNotify: AdminNotifyService,
  ) {}

  async startOtpLogin(phone: string, adminId: string) {
    let normalized: string;
    try {
      normalized = normalizeGobizPhone(phone);
    } catch {
      throw new BadRequestException("Nomor HP tidak valid.");
    }
    const deviceId = newGobizDeviceId();
    const { otpToken, otpLength } = await this.client.requestOtp(normalized, deviceId);
    const pending: StoredPendingOtp = {
      otpToken: encryptSupplierKey(otpToken),
      phoneMasked: maskPhone(normalized),
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      deviceId,
    };
    await this.writeSetting(GOBIZ_PENDING_OTP_KEY, pending, adminId);
    return { phoneMasked: pending.phoneMasked, otpLength, expiresAt: pending.expiresAt };
  }

  async completeOtpLogin(otp: string, adminId: string): Promise<GobizSessionStatus> {
    const code = otp.trim();
    if (!/^\d{4,8}$/.test(code)) throw new BadRequestException("Kode OTP tidak valid.");
    const pending = await this.readSetting<StoredPendingOtp>(GOBIZ_PENDING_OTP_KEY);
    if (!pending || new Date(pending.expiresAt).getTime() < Date.now() || !pending.deviceId) {
      throw new BadRequestException("OTP sudah kedaluwarsa. Kirim ulang OTP.");
    }
    let tokens: GobizTokens;
    try {
      tokens = await this.client.verifyOtp(code, decryptSupplierKey(pending.otpToken), pending.deviceId);
    } catch (err) {
      if (err instanceof GobizAuthError) throw new BadRequestException("Kode OTP salah atau sudah kedaluwarsa.");
      throw err;
    }
    const merchant = await this.client.findMerchant(tokens.accessToken, pending.deviceId);
    const now = new Date().toISOString();
    await this.writeSession(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        merchantId: merchant.id,
        merchantName: merchant.name,
        phoneMasked: pending.phoneMasked,
        connectedAt: now,
        refreshedAt: now,
        dead: false,
        deadReason: null,
        deviceId: pending.deviceId,
      },
      adminId,
    );
    await this.prisma.systemSetting.deleteMany({ where: { key: GOBIZ_PENDING_OTP_KEY } });
    this.logger.log(`GoBiz connected to merchant ${merchant.id}`);
    return this.status();
  }

  async disconnect(): Promise<void> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: { in: [GOBIZ_SESSION_KEY, GOBIZ_PENDING_OTP_KEY] } },
    });
  }

  async status(): Promise<GobizSessionStatus> {
    const [session, pending] = await Promise.all([
      this.readSetting<StoredSession>(GOBIZ_SESSION_KEY),
      this.readSetting<StoredPendingOtp>(GOBIZ_PENDING_OTP_KEY),
    ]);
    const pendingActive = pending && new Date(pending.expiresAt).getTime() > Date.now();
    return {
      connected: Boolean(session && !session.dead),
      dead: Boolean(session?.dead),
      deadReason: session?.deadReason ?? null,
      merchantId: session?.merchantId ?? null,
      merchantName: session?.merchantName ?? null,
      phoneMasked: session?.phoneMasked ?? null,
      connectedAt: session?.connectedAt ?? null,
      refreshedAt: session?.refreshedAt ?? null,
      pendingOtp: pendingActive ? { phoneMasked: pending.phoneMasked, expiresAt: pending.expiresAt } : null,
    };
  }

  async withToken<T>(
    fn: (accessToken: string, merchantId: string, deviceId: string) => Promise<T>,
  ): Promise<T | null> {
    const session = await this.load();
    if (!session || session.dead) return null;
    try {
      return await fn(session.accessToken, session.merchantId, session.deviceId);
    } catch (err) {
      if (!(err instanceof GobizAuthError)) throw err;
    }
    const refreshed = await this.refresh(session);
    if (!refreshed) return null;
    return fn(refreshed.accessToken, refreshed.merchantId, refreshed.deviceId);
  }

  async refreshIfOlderThan(maxAgeMs: number): Promise<void> {
    const session = await this.load();
    if (!session || session.dead) return;
    if (Date.now() - new Date(session.refreshedAt).getTime() < maxAgeMs) return;
    await this.refresh(session);
  }

  private async load(): Promise<GobizSession | null> {
    const stored = await this.readSetting<StoredSession>(GOBIZ_SESSION_KEY);
    if (!stored) return null;
    return {
      ...stored,
      accessToken: decryptSupplierKey(stored.accessToken),
      refreshToken: decryptSupplierKey(stored.refreshToken),
      deviceId: stored.deviceId || newGobizDeviceId(),
    };
  }

  private async refresh(session: GobizSession): Promise<GobizSession | null> {
    try {
      const tokens = await this.client.refresh(session.refreshToken, session.deviceId);
      const next: GobizSession = { ...session, ...tokens, refreshedAt: new Date().toISOString() };
      await this.writeSession(next);
      return next;
    } catch (err) {
      if (!(err instanceof GobizAuthError)) throw err;
      await this.markDead(session, err.message);
      return null;
    }
  }

  private async markDead(session: GobizSession, reason: string) {
    await this.writeSession({ ...session, dead: true, deadReason: reason });
    this.logger.warn(`GoBiz session marked dead: ${reason}`);
    void this.adminNotify
      .notify("⚠️ Sesi Listener VPS (GoBiz) putus. Sambungkan ulang lewat OTP di menu Pembayaran.")
      .catch(() => undefined);
  }

  private async writeSession(session: GobizSession, adminId?: string) {
    const stored: StoredSession = {
      ...session,
      accessToken: encryptSupplierKey(session.accessToken),
      refreshToken: encryptSupplierKey(session.refreshToken),
    };
    await this.writeSetting(GOBIZ_SESSION_KEY, stored, adminId);
  }

  private async readSetting<T>(key: string): Promise<T | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value && typeof row.value === "object" ? (row.value as T) : null;
  }

  private async writeSetting(key: string, value: object, adminId?: string) {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: json, updatedBy: adminId ?? null },
      update: { value: json, ...(adminId ? { updatedBy: adminId } : {}) },
    });
  }
}

export function maskPhone(bareNational: string): string {
  return `+62 ${bareNational.slice(0, 3)}****${bareNational.slice(-3)}`;
}
