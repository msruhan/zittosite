import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AdminTelegramLinkService } from "./admin-telegram-link.service";
import {
  newOrderAdminHtml,
  orderCardTakenHtml,
  orderCardRejectedHtml,
  orderCardDoneHtml,
  orderCardCancelledHtml,
  superAdminFollowUpHtml,
  userOrderNoticeHtml,
  type CardCustomer,
} from "./telegram-messages";
import { processDurationLabel } from "../orders/process-duration";

const DURATION_INCLUDE = {
  invoice: { select: { paidAt: true } },
  activity: {
    select: { status: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
};

/**
 * Customer username and price go only to a Super Admin's private chat, never to
 * operators or group chats (Telegram group/supergroup chat ids are negative).
 */
/** Test-account orders carry a banner so admins know they are excluded from statistics. */
function withTestBanner(isTest: boolean, html: string): string {
  return isTest ? `🧪 <b>TESTING</b> · tidak dihitung statistik\n${html}` : html;
}

function showsCustomer(dest: { role: string; chatId: string }): boolean {
  return dest.role === "super_admin" && !dest.chatId.startsWith("-");
}

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
      await this.sendMessage(token, identity.chatId, text);
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
      include: {
        service: { include: { supplier: { select: { name: true } } } },
        user: { select: { username: true } },
      },
    });
    if (!order || order.status !== "waiting_action") return;

    const paidNotice = () =>
      this.notifyUserById(
        order.userId,
        userOrderNoticeHtml({
          kind: "paid",
          orderId: order.orderId,
          imei: order.imei,
          serviceName: order.service.name,
        }),
      );
    // WhatsApp- and supplier-fulfilled services need no operator; only super admins get an info card.
    const viaWhatsapp = order.service.fulfillmentChannel === "whatsapp";
    const viaSupplier =
      order.service.fulfillmentChannel === "supplier"
        ? order.service.supplier?.name ?? "Supplier"
        : undefined;
    const operatorFree = viaWhatsapp || Boolean(viaSupplier);

    const assignments = await this.prisma.serviceAssignment.findMany({
      where: { serviceId: order.serviceId },
      select: { adminId: true, admin: { select: { fullName: true, status: true } } },
      orderBy: { admin: { fullName: "asc" } },
    });
    const assigned = new Set(assignments.map((row) => row.adminId));
    const assignedNames = assignments
      .filter((row) => row.admin.status === "active")
      .map((row) => row.admin.fullName);
    const destinations = (
      await this.adminTelegram.notificationDestinations()
    ).filter(
      (d) =>
        d.role === "super_admin" || (!operatorFree && assigned.has(d.adminId)),
    );
    if (!destinations.length) {
      this.logger.warn("No linked admin chats for new order notify");
      await paidNotice();
      return;
    }

    const cardInput = {
      orderId: order.orderId,
      imei: order.imei,
      serviceName: order.service.name,
    };
    const operatorHtml = withTestBanner(
      order.isTest,
      newOrderAdminHtml({ ...cardInput, viaWhatsapp, viaSupplier }),
    );
    const superAdminHtml = withTestBanner(
      order.isTest,
      newOrderAdminHtml({
        ...cardInput,
        customer: {
          username: order.user.username,
          channel: order.channel,
          price: order.price,
        },
        assignedAdmins: assignedNames,
        viaWhatsapp,
        viaSupplier,
      }),
    );
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

    const cancelButton = {
      text: "🚫 Batalkan order",
      callback_data: `sord:cancel:${order.orderId}`,
    };
    // Supplier and WhatsApp orders run on their own; only manual ones can be taken.
    const superAdminMarkup = {
      inline_keyboard: [
        operatorFree
          ? [cancelButton]
          : [
              cancelButton,
              { text: "🛠️ Ambil order", callback_data: `ord:accept:${order.orderId}` },
            ],
      ],
    };

    for (const dest of destinations) {
      try {
        const body = await this.sendMessageRaw(token, {
          chat_id: dest.chatId,
          text: showsCustomer(dest) ? superAdminHtml : operatorHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: dest.role === "super_admin" ? superAdminMarkup : replyMarkup,
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

    await paidNotice();
  }

  async syncOrderCards(
    internalOrderId: string,
    kind: "taken" | "rejected" | "done" | "cancelled",
    meta: { actorName: string; note?: string },
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;

    const order = await this.prisma.order.findUnique({
      where: { id: internalOrderId },
      include: {
        service: true,
        user: { select: { username: true } },
        telegramNotifications: {
          include: { admin: { select: { role: true } } },
        },
        ...DURATION_INCLUDE,
      },
    });
    if (!order) return;
    const duration =
      kind === "done" || kind === "rejected" ? processDurationLabel(order) : undefined;

    const render = (customer?: CardCustomer): string => {
      const base = {
        orderId: order.orderId,
        imei: order.imei,
        serviceName: order.service.name,
        actorName: meta.actorName,
        customer,
      };
      if (kind === "taken") return orderCardTakenHtml(base);
      if (kind === "cancelled") {
        return orderCardCancelledHtml({ ...base, reason: meta.note ?? "—" });
      }
      if (kind === "rejected") {
        return orderCardRejectedHtml({ ...base, reason: meta.note, duration });
      }
      return orderCardDoneHtml({ ...base, note: meta.note ?? "—", duration });
    };
    const operatorHtml = withTestBanner(order.isTest, render());
    const superAdminHtml = withTestBanner(order.isTest, render({
      username: order.user.username,
      channel: order.channel,
      price: order.price,
    }));

    let keyboard: { text: string; callback_data: string }[][] = [];
    if (kind === "taken") {
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
    }

    for (const row of order.telegramNotifications) {
      const html = showsCustomer({ role: row.admin.role, chatId: row.chatId })
        ? superAdminHtml
        : operatorHtml;
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

  /**
   * Fresh (audible) message to super admins, skipping the acting admin. Never throws.
   * `includeActor` also messages the acting Super Admin, for actions taken on
   * the website where the bot chat shows no confirmation of its own.
   */
  async notifySuperAdminsFollowUp(
    internalOrderId: string,
    kind: "taken" | "rejected" | "done" | "cancelled",
    actor: { id: string; username: string; fullName: string },
    note?: string,
    options: { includeActor?: boolean } = {},
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: internalOrderId },
        include: {
          service: true,
          user: { select: { username: true } },
          ...DURATION_INCLUDE,
        },
      });
      if (!order) return;

      const recipients = (
        await this.adminTelegram.notificationDestinations()
      ).filter(
        (d) => d.role === "super_admin" && (options.includeActor || d.adminId !== actor.id),
      );
      if (!recipients.length) return;

      const base = {
        kind,
        orderId: order.orderId,
        imei: order.imei,
        serviceName: order.service.name,
        adminUsername: actor.username,
        adminFullName: actor.fullName,
        note,
        duration:
          kind === "done" || kind === "rejected" ? processDurationLabel(order) : undefined,
      };
      const withCustomer = withTestBanner(order.isTest, superAdminFollowUpHtml({
        ...base,
        customer: { username: order.user.username, price: order.price },
      }));
      const withoutCustomer = withTestBanner(order.isTest, superAdminFollowUpHtml(base));
      for (const dest of recipients) {
        await this.sendMessage(
          token,
          dest.chatId,
          showsCustomer(dest) ? withCustomer : withoutCustomer,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Super admin follow-up notify error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** HTML message to every Super Admin's private chat. Never throws. */
  async notifySuperAdmins(html: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    try {
      const recipients = (await this.adminTelegram.notificationDestinations()).filter(
        showsCustomer,
      );
      for (const chatId of new Set(recipients.map((d) => d.chatId))) {
        await this.sendMessage(token, chatId, html);
      }
    } catch (err) {
      this.logger.warn(
        `Super admin notify error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** HTML message to one chat, optionally with inline buttons. Never throws. */
  async sendHtml(
    chatId: string,
    html: string,
    inlineKeyboard?: { text: string; callback_data: string }[][],
  ): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return false;
    try {
      const body = await this.sendMessageRaw(token, {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(inlineKeyboard
          ? { reply_markup: { inline_keyboard: inlineKeyboard } }
          : {}),
      });
      return Boolean(body?.ok);
    } catch (err) {
      this.logger.warn(
        `sendHtml failed chat=${chatId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  private async sendMessage(
    token: string,
    chatId: string,
    text: string,
    html = true,
  ) {
    const res = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: html ? "HTML" : undefined,
        disable_web_page_preview: true,
      }),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      this.logger.warn(
        `sendMessage failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  }

  /** Retries dropped connections/timeouts only; Telegram's own error replies are returned as-is. */
  private async fetchWithRetry(url: string, body: string): Promise<Response> {
    const delaysMs = [1_000, 3_000];
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        if (attempt >= delaysMs.length) throw err;
        await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
      }
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
    const res = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/${method}`,
      JSON.stringify(body),
    );
    return (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;
  }
}
