import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, type PaymentInvoice } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { paymentSimulationEnabled, webPublicUrl } from "../config/env";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { AuditLogService } from "../security/audit-log.service";
import { SayabayarClient } from "../payments/sayabayar.client";
import {
  topupPaidSuperAdminHtml,
  topupPaidUserHtml,
} from "../telegram/telegram-messages";
import { applyBalance } from "./balance";
import { parseTopupAmount, topupIdPrefix, topupLimitMessage } from "./topup-amount";

const TOPUP_TTL_MINUTES = 60;

export function serializeTopup(invoice: PaymentInvoice) {
  return {
    invoiceId: invoice.invoiceId,
    amount: invoice.amount,
    amountDue: invoice.amountDue ?? invoice.amount,
    status: invoice.paymentStatus,
    qrisString: invoice.qrisString,
    checkoutUrl: invoice.checkoutUrl,
    paymentChannel: invoice.paymentChannel,
    expiredAt: invoice.expiredAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export type SerializedTopup = ReturnType<typeof serializeTopup>;

/**
 * Balance topups paid by QRIS. A topup is a PaymentInvoice with
 * purpose=topup and no orders; paying it credits the user's balance once.
 */
@Injectable()
export class TopupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sayabayar: SayabayarClient,
    private readonly audit: AuditLogService,
    private readonly adminNotify: AdminNotifyService,
  ) {}

  async list(userId: string) {
    const pending = await this.pending(userId);
    const history = await this.prisma.paymentInvoice.findMany({
      where: { userId, purpose: "topup" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return { pending, history: history.map(serializeTopup) };
  }

  /** The user's open topup, after closing it if its payment window has passed. */
  async pending(userId: string): Promise<SerializedTopup | null> {
    const invoice = await this.prisma.paymentInvoice.findFirst({
      where: { userId, purpose: "topup", paymentStatus: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (!invoice) return null;
    const current = await this.ensureNotExpired(invoice);
    return current.paymentStatus === "pending" ? serializeTopup(current) : null;
  }

  async get(userId: string, invoiceId: string) {
    return serializeTopup(await this.ensureNotExpired(await this.findOwned(userId, invoiceId)));
  }

  /** Creates a topup invoice, or returns the open one (`created: false`). */
  async create(userId: string, rawAmount: unknown, channel: "web" | "telegram") {
    const amount = parseTopupAmount(rawAmount);
    if (amount === null) throw new BadRequestException(topupLimitMessage());

    const existing = await this.pending(userId);
    if (existing) return { topup: existing, created: false };

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const invoiceId = await this.nextInvoiceId();

    let gateway = null;
    if (this.sayabayar.enabled()) {
      gateway = await this.sayabayar.createInvoice({
        amount,
        description: `Topup saldo — ${invoiceId}`,
        customerName: user.fullName,
        expiredMinutes: TOPUP_TTL_MINUTES,
        redirectUrl: `${webPublicUrl()}/app/topup`,
      });
    } else if (!paymentSimulationEnabled()) {
      throw new ServiceUnavailableException("Pembayaran belum tersedia. Hubungi admin.");
    }

    const invoice = await this.prisma.paymentInvoice.create({
      data: {
        invoiceId,
        purpose: "topup",
        userId,
        amount,
        paymentStatus: "pending",
        expiredAt:
          gateway?.expiredAt ?? new Date(Date.now() + TOPUP_TTL_MINUTES * 60_000),
        ...(gateway
          ? {
              paymentChannel: "sayabayar",
              paymentReference: gateway.id,
              amountDue: gateway.amountDue,
              qrisString: gateway.qrisString,
              checkoutUrl: gateway.paymentUrl,
              gatewayPayload: gateway.raw as Prisma.InputJsonValue,
            }
          : { paymentChannel: "qris_placeholder" }),
      },
    });
    this.audit.record("balance.topup_created", {
      actorUserId: userId,
      invoiceId,
      amount,
      channel,
    });
    return { topup: serializeTopup(invoice), created: true };
  }

  async cancel(userId: string, invoiceId: string) {
    const invoice = await this.findOwned(userId, invoiceId);
    if (invoice.paymentStatus !== "pending") {
      throw new BadRequestException("Topup ini sudah tidak menunggu pembayaran.");
    }
    await this.prisma.paymentInvoice.updateMany({
      where: { id: invoice.id, paymentStatus: "pending" },
      data: { paymentStatus: "cancelled" },
    });
    return this.get(userId, invoiceId);
  }

  /**
   * "Saya sudah bayar": nudges SayaBayar and pulls the status; never credits on
   * the user's word. Simulates payment when the gateway is off in simulation mode.
   */
  async check(userId: string, invoiceId: string) {
    const invoice = await this.findOwned(userId, invoiceId);
    if (invoice.paymentStatus !== "pending") return serializeTopup(invoice);

    const ref = this.gatewayReference(invoice);
    if (ref) {
      if (this.sayabayar.supportsConfirm()) await this.sayabayar.confirmInvoice(ref);
      await this.syncGateway(invoice.id, ref);
    } else if (paymentSimulationEnabled()) {
      await this.settle(invoice.id, invoice.amount, {
        paidAt: new Date(),
        reference: `SIM-${Date.now()}`,
      });
    } else {
      throw new ForbiddenException("Konfirmasi pembayaran manual tidak tersedia.");
    }
    return this.get(userId, invoiceId);
  }

  /** Verified gateway payment for a topup invoice (also after it expired: the money arrived). */
  async applyGatewayPaid(
    invoice: Pick<PaymentInvoice, "id" | "amount" | "paymentStatus">,
    input: { amount: number; paidAt: Date; gatewayInvoiceId?: string; channel?: string; payload: Prisma.InputJsonValue },
  ): Promise<"paid" | "duplicate" | "amount_mismatch"> {
    if (invoice.paymentStatus === "paid") return "duplicate";
    if (input.amount !== invoice.amount) return "amount_mismatch";
    const credited = await this.settle(invoice.id, input.amount, {
      paidAt: input.paidAt,
      reference: input.gatewayInvoiceId,
      channel: input.channel,
      payload: input.payload,
    });
    return credited ? "paid" : "duplicate";
  }

  /** Gateway reported the topup expired/cancelled; a no-op unless still pending. */
  async closeFromGateway(invoiceRowId: string, status: "expired" | "cancelled") {
    const closed = await this.prisma.paymentInvoice.updateMany({
      where: { id: invoiceRowId, purpose: "topup", paymentStatus: "pending" },
      data: { paymentStatus: status },
    });
    return closed.count === 1 ? "closed" : "ignored";
  }

  /** Closes pending topups past their deadline; run by the expiry sweep. */
  async expireOverdue(): Promise<number> {
    const overdue = await this.prisma.paymentInvoice.findMany({
      where: { purpose: "topup", paymentStatus: "pending", expiredAt: { lte: new Date() } },
      take: 50,
    });
    let expired = 0;
    for (const invoice of overdue) {
      const current = await this.ensureNotExpired(invoice);
      if (current.paymentStatus === "expired") expired++;
    }
    return expired;
  }

  /** Marks the invoice paid and credits the balance once. Returns false if already applied. */
  private async settle(
    invoiceRowId: string,
    amount: number,
    payment: { paidAt: Date; reference?: string; channel?: string; payload?: Prisma.InputJsonValue },
  ): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentInvoice.updateMany({
        where: { id: invoiceRowId, purpose: "topup", paymentStatus: { not: "paid" } },
        data: {
          paymentStatus: "paid",
          paidAt: payment.paidAt,
          ...(payment.reference ? { paymentReference: payment.reference } : {}),
          ...(payment.channel ? { paymentChannel: payment.channel } : {}),
          ...(payment.payload !== undefined ? { gatewayPayload: payment.payload } : {}),
        },
      });
      if (claimed.count !== 1) return null;
      const invoice = await tx.paymentInvoice.findUniqueOrThrow({
        where: { id: invoiceRowId },
        include: { user: { select: { id: true, username: true } } },
      });
      if (!invoice.user) return null;
      const credited = await applyBalance(tx, {
        userId: invoice.user.id,
        amount,
        reason: "topup",
        refKey: `topup:${invoiceRowId}`,
        note: `Topup saldo ${invoice.invoiceId}.`,
      });
      if (!credited) return null;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: invoice.user.id },
        select: { creditBalance: true },
      });
      return { invoice, username: invoice.user.username, userId: invoice.user.id, balance: user.creditBalance };
    });
    if (!result) return false;

    this.audit.record("balance.topup_paid", {
      userId: result.userId,
      invoiceId: result.invoice.invoiceId,
      amount,
      method: payment.channel,
    });
    void this.adminNotify.notifyUserById(
      result.userId,
      topupPaidUserHtml({ invoiceId: result.invoice.invoiceId, amount, balance: result.balance }),
    );
    void this.adminNotify.notifySuperAdmins(
      topupPaidSuperAdminHtml({
        invoiceId: result.invoice.invoiceId,
        username: result.username,
        amount,
        paidAt: payment.paidAt,
      }),
    );
    return true;
  }

  private async ensureNotExpired(invoice: PaymentInvoice): Promise<PaymentInvoice> {
    if (invoice.paymentStatus !== "pending" || invoice.expiredAt.getTime() > Date.now()) {
      return invoice;
    }
    const ref = this.gatewayReference(invoice);
    if (ref) {
      await this.syncGateway(invoice.id, ref);
      const synced = await this.prisma.paymentInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
      if (synced.paymentStatus !== "pending") return synced;
    }
    await this.prisma.paymentInvoice.updateMany({
      where: { id: invoice.id, paymentStatus: "pending" },
      data: { paymentStatus: "expired" },
    });
    return this.prisma.paymentInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
  }

  /** Pulls the gateway status (fallback for a missed webhook). Gateway errors change nothing. */
  private async syncGateway(invoiceRowId: string, gatewayInvoiceId: string) {
    let remote;
    try {
      remote = await this.sayabayar.getInvoice(gatewayInvoiceId);
    } catch {
      return;
    }
    const invoice = await this.prisma.paymentInvoice.findUniqueOrThrow({ where: { id: invoiceRowId } });
    if (remote.status === "paid" && remote.amount != null) {
      await this.applyGatewayPaid(invoice, {
        amount: remote.amount,
        paidAt: remote.paidAt ?? new Date(),
        gatewayInvoiceId,
        channel: remote.channel ?? undefined,
        payload: remote.raw as Prisma.InputJsonValue,
      });
    } else if (remote.status === "expired") {
      await this.closeFromGateway(invoiceRowId, "expired");
    }
  }

  private gatewayReference(invoice: Pick<PaymentInvoice, "paymentChannel" | "paymentReference">) {
    return invoice.paymentChannel === "sayabayar" && invoice.paymentReference
      ? invoice.paymentReference
      : null;
  }

  private async findOwned(userId: string, invoiceId: string) {
    const invoice = await this.prisma.paymentInvoice.findFirst({
      where: { invoiceId, userId, purpose: "topup" },
    });
    if (!invoice) throw new NotFoundException("Topup tidak ditemukan.");
    return invoice;
  }

  private async nextInvoiceId(): Promise<string> {
    const prefix = topupIdPrefix();
    let seq =
      (await this.prisma.paymentInvoice.count({
        where: { invoiceId: { startsWith: prefix } },
      })) + 1;
    for (;;) {
      const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
      const clash = await this.prisma.paymentInvoice.findUnique({
        where: { invoiceId: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      seq++;
    }
  }
}
