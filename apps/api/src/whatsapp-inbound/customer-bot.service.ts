import { ConflictException, Injectable, Logger } from "@nestjs/common";
import * as QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { UserMenusService } from "../orders/user-menus.service";
import { WahaClient } from "../whatsapp/waha.client";
import { telegramHtmlToWhatsapp } from "../whatsapp/whatsapp-format";
import { wahaConnection, webPublicUrl } from "../config/env";
import { parseImeiList } from "../orders/imei-list";
import { maxBulkFor } from "../orders/supplier-routed";
import { needsExtraInput } from "../orders/special-fields";
import { descriptionToPlain } from "../admin/rich-description";
import {
  orderCreatedHtml,
  orderHistoryHtml,
  orderPaidByBalanceHtml,
  orderQrisCaptionHtml,
  pendingOrderHtml,
} from "../telegram/telegram-messages";
import { jidPhone } from "./admin-reaction-parser";
import type { WahaMessagePayload } from "./roamercheck.service";
import {
  accountText,
  askImeiText,
  confirmOrderText,
  isBackKeyword,
  isCancelKeyword,
  isMenuCommand,
  mainMenu,
  parseChoice,
  pendingChoicesText,
  unregisteredText,
  whatsappMenuSections,
  type WaMenuEntry,
} from "./customer-bot-menu";

type SerializedOrder = Awaited<ReturnType<OrdersService["getOrder"]>>;

type Session =
  | { kind: "menu"; entries: WaMenuEntry[] }
  | { kind: "imei"; serviceCode: string; maxBulk: number }
  | {
      kind: "confirm";
      serviceCode: string;
      serviceName: string;
      price: number;
      imeis: string[];
    }
  | { kind: "pending"; orderId: string };

type Member = {
  id: string;
  fullName: string;
  username: string;
  creditBalance: number;
  status: string;
  botAccess: boolean;
  group: { name: string } | null;
  number: string;
};

const SESSION_TTL_MS = 30 * 60_000;
const LID_TTL_MS = 6 * 60 * 60_000;
const UNREGISTERED_REPLY_EVERY_MS = 6 * 60 * 60_000;
const SEEN_TTL_MS = 10 * 60_000;
const DESCRIPTION_MAX_CHARS = 1500;

/** Customer ordering over the WAHA number: private chats from Super-Admin-registered numbers. */
@Injectable()
export class CustomerBotService {
  private readonly logger = new Logger(CustomerBotService.name);
  private readonly sessions = new Map<string, { session: Session; expiresAt: number }>();
  private readonly lidPhones = new Map<string, { phone: string | null; expiresAt: number }>();
  private readonly unregisteredReplied = new Map<string, number>();
  private readonly seen = new Map<string, number>();
  private readonly chains = new Map<string, Promise<unknown>>();
  /** Flips off after WAHA rejects an image (Core edition); payment then goes out as a link. */
  private imagesSupported = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly userMenus: UserMenusService,
    private readonly waha: WahaClient,
  ) {}

  /** Returns null for messages that are not private chats, so other handlers can take them. */
  async handle(payload: WahaMessagePayload): Promise<string | null> {
    const chatId = typeof payload.from === "string" ? payload.from : "";
    if (!/@(c\.us|s\.whatsapp\.net|lid)$/.test(chatId)) return null;
    if (!wahaConnection() || process.env.WA_CUSTOMER_BOT === "0") return "off";
    if (payload.fromMe === true) return "ignored: own message";
    const text = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!text) return "ignored: no text";
    if (typeof payload.id === "string" && this.markSeen(payload.id)) return "ignored: duplicate";

    const previous = this.chains.get(chatId) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(() => this.process(chatId, text));
    this.chains.set(chatId, run);
    try {
      return await run;
    } finally {
      if (this.chains.get(chatId) === run) this.chains.delete(chatId);
    }
  }

  private async process(chatId: string, text: string): Promise<string> {
    if (!isMenuCommand(text) && !this.getSession(chatId)) return "ignored: no conversation";
    const phone = await this.senderPhone(chatId);
    const member = phone ? await this.findMember(phone) : null;
    if (!member) {
      const repliedAt = this.unregisteredReplied.get(chatId) ?? 0;
      if (Date.now() - repliedAt < UNREGISTERED_REPLY_EVERY_MS) return "ignored: unregistered";
      this.unregisteredReplied.set(chatId, Date.now());
      await this.send(chatId, unregisteredText());
      return "refused: unregistered";
    }
    if (member.status !== "active") {
      this.sessions.delete(chatId);
      await this.send(chatId, "🚫 *Akun ditangguhkan*\nHubungi admin untuk bantuan.");
      return "refused: suspended";
    }
    if (!member.botAccess) {
      this.sessions.delete(chatId);
      await this.send(
        chatId,
        "🚫 *Bot tidak aktif*\nAkses bot untuk akun ini dinonaktifkan oleh admin.",
      );
      return "refused: bot disabled";
    }

    try {
      return await this.route(chatId, member, text);
    } catch (err) {
      this.logger.warn(
        `WhatsApp bot failed chat=${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.sessions.delete(chatId);
      await this.send(
        chatId,
        `⚠️ ${err instanceof Error ? err.message : "Terjadi kesalahan"}\n\nKirim */menu* untuk kembali.`,
      ).catch(() => undefined);
      return "error";
    }
  }

  private async route(chatId: string, member: Member, text: string): Promise<string> {
    const session = this.getSession(chatId);
    if (isMenuCommand(text)) {
      await this.showMenu(chatId, member);
      return "menu";
    }
    if (!session) return "ignored: no conversation";
    if (isBackKeyword(text)) {
      await this.showMenu(chatId, member, session.kind === "confirm" ? "Order dibatalkan." : undefined);
      return session.kind === "confirm" ? "confirm: cancelled" : "menu";
    }

    switch (session.kind) {
      case "menu": {
        const choice = parseChoice(text, session.entries.length);
        const entry = choice ? session.entries[choice - 1] : undefined;
        if (!entry) {
          await this.send(
            chatId,
            `Pilihan tidak dikenal. Balas angka *1–${session.entries.length}*, atau kirim */menu* untuk melihat menu lagi.`,
          );
          return "menu: invalid";
        }
        if (entry.kind === "history") return this.showHistory(chatId, member);
        if (entry.kind === "account") return this.showAccount(chatId, member);
        return this.pickService(chatId, member, entry.code);
      }
      case "imei":
        return this.receiveImeis(chatId, member, session, text);
      case "confirm": {
        if (isCancelKeyword(text)) {
          await this.showMenu(chatId, member, "Order dibatalkan.");
          return "confirm: cancelled";
        }
        if (parseChoice(text, 1) !== 1) {
          await this.send(chatId, "Balas *1* untuk lanjut ke pembayaran, atau *0* untuk batal.");
          return "confirm: invalid";
        }
        return this.placeOrder(chatId, member, session);
      }
      case "pending":
        return this.handlePending(chatId, member, session.orderId, text);
    }
  }

  private async showMenu(chatId: string, member: Member, notice?: string) {
    const [services, menus] = await Promise.all([this.botServices(member.id), this.userMenus.get()]);
    const menu = mainMenu(member.fullName, whatsappMenuSections(services, menus));
    this.setSession(chatId, { kind: "menu", entries: menu.entries });
    await this.send(chatId, notice ? `${notice}\n\n${menu.text}` : menu.text);
  }

  private async botServices(userId: string) {
    return (await this.orders.listServices(userId)).filter(
      (service) => service.inputType === "imei" && !needsExtraInput(service),
    );
  }

  private async pickService(chatId: string, member: Member, code: string): Promise<string> {
    const service = (await this.botServices(member.id)).find((s) => s.code === code);
    if (!service) {
      await this.showMenu(chatId, member, "⚠️ Layanan itu sudah tidak tersedia.");
      return "service: gone";
    }
    const maxBulk = maxBulkFor({ fulfillmentChannel: service.via, menu: service.menu });
    this.setSession(chatId, { kind: "imei", serviceCode: service.code, maxBulk });
    await this.send(chatId, askImeiText(service, maxBulk));
    return `service: ${service.code}`;
  }

  private async receiveImeis(
    chatId: string,
    member: Member,
    session: Extract<Session, { kind: "imei" }>,
    text: string,
  ): Promise<string> {
    const parsed = parseImeiList(text, "imei", session.maxBulk);
    if (!parsed.ok) {
      await this.send(
        chatId,
        [
          ...parsed.errors.map((error) => `⚠️ ${error}`),
          "",
          `Kirim ulang IMEI, satu per baris (maksimal ${session.maxBulk}). Balas *0* untuk kembali ke menu.`,
        ].join("\n"),
      );
      return "imei: invalid";
    }
    const service = (await this.botServices(member.id)).find((s) => s.code === session.serviceCode);
    if (!service) {
      await this.showMenu(chatId, member, "⚠️ Layanan itu sudah tidak tersedia.");
      return "service: gone";
    }
    const description = descriptionToPlain(service.description ?? "");
    this.setSession(chatId, {
      kind: "confirm",
      serviceCode: service.code,
      serviceName: service.name,
      price: service.price,
      imeis: parsed.imeis,
    });
    await this.send(
      chatId,
      confirmOrderText({
        serviceName: service.name,
        price: service.price,
        imeis: parsed.imeis,
        description:
          description.length > DESCRIPTION_MAX_CHARS
            ? `${description.slice(0, DESCRIPTION_MAX_CHARS)}…`
            : description,
      }),
    );
    return "imei: confirm";
  }

  private async placeOrder(
    chatId: string,
    member: Member,
    session: Extract<Session, { kind: "confirm" }>,
  ): Promise<string> {
    this.sessions.delete(chatId);
    let order: SerializedOrder;
    try {
      order = await this.orders.createOrder(member.id, {
        serviceCode: session.serviceCode,
        imeis: session.imeis,
        channel: "whatsapp",
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        const pending = await this.orders.pendingOrder(member.id).catch(() => null);
        if (pending) {
          await this.showPending(chatId, pending);
          return "order: pending exists";
        }
      }
      throw err;
    }

    const invoice = order.invoice;
    if (order.status !== "waiting_payment") {
      await this.send(
        chatId,
        `${telegramHtmlToWhatsapp(
          orderPaidByBalanceHtml({
            orderId: order.orderId,
            amount: invoice?.amount ?? order.price,
            items: invoice?.orders,
          }),
        )}\n\nKirim */menu* untuk kembali.`,
      );
      return `order: ${order.orderId} paid by balance`;
    }
    await this.sendPayment(chatId, order);
    this.setSession(chatId, { kind: "pending", orderId: order.orderId });
    return `order: ${order.orderId} awaiting payment`;
  }

  /** QRIS image when WAHA can send one, otherwise the website payment link. */
  private async sendPayment(chatId: string, order: SerializedOrder) {
    const invoice = order.invoice;
    const amount = invoice?.amountDue ?? invoice?.amount ?? order.price;
    const balanceUsed = invoice?.balanceUsed ?? 0;
    const payUrl = `${webPublicUrl()}/app/order/${order.orderId}/bayar`;
    const footer = ["", "Pilihan:", pendingChoicesText()].join("\n");

    if (invoice?.qrisString && this.imagesSupported) {
      try {
        const png = await QRCode.toBuffer(invoice.qrisString, {
          type: "png",
          width: 720,
          margin: 3,
          errorCorrectionLevel: "M",
        });
        const caption = telegramHtmlToWhatsapp(
          orderQrisCaptionHtml({
            orderId: order.orderId,
            amount,
            balanceUsed,
            expiresAt: new Date(invoice.expiredAt),
            items: invoice.orders,
          }),
        );
        await this.waha.sendImage(chatId, png, `QRIS-${order.orderId}.png`, `${caption}\n${footer}`);
        return;
      } catch (err) {
        this.imagesSupported = false;
        this.logger.warn(
          `WhatsApp QRIS image failed order=${order.orderId}, using pay link: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    await this.send(
      chatId,
      `${telegramHtmlToWhatsapp(
        orderCreatedHtml({ orderId: order.orderId, payUrl, amount, balanceUsed, items: invoice?.orders }),
      )}\n${footer}`,
    );
  }

  private async showPending(chatId: string, order: SerializedOrder) {
    const invoice = order.invoice;
    this.setSession(chatId, { kind: "pending", orderId: order.orderId });
    await this.send(
      chatId,
      [
        telegramHtmlToWhatsapp(
          pendingOrderHtml({
            orderId: order.orderId,
            amount: invoice?.amountDue ?? invoice?.amount ?? order.price,
            balanceUsed: invoice?.balanceUsed,
            expiresAt: invoice ? new Date(invoice.expiredAt) : null,
            items: invoice?.orders,
          }),
        ),
        "",
        pendingChoicesText(),
      ].join("\n"),
    );
  }

  private async handlePending(
    chatId: string,
    member: Member,
    orderId: string,
    text: string,
  ): Promise<string> {
    const choice = isCancelKeyword(text) ? 2 : parseChoice(text, 2);
    if (!choice) {
      await this.send(chatId, `Balas angka pilihan:\n${pendingChoicesText()}`);
      return "pending: invalid";
    }
    const order = await this.orders.getOrder(member.id, orderId);
    if (order.status !== "waiting_payment") {
      await this.showMenu(chatId, member, "ℹ️ Order itu sudah tidak menunggu pembayaran.");
      return "pending: settled";
    }
    if (choice === 1) {
      await this.sendPayment(chatId, order);
      return "pending: payment resent";
    }
    const cancelled = await this.orders.cancelOrder(member.id, orderId);
    const ids = cancelled.invoice?.orders.map((o) => o.orderId) ?? [orderId];
    await this.showMenu(chatId, member, `🚫 Order ${ids.join(", ")} dibatalkan.`);
    return "pending: cancelled";
  }

  private async showHistory(chatId: string, member: Member): Promise<string> {
    const rows = await this.orders.listRecentForUser(member.id, 5);
    this.sessions.delete(chatId);
    await this.send(
      chatId,
      `${telegramHtmlToWhatsapp(
        orderHistoryHtml(
          rows.map((o) => ({
            orderId: o.orderId,
            serviceName: o.service.name,
            status: o.status,
            imei: o.imei,
          })),
        ),
      )}\n\nRiwayat lengkap: ${webPublicUrl()}/app\nKirim */menu* untuk kembali.`,
    );
    return "history";
  }

  private async showAccount(chatId: string, member: Member): Promise<string> {
    this.sessions.delete(chatId);
    await this.send(
      chatId,
      accountText({
        fullName: member.fullName,
        username: member.username,
        balance: member.creditBalance,
        whatsappNumber: member.number,
        groupName: member.group?.name ?? null,
        portalUrl: `${webPublicUrl()}/app`,
      }),
    );
    return "account";
  }

  private async findMember(phone: string): Promise<Member | null> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { provider_externalId: { provider: "whatsapp", externalId: phone } },
      select: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            creditBalance: true,
            status: true,
            botAccess: true,
            group: { select: { name: true } },
          },
        },
      },
    });
    return identity ? { ...identity.user, number: phone } : null;
  }

  private async senderPhone(chatId: string): Promise<string | null> {
    const direct = jidPhone(chatId);
    if (direct) return direct;
    if (!chatId.endsWith("@lid")) return null;
    const cached = this.lidPhones.get(chatId);
    if (cached && cached.expiresAt > Date.now()) return cached.phone;
    const phone = await this.waha.phoneForLid(chatId);
    this.lidPhones.set(chatId, { phone, expiresAt: Date.now() + LID_TTL_MS });
    return phone;
  }

  private getSession(chatId: string): Session | null {
    const entry = this.sessions.get(chatId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.sessions.delete(chatId);
      return null;
    }
    return entry.session;
  }

  private setSession(chatId: string, session: Session) {
    this.sessions.set(chatId, { session, expiresAt: Date.now() + SESSION_TTL_MS });
  }

  /** True when the message id was already handled (WAHA can deliver a webhook twice). */
  private markSeen(id: string): boolean {
    const now = Date.now();
    if ((this.seen.get(id) ?? 0) > now) return true;
    this.seen.set(id, now + SEEN_TTL_MS);
    if (this.seen.size > 2_000) {
      for (const [key, expiresAt] of this.seen) if (expiresAt <= now) this.seen.delete(key);
    }
    return false;
  }

  private async send(chatId: string, text: string) {
    await this.waha.sendText(chatId, text);
  }
}
