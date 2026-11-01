import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { qrisMerchantName, qrisWithAmount, validateStatic } from "./qris";
import { UNIQUE_CODE_MAX, pickUniqueCode } from "./unique-amount";

export const PAYMENT_GATEWAY_KEY = "payment.gateway";
export const PAYMENT_QRIS_STATIC_KEY = "payment.qris_static";

export type PaymentGateway = "sayabayar" | "listener";

/** Paid listener amounts stay reserved so a late payment cannot match a newer invoice. */
const SETTLED_RESERVE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentModeService {
  constructor(private readonly prisma: PrismaService) {}

  async gateway(): Promise<PaymentGateway> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: PAYMENT_GATEWAY_KEY } });
    return row?.value === "listener" ? "listener" : "sayabayar";
  }

  async setGateway(gateway: PaymentGateway, adminId: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: PAYMENT_GATEWAY_KEY },
      create: { key: PAYMENT_GATEWAY_KEY, value: gateway, updatedBy: adminId },
      update: { value: gateway, updatedBy: adminId },
    });
  }

  async staticQris(): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: PAYMENT_QRIS_STATIC_KEY } });
    return typeof row?.value === "string" && row.value.trim() ? row.value.trim() : null;
  }

  async setStaticQris(payload: string, adminId: string): Promise<{ merchantName: string | null }> {
    const value = payload.trim();
    try {
      validateStatic(value);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "QRIS statis tidak valid.");
    }
    await this.prisma.systemSetting.upsert({
      where: { key: PAYMENT_QRIS_STATIC_KEY },
      create: { key: PAYMENT_QRIS_STATIC_KEY, value, updatedBy: adminId },
      update: { value, updatedBy: adminId },
    });
    return { merchantName: qrisMerchantName(value) };
  }

  /**
   * Reserves charge+1..charge+999 and returns a dynamic QR for that exact payable.
   * Must run inside the invoice transaction so two checkouts cannot share a nominal.
   */
  async reserve(tx: Prisma.TransactionClient, charge: number): Promise<{ amountDue: number; qrisString: string }> {
    if (!Number.isInteger(charge) || charge < 1) {
      throw new BadRequestException("Nominal pembayaran tidak valid.");
    }
    const payload = await this.staticQris();
    if (!payload) {
      throw new ServiceUnavailableException(
        "QRIS Listener VPS belum diisi. Super Admin mengaturnya di menu Pembayaran.",
      );
    }
    const occupied = await tx.paymentInvoice.findMany({
      where: {
        paymentChannel: "listener",
        amountDue: { gte: charge + 1, lte: charge + UNIQUE_CODE_MAX },
        OR: [
          { paymentStatus: "pending" },
          { paymentStatus: "paid", paidAt: { gte: new Date(Date.now() - SETTLED_RESERVE_MS) } },
        ],
      },
      select: { amountDue: true },
    });
    const used = new Set(occupied.flatMap((row) => (row.amountDue == null ? [] : [row.amountDue])));
    const code = pickUniqueCode(charge, used, randomInt(1, UNIQUE_CODE_MAX + 1));
    if (code === null) {
      throw new ConflictException("Nominal unik untuk pembayaran ini sedang penuh. Coba lagi sebentar.");
    }
    const amountDue = charge + code;
    try {
      return { amountDue, qrisString: qrisWithAmount(payload, amountDue) };
    } catch (err) {
      throw new ServiceUnavailableException(err instanceof Error ? err.message : "QRIS tidak dapat dibuat.");
    }
  }
}
