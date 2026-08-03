import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AdminTelegramLinkService } from "./admin-telegram-link.service";
import {
  escapeHtml,
  maskImeiHtml,
  newOrderAdminHtml,
  orderCardTakenHtml,
  orderCardRejectedHtml,
  orderCardDoneHtml,
} from "./telegram-messages";

@Injectable()
export class AdminNotifyService {
  private readonly logger = new Logger(AdminNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminTelegram: AdminTelegramLinkService,
  ) {}

  /** Plain text broadcast. Never throws. */
  async notify(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    try {
      const linkedChatIds = await this.adminTelegram.notificationChatIds();
      for (const chatId of [...new Set(linkedChatIds)]) {
        await this.sendMessage(token, chatId, text);
      }
    } catch (err) {
      this.logger.warn(
        `Admin notify error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async notifyUserById(userId: string, text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    try {
      const identity = await this.prisma.userIdentity.findUnique({
        where: {
          userId_provider: { userId, provider: "telegram" },
        },
        select: { chatId: true, chatVerifiedAt: true },
      });
      if (!identity?.chatId || !identity.chatVerifiedAt) return;
      await this.sendMessage(token, identity.chatId, text, false);
    } catch (err) {
      this.logger.warn(
        `User notify error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async notifyNewOrder(internalOrderId: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;

    const order = await this.prisma.order.findUnique({
      where: { id: internalOrderId },
      include: { service: true },
    });
    if (!order || order.status !== "waiting_action") return;

    const destinations = await this.adminTelegram.notificationDestinations();
    if (!destinations.length) {
      this.logger.warn("No linked admin chats for new order notify");
      return;
    }

    const html = newOrderAdminHtml({
      orderId: order.orderId,
      imei: order.imei,
      serviceName: order.service.name,
      price: order.price,
    });
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "✅ Terima Order",
            callback_data: `ord:accept:${order.orderId}`,
          },
          {
            text: "❌ Tolak",
            callback_data: `ord:reject:${order.orderId}`,
          },
        ],
      ],
    };

    for (const dest of destinations) {
      try {
        const body = await this.sendMessageRaw(token, {
          chat_id: dest.chatId,
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: replyMarkup,
        });
        const messageId =
          body?.ok && body.result?.message_id
            ? String(body.result.message_id)
            : null;
        await this.prisma.orderTelegramNotification.upsert({
          where: {
            orderId_adminId: {
              orderId: order.id,
              adminId: dest.adminId,
            },
          },
          create: {
            orderId: order.id,
            adminId: dest.adminId,
            chatId: dest.chatId,
            messageId,
            notifiedAt: messageId ? new Date() : null,
            lastError: messageId
              ? null
              : body?.description ?? "send failed",
          },
          update: {
            chatId: dest.chatId,
            messageId: messageId ?? undefined,
            notifiedAt: messageId ? new Date() : undefined,
            lastError: messageId
              ? null
              : body?.description ?? "send failed",
          },
        });
      } catch (err) {
        this.logger.warn(
          `New order notify failed admin=${dest.adminId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.notifyUserById(
      order.userId,
      [
        "✅ Pembayaran diterima",
        `Order <b>${escapeHtml(order.orderId)}</b> masuk antrean admin.`,
        `IMEI: ${maskImeiHtml(order.imei)}`,
      ].join("\n"),
    );
  }

  async syncOrderCards(
    internalOrderId: string,
    kind: "taken" | "rejected" | "done",
    meta: { actorName: string; note?: string },
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;

    const order = await this.prisma.order.findUnique({
      where: { id: internalOrderId },
      include: {
        service: true,
        telegramNotifications: true,
      },
    });
    if (!order) return;

    let html: string;
    let keyboard: { text: string; callback_data: string }[][] = [];
    if (kind === "taken") {
      html = orderCardTakenHtml({
        orderId: order.orderId,
        imei: order.imei,
        serviceName: order.service.name,
        actorName: meta.actorName,
      });
      keyboard = [
        [
          {
            text: "✅ Done",
            callback_data: `ord:done:${order.orderId}`,
          },
          {
            text: "❌ Tolak",
            callback_data: `ord:reject:${order.orderId}`,
          },
        ],
      ];
    } else if (kind === "rejected") {
      html = orderCardRejectedHtml({
        orderId: order.orderId,
        actorName: meta.actorName,
        reason: meta.note ?? "—",
      });
    } else {
      html = orderCardDoneHtml({
        orderId: order.orderId,
        actorName: meta.actorName,
        note: meta.note ?? "—",
      });
    }

    for (const row of order.telegramNotifications) {
      if (!row.messageId) continue;
      const isAssigneeCard =
        kind === "taken" &&
        order.assignedAdminId &&
        row.adminId === order.assignedAdminId;
      try {
        await this.sendMessageRaw(token, {
          chat_id: row.chatId,
          message_id: Number(row.messageId),
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: isAssigneeCard ? keyboard : [],
          },
          _method: "editMessageText",
        });
      } catch (err) {
        this.logger.warn(
          `Order card edit failed chat=${row.chatId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async sendMessage(
    token: string,
    chatId: string,
    text: string,
    html = true,
  ) {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: html ? "HTML" : undefined,
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      this.logger.warn(
        `sendMessage failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  }

  private async sendMessageRaw(
    token: string,
    payload: Record<string, unknown> & { _method?: string },
  ): Promise<{
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  } | null> {
    const method = payload._method ?? "sendMessage";
    const { _method: _drop, ...body } = payload;
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;
  }
}
