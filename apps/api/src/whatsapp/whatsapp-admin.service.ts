import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { whatsappAdminEnabled } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClient, messageKey } from "./waha.client";
import {
  adminOrderCardText,
  adminReactionReplyText,
  type AdminReactionReply,
} from "./whatsapp-messages";
import { backoffMs, shouldGiveUp } from "./whatsapp-retry-policy";

const STALE_SENDING_MS = 5 * 60_000;

/** Order cards in each `whatsapp_admin` service's admin WhatsApp group. */
@Injectable()
export class WhatsappAdminService {
  private readonly logger = new Logger(WhatsappAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waha: WahaClient,
  ) {}

  enabled(): boolean {
    return whatsappAdminEnabled();
  }

  /** Queues a card per WhatsApp Admin order inside the settle transaction; returns the row ids. */
  async enqueueOrders(tx: Prisma.TransactionClient, orderIds: string[]): Promise<string[]> {
    if (!this.enabled() || !orderIds.length) return [];
    const orders = await tx.order.findMany({
      where: {
        id: { in: orderIds },
        status: "waiting_action",
        service: { fulfillmentChannel: "whatsapp_admin" },
      },
      orderBy: { orderId: "asc" },
      select: {
        id: true,
        orderId: true,
        imei: true,
        isTest: true,
        service: {
          select: { name: true, whatsappSlug: true, inputType: true, whatsappGroupId: true },
        },
      },
    });
    const ids: string[] = [];
    for (const order of orders) {
      const chatId = order.service.whatsappGroupId;
      if (!chatId) {
        this.logger.warn(
          `No WhatsApp group set for "${order.service.name}"; ${order.orderId} gets no card`,
        );
        continue;
      }
      const row = await tx.orderWhatsappMessage.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          chatId,
          text: adminOrderCardText({
            serviceName: order.service.whatsappSlug || order.service.name,
            inputType: order.service.inputType,
            imei: order.imei,
            isTest: order.isTest,
          }),
        },
        update: {},
        select: { id: true },
      });
      ids.push(row.id);
    }
    return ids;
  }

  /** Claims a due card and sends it. Never throws. */
  async deliver(id: string): Promise<void> {
    try {
      await this.deliverOrThrow(id);
    } catch (err) {
      this.logger.warn(
        `WhatsApp admin card ${id} crashed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async dueIds(limit: number): Promise<string[]> {
    const rows = await this.prisma.orderWhatsappMessage.findMany({
      where: { status: "pending", nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async releaseStale(): Promise<number> {
    const { count } = await this.prisma.orderWhatsappMessage.updateMany({
      where: {
        status: "sending",
        updatedAt: { lt: new Date(Date.now() - STALE_SENDING_MS) },
      },
      data: { status: "pending", nextAttemptAt: new Date() },
    });
    return count;
  }

  /** Card of the order a reaction targets, by the reacted message id. */
  async findByMessage(reactedMessageId: string) {
    return this.prisma.orderWhatsappMessage.findFirst({
      where: { messageKey: messageKey(reactedMessageId) },
      select: {
        chatId: true,
        wahaMessageId: true,
        order: {
          select: {
            id: true,
            orderId: true,
            status: true,
            assignedAdminId: true,
            serviceId: true,
          },
        },
      },
    });
  }

  /** Replies under the order's card in the group. Never throws. */
  async reply(internalOrderId: string, reply: AdminReactionReply): Promise<void> {
    try {
      const card = await this.prisma.orderWhatsappMessage.findUnique({
        where: { orderId: internalOrderId },
        select: { chatId: true, wahaMessageId: true, status: true },
      });
      if (!card || card.status !== "sent") return;
      await this.waha.sendText(
        card.chatId,
        adminReactionReplyText(reply),
        card.wahaMessageId ?? undefined,
      );
    } catch (err) {
      this.logger.warn(
        `WhatsApp admin reply failed order=${internalOrderId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async deliverOrThrow(id: string) {
    if (!this.enabled()) return;
    const claimed = await this.prisma.orderWhatsappMessage.updateMany({
      where: { id, status: "pending", nextAttemptAt: { lte: new Date() } },
      data: { status: "sending" },
    });
    if (claimed.count !== 1) return;

    const row = await this.prisma.orderWhatsappMessage.findUniqueOrThrow({
      where: { id },
      select: { chatId: true, text: true, attempts: true, order: { select: { status: true } } },
    });
    const attempts = row.attempts + 1;
    if (row.order.status !== "waiting_action") {
      // The order moved on (cancelled, taken elsewhere) before the card went out.
      await this.prisma.orderWhatsappMessage.update({
        where: { id },
        data: { status: "failed", attempts, lastError: `order ${row.order.status}` },
      });
      return;
    }

    try {
      const { messageId } = await this.waha.sendText(row.chatId, row.text);
      await this.prisma.orderWhatsappMessage.update({
        where: { id },
        data: {
          status: "sent",
          attempts,
          sentAt: new Date(),
          wahaMessageId: messageId,
          messageKey: messageId ? messageKey(messageId) : null,
          lastError: messageId ? null : "WAHA returned no message id; reactions cannot be matched",
        },
      });
    } catch (err) {
      const error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const giveUp = shouldGiveUp(attempts);
      await this.prisma.orderWhatsappMessage.update({
        where: { id },
        data: {
          status: giveUp ? "failed" : "pending",
          attempts,
          lastError: error,
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      });
      this.logger.warn(
        `WhatsApp admin card failed (attempt ${attempts}${giveUp ? ", giving up" : ""}): ${error}`,
      );
    }
  }
}
