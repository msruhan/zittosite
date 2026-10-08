import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Prisma, Supplier } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { SupplierDispatch } from "../orders/supplier-dispatch";
import { supplierExtraFields } from "../orders/special-fields";
import { UsdRateService } from "../orders/usd-rate.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { escapeHtml } from "../telegram/telegram-messages";
import { SupplierRequestError, supplierInputFields } from "./dhru-supplier-client";
import { customerText } from "../orders/customer-text";
import { checkSupplierCost } from "./supplier-price-guard";
import { decryptSupplierKey } from "./supplier-secret";
import { gcontactClient, supplierClient } from "./suppliers.service";

export const MAX_SUBMIT_ATTEMPTS = 5;
const DEFAULT_INTERVAL_MS = 5_000;
const SUBMIT_BATCH = 20;
const POLL_BATCH = 50;
/** In-process orders are re-checked at most this often... */
const POLL_EVERY_MS = 60_000;
/** ...except right after submission, when instant services usually finish. */
const FRESH_WINDOW_MS = 10 * 60_000;
const FRESH_POLL_EVERY_MS = 4_000;
/** First status check after a successful submit. */
const FIRST_CHECK_DELAY_MS = 2_000;
/** Supplier price list and account currency are reused this long before refetching. */
const PRICE_LIST_TTL_MS = 2 * 60_000;

type PriceList = { at: number; currency: string; credits: Map<string, number> };
type PendingOrder = Prisma.OrderGetPayload<{ include: { service: { include: { supplier: true } } } }>;
/** Why a submit did not go through; `refusal` is the supplier's message, safe to show once rewritten. */
type SubmitFailure = { failure: string; retryable: boolean; refusal: string | null };

/** Supplier refusals that are about our own account and worth retrying. */
export function isRetryableSupplierError(message: string): boolean {
  return /credit|balance|saldo|maintenance|try again|coba lagi|rate limit|too many/i.test(message);
}

/** Some suppliers mark failed orders as completed and put the error in CODE/COMMENTS. */
export function isErrorReply(text: string): boolean {
  return /\b(error|errors|failed|failure|gagal|invalid|refunded|rejected|cancell?ed)\b/i.test(text);
}

/** Wait before retry n (1-based): 1, 2, 4, 8 minutes. */
export function submitRetryDelayMs(attempts: number): number {
  return 60_000 * 2 ** Math.max(0, attempts - 1);
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/**
 * Forwards paid orders of supplier-routed services to their Dhru supplier and
 * completes them from the supplier's status.
 */
@Injectable()
export class SupplierWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplierWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private rerun = false;
  private unsubscribe: (() => void) | null = null;
  private readonly priceLists = new Map<string, PriceList>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly dispatch: SupplierDispatch,
    private readonly usdRate: UsdRateService,
    private readonly notify: AdminNotifyService,
  ) {}

  onModuleInit() {
    if (process.env.SUPPLIER_WORKER === "0" || process.env.NODE_ENV === "test") return;
    const ms = Number(process.env.SUPPLIER_POLL_MS ?? DEFAULT_INTERVAL_MS);
    const interval = Number.isFinite(ms) && ms >= 2_000 ? ms : DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    this.unsubscribe = this.dispatch.onPaid(() => this.kick());
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Runs a tick now, or right after the one in progress. */
  kick(delayMs = 0) {
    const timeout = setTimeout(() => void this.tick(), delayMs);
    timeout.unref();
  }

  async tick() {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        await this.submitPending();
        await this.pollInProcess();
      } while (this.rerun);
    } catch (err) {
      this.logger.error(`Supplier worker tick failed: ${errorText(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** Activity and customer notices never name the supplier; admins see it on the order. */
  private actor() {
    return { username: "Sistem", fullName: "otomatis" };
  }

  async submitPending() {
    const now = Date.now();
    const candidates = await this.prisma.order.findMany({
      where: {
        status: "waiting_action",
        assignedAdminId: null,
        supplierRef: null,
        supplierAttempts: { lt: MAX_SUBMIT_ATTEMPTS },
        service: {
          fulfillmentChannel: "supplier",
          supplierServiceId: { not: null },
          supplier: { isActive: true },
        },
      },
      include: { service: { include: { supplier: true } } },
      orderBy: { createdAt: "asc" },
      take: SUBMIT_BATCH,
    });

    for (const order of candidates) {
      const supplier = order.service.supplier!;
      if (
        order.supplierAttempts > 0 &&
        order.updatedAt.getTime() + submitRetryDelayMs(order.supplierAttempts) > now
      ) {
        continue;
      }
      const claimed = await this.prisma.order.updateMany({
        where: { id: order.id, status: "waiting_action", supplierRef: null, assignedAdminId: null },
        data: { supplierId: supplier.id, supplierAttempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      const attempts = order.supplierAttempts + 1;

      let outcome: SubmitFailure | null;
      try {
        outcome =
          supplier.kind === "gcontact"
            ? await this.submitLookup(order, supplier)
            : await this.submitDhru(order, supplier);
      } catch (err) {
        const failure = errorText(err);
        const retryable = err instanceof SupplierRequestError;
        if (!retryable) this.logger.error(`Supplier submit ${order.orderId} failed: ${failure}`);
        outcome = { failure, retryable, refusal: null };
      }
      if (!outcome) continue;
      const { failure, retryable, refusal } = outcome;

      await this.prisma.order.update({
        where: { id: order.id },
        data: { supplierError: failure },
      });
      if (!retryable || attempts >= MAX_SUBMIT_ATTEMPTS) {
        await this.orders.applyProcessorUpdate(
          order.id,
          {
            kind: "rejected",
            reason: refusal
              ? customerText(`Ditolak: ${refusal}`)
              : "Order tidak dapat diproses saat ini.",
          },
          this.actor(),
        );
      }
    }
  }

  /** Places the order at a Dhru supplier; null once submitted (or held for review). */
  private async submitDhru(order: PendingOrder, supplier: Supplier): Promise<SubmitFailure | null> {
    const prices = await this.priceList(supplier);
    const cost = checkSupplierCost({
      credit: prices.credits.get(order.service.supplierServiceId!),
      units: order.quantity ?? 1,
      currency: prices.currency,
      usdRate: await this.usdRate.get(),
      chargedPrice: order.price,
    });
    if (!cost.ok) {
      await this.hold(order, supplier, cost.reason);
      return null;
    }
    const reply = await supplierClient(supplier).placeOrder(
      order.service.supplierServiceId!,
      order.service.inputType === "none" ? null : order.imei,
      {
        ...supplierInputFields(order.service.inputType, order.imei),
        // Optional notes are meant for our admins; only a required Notes field goes upstream.
        ...supplierExtraFields({
          ...order,
          notes: order.service.requireNotes ? order.notes : null,
          password: order.passwordEnc ? decryptSupplierKey(order.passwordEnc) : null,
        }),
      },
    );
    if (reply.ok) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          supplierRef: reply.data.referenceId,
          supplierSubmittedAt: new Date(),
          supplierCheckedAt: null,
          supplierError: null,
        },
      });
      await this.orders.applyProcessorUpdate(
        order.id,
        { kind: "processing", note: "Sedang diproses otomatis." },
        this.actor(),
      );
      this.kick(FIRST_CHECK_DELAY_MS);
      return null;
    }
    const retryable = isRetryableSupplierError(reply.message);
    return { failure: reply.message, retryable, refusal: retryable ? null : reply.message };
  }

  /** GContact answers at once, so a successful lookup completes the order immediately. */
  private async submitLookup(order: PendingOrder, supplier: Supplier): Promise<SubmitFailure | null> {
    const reply = await gcontactClient(supplier).lookup(order.imei);
    if (!reply.ok) {
      if (reply.account) await this.flagLookupAccount(order.orderId, supplier, reply.message);
      return {
        failure: reply.message,
        retryable: reply.account,
        refusal: reply.account ? null : reply.message,
      };
    }
    const { lines, remainingQuota } = reply.data;
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        supplierRef: `GC-${order.orderId}`,
        supplierSubmittedAt: new Date(),
        supplierCheckedAt: new Date(),
        supplierError: null,
      },
    });
    await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        ...(remainingQuota !== null ? { lastBalance: `${remainingQuota} kuota` } : {}),
        lastError: null,
        lastCheckedAt: new Date(),
      },
    });
    await this.orders.applyProcessorUpdate(
      order.id,
      { kind: "done", note: lines.join("\n") },
      this.actor(),
    );
    return null;
  }

  /** Token, quota or rate-limit trouble is ours: shown on the supplier and sent to Super Admins once. */
  private async flagLookupAccount(orderId: string, supplier: Supplier, message: string) {
    const error = `GContact: ${message}`;
    const current = await this.prisma.supplier.findUnique({
      where: { id: supplier.id },
      select: { lastError: true },
    });
    if (current?.lastError === error) return;
    await this.prisma.supplier.update({ where: { id: supplier.id }, data: { lastError: error } });
    this.logger.warn(`GContact lookup ${orderId} refused for the account: ${message}`);
    await this.notify.notifySuperAdmins(
      [
        `⚠️ <b>${escapeHtml(supplier.name)} bermasalah</b>`,
        escapeHtml(message),
        "",
        `Order ${escapeHtml(orderId)} dicoba ulang otomatis; cek token/kuota di menu Supplier.`,
      ].join("\n"),
    );
  }

  /** Live supplier credits per service; a failed fetch throws so the submit is retried. */
  private async priceList(supplier: Supplier): Promise<PriceList> {
    const cached = this.priceLists.get(supplier.id);
    if (cached && Date.now() - cached.at < PRICE_LIST_TTL_MS) return cached;
    const client = supplierClient(supplier);
    const account = await client.accountInfo();
    if (!account.ok) throw new SupplierRequestError(`Saldo supplier gagal dibaca: ${account.message}`);
    const list = await client.serviceList();
    if (!list.ok) throw new SupplierRequestError(`Daftar harga supplier gagal dibaca: ${list.message}`);
    const fresh: PriceList = {
      at: Date.now(),
      currency: account.data.currency,
      credits: new Map(list.data.map((s) => [s.id, s.credit])),
    };
    this.priceLists.set(supplier.id, fresh);
    return fresh;
  }

  /**
   * Leaves the order in Waiting Action without forwarding it, and stops the
   * worker from retrying, so a Super Admin decides (cancel and refund, or handle manually).
   */
  private async hold(
    order: { id: string; orderId: string },
    supplier: Supplier,
    reason: string,
  ) {
    const error = `Ditahan, tidak diteruskan ke supplier: ${reason}`;
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: { supplierError: error, supplierAttempts: MAX_SUBMIT_ATTEMPTS },
      }),
      this.prisma.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "waiting_action",
          note: "Order sedang ditinjau admin.",
          actor: "Sistem",
        },
      }),
    ]);
    this.logger.warn(`Supplier submit ${order.orderId} held: ${reason}`);
    await this.notify.notifySuperAdmins(
      [
        `⚠️ <b>Order ${escapeHtml(order.orderId)} ditahan</b>`,
        `Tidak diteruskan ke ${escapeHtml(supplier.name)}: ${escapeHtml(reason)}`,
        "",
        "Order tetap Waiting Action. Batalkan (saldo user dikembalikan) atau proses manual.",
      ].join("\n"),
    );
  }

  async pollInProcess() {
    const now = Date.now();
    const due = new Date(now - POLL_EVERY_MS);
    const freshDue = new Date(now - FRESH_POLL_EVERY_MS);
    const freshSince = new Date(now - FRESH_WINDOW_MS);
    const orders = await this.prisma.order.findMany({
      where: {
        status: "in_process",
        supplierRef: { not: null },
        supplierId: { not: null },
        supplier: { kind: "dhru" },
        OR: [
          { supplierCheckedAt: null },
          { supplierCheckedAt: { lt: due } },
          { supplierSubmittedAt: { gte: freshSince }, supplierCheckedAt: { lt: freshDue } },
        ],
      },
      include: { supplier: true },
      orderBy: { supplierCheckedAt: { sort: "asc", nulls: "first" } },
      take: POLL_BATCH,
    });

    for (const order of orders) {
      const supplier = order.supplier!;
      await this.prisma.order.update({
        where: { id: order.id },
        data: { supplierCheckedAt: new Date() },
      });
      try {
        const reply = await supplierClient(supplier).orderStatus(order.supplierRef!);
        if (!reply.ok) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { supplierError: reply.message },
          });
          continue;
        }
        const { status, code, comments } = reply.data;
        if (status === 4 && isErrorReply(`${code} ${comments}`)) {
          const why = code || comments;
          await this.orders.applyProcessorUpdate(
            order.id,
            { kind: "rejected", reason: customerText(`Ditolak: ${why}`) },
            this.actor(),
          );
        } else if (status === 4) {
          await this.orders.applyProcessorUpdate(
            order.id,
            { kind: "done", note: code || comments },
            this.actor(),
          );
        } else if (status === 3) {
          const why = comments || code;
          await this.orders.applyProcessorUpdate(
            order.id,
            { kind: "rejected", reason: why ? customerText(`Ditolak: ${why}`) : "Ditolak." },
            this.actor(),
          );
        } else if (order.supplierError) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { supplierError: null },
          });
        }
      } catch (err) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { supplierError: errorText(err) },
        });
      }
    }
  }
}
