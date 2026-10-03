import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Supplier } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { SupplierDispatch } from "../orders/supplier-dispatch";
import { supplierExtraFields } from "../orders/special-fields";
import { UsdRateService } from "../orders/usd-rate.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { escapeHtml } from "../telegram/telegram-messages";
import { SupplierRequestError, supplierInputFields } from "./dhru-supplier-client";
import { checkSupplierCost } from "./supplier-price-guard";
import { supplierClient } from "./suppliers.service";

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

/** Supplier refusals that are about our own account and worth retrying. */
export function isRetryableSupplierError(message: string): boolean {
  return /credit|balance|saldo|maintenance|try again|coba lagi|rate limit|too many/i.test(message);
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

  private actor(supplier: Supplier) {
    return { username: "supplier", fullName: supplier.name };
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

      let failure: string;
      let retryable: boolean;
      try {
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
          continue;
        }
        const reply = await supplierClient(supplier).placeOrder(
          order.service.supplierServiceId!,
          order.service.inputType === "none" ? null : order.imei,
          {
            ...supplierInputFields(order.service.inputType, order.imei),
            ...supplierExtraFields(order),
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
            { kind: "processing", note: "Diterima Supplier API, sedang diproses otomatis." },
            this.actor(supplier),
          );
          this.kick(FIRST_CHECK_DELAY_MS);
          continue;
        }
        failure = reply.message;
        retryable = isRetryableSupplierError(reply.message);
      } catch (err) {
        failure = errorText(err);
        retryable = err instanceof SupplierRequestError;
        if (!retryable) this.logger.error(`Supplier submit ${order.orderId} failed: ${failure}`);
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: { supplierError: failure },
      });
      if (!retryable || attempts >= MAX_SUBMIT_ATTEMPTS) {
        await this.orders.applyProcessorUpdate(
          order.id,
          {
            kind: "rejected",
            reason: retryable
              ? `Supplier tidak dapat memproses order: ${failure}`
              : `Ditolak supplier: ${failure}`,
          },
          this.actor(supplier),
        );
      }
    }
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
        data: { orderId: order.id, status: "waiting_action", note: error, actor: "Sistem" },
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
        if (status === 4) {
          await this.orders.applyProcessorUpdate(
            order.id,
            { kind: "done", note: code || comments },
            this.actor(supplier),
          );
        } else if (status === 3) {
          const why = comments || code;
          await this.orders.applyProcessorUpdate(
            order.id,
            { kind: "rejected", reason: why ? `Ditolak supplier: ${why}` : "Ditolak supplier." },
            this.actor(supplier),
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
