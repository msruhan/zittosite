import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { whatsappConfig } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../security/audit-log.service";
import { WahaClient } from "./waha.client";
import { paidInvoiceGroupText } from "./whatsapp-messages";
import { backoffMs, shouldGiveUp } from "./whatsapp-retry-policy";

const STALE_SENDING_MS = 5 * 60_000;

@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waha: WahaClient,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Queues the group message for a just-paid invoice inside the settle
   * transaction. Returns the queue row id, or null when WhatsApp is off or
   * the invoice has no orders for a WhatsApp-fulfilled service.
   */
  async enqueuePaidInvoice(
    tx: Prisma.TransactionClient,
    invoiceRowId: string,
  ): Promise<string | null> {
    const config = whatsappConfig();
    if (!config) return null;

    const invoice = await tx.paymentInvoice.findUnique({
      where: { id: invoiceRowId },
      select: {
        paidAt: true,
        orders: {
          where: { status: "waiting_action", service: { fulfillmentChannel: "whatsapp" } },
          orderBy: { orderId: "asc" },
          select: {
            imei: true,
            service: { select: { name: true } },
            user: { select: { username: true } },
          },
        },
      },
    });
    const first = invoice?.orders[0];
    if (!invoice || !first) return null;

    const text = paidInvoiceGroupText({
      username: first.user.username,
      paidAt: invoice.paidAt ?? new Date(),
      orders: invoice.orders.map((o) => ({ imei: o.imei, serviceName: o.service.name })),
    });
    const row = await tx.whatsappNotification.upsert({
      where: { invoiceId: invoiceRowId },
      create: {
        invoiceId: invoiceRowId,
        kind: "invoice_paid",
        chatId: config.groupChatId,
        text,
      },
      update: {},
      select: { id: true },
    });
    return row.id;
  }

  /** Claims a due queue row and sends it. Never throws. */
  async deliver(notificationId: string): Promise<void> {
    try {
      await this.deliverOrThrow(notificationId);
    } catch (err) {
      this.logger.warn(
        `WhatsApp deliver ${notificationId} crashed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Ids of queue rows whose next attempt is due. */
  async dueIds(limit: number): Promise<string[]> {
    const rows = await this.prisma.whatsappNotification.findMany({
      where: { status: "pending", nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Puts rows left in `sending` by a crashed process back in the queue. */
  async releaseStale(): Promise<number> {
    const { count } = await this.prisma.whatsappNotification.updateMany({
      where: {
        status: "sending",
        updatedAt: { lt: new Date(Date.now() - STALE_SENDING_MS) },
      },
      data: { status: "pending", nextAttemptAt: new Date() },
    });
    return count;
  }

  private async deliverOrThrow(notificationId: string) {
    if (!whatsappConfig()) return;

    const claimed = await this.prisma.whatsappNotification.updateMany({
      where: {
        id: notificationId,
        status: "pending",
        nextAttemptAt: { lte: new Date() },
      },
      data: { status: "sending" },
    });
    if (claimed.count !== 1) return;

    const row = await this.prisma.whatsappNotification.findUniqueOrThrow({
      where: { id: notificationId },
      select: { chatId: true, text: true, attempts: true, invoiceId: true },
    });
    const attempts = row.attempts + 1;

    try {
      const { messageId } = await this.waha.sendText(row.chatId, row.text);
      await this.prisma.whatsappNotification.update({
        where: { id: notificationId },
        data: {
          status: "sent",
          attempts,
          sentAt: new Date(),
          wahaMessageId: messageId,
          lastError: null,
        },
      });
    } catch (err) {
      const error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const giveUp = shouldGiveUp(attempts);
      await this.prisma.whatsappNotification.update({
        where: { id: notificationId },
        data: {
          status: giveUp ? "failed" : "pending",
          attempts,
          lastError: error,
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      });
      this.logger.warn(
        `WhatsApp send failed (attempt ${attempts}${giveUp ? ", giving up" : ""}): ${error}`,
      );
      if (giveUp) await this.recordFailure(row.invoiceId, attempts, error);
    }
  }

  private async recordFailure(invoiceRowId: string, attempts: number, error: string) {
    const invoice = await this.prisma.paymentInvoice.findUnique({
      where: { id: invoiceRowId },
      select: {
        invoiceId: true,
        orders: { orderBy: { orderId: "asc" }, take: 1, select: { orderId: true } },
      },
    });
    this.audit.record("notify.whatsapp_failed", {
      orderId: invoice?.orders[0]?.orderId,
      invoiceId: invoice?.invoiceId,
      attempts,
      error,
    });
  }
}
