import { Injectable, Logger } from "@nestjs/common";
import { wahaInboundConfig, whatsappConfig } from "../config/env";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClient } from "../whatsapp/waha.client";
import { parseRoamercheckMessage } from "./roamercheck-parser";

export type WahaMessagePayload = {
  id?: unknown;
  from?: unknown;
  participant?: unknown;
  fromMe?: unknown;
  body?: unknown;
  replyTo?: { id?: unknown } | null;
};

const ACTOR = { username: "Roamercheck", fullName: "bot otomatis" };

@Injectable()
export class RoamercheckService {
  private readonly logger = new Logger(RoamercheckService.name);
  private processorLid: { phone: string; lid: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly waha: WahaClient,
  ) {}

  /** Applies a group message from the processor bot. Returns a short outcome for logs. */
  async handle(payload: WahaMessagePayload): Promise<string> {
    const group = whatsappConfig();
    const inbound = wahaInboundConfig();
    if (!group || !inbound) return "off";
    if (payload.fromMe === true) return "ignored: own message";
    if (payload.from !== group.groupChatId) return "ignored: other chat";
    if (!(await this.isProcessor(payload.participant, inbound.processorNumber))) {
      return "ignored: other sender";
    }

    const text = typeof payload.body === "string" ? payload.body : "";
    const updates = parseRoamercheckMessage(text);
    if (!updates.length) return "ignored: unrecognised message";

    const invoiceId = await this.repliedInvoiceId(payload.replyTo?.id);
    const results: string[] = [];
    for (const update of updates) {
      const order = await this.prisma.order.findFirst({
        where: {
          imei: update.imei,
          status: { in: ["waiting_action", "in_process"] },
          service: { fulfillmentChannel: "whatsapp" },
          ...(invoiceId ? { invoiceId } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, orderId: true },
      });
      if (!order) {
        results.push(`${update.imei} ${update.kind}: no active order`);
        continue;
      }
      const outcome = await this.orders.applyProcessorUpdate(order.id, update, ACTOR);
      results.push(`${order.orderId} ${update.kind}: ${outcome}`);
    }
    return results.join("; ");
  }

  private async isProcessor(participant: unknown, phone: string): Promise<boolean> {
    if (typeof participant !== "string") return false;
    if (participant === `${phone}@c.us` || participant === `${phone}@s.whatsapp.net`) {
      return true;
    }
    if (!participant.endsWith("@lid")) return false;
    if (this.processorLid?.phone !== phone) {
      const lid = await this.waha.lidForPhone(phone);
      if (!lid) return false;
      this.processorLid = { phone, lid };
    }
    return participant === this.processorLid.lid;
  }

  /** Invoice whose group notification the message replies to (WAHA reports the short message id). */
  private async repliedInvoiceId(replyId: unknown): Promise<string | null> {
    if (typeof replyId !== "string" || !/^[A-Za-z0-9]{8,64}$/.test(replyId)) return null;
    const row = await this.prisma.whatsappNotification.findFirst({
      where: { wahaMessageId: { contains: `_${replyId}_` } },
      select: { invoiceId: true },
    });
    if (!row) {
      this.logger.log(`Reply ${replyId} does not match a sent group notification`);
    }
    return row?.invoiceId ?? null;
  }
}
