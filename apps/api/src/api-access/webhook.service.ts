import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { Prisma, WebhookEndpoint } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { describeOrder, webhookEventFor } from "./dhru-format";
import {
  checkWebhookUrl,
  generateWebhookSecret,
  nextRetryDelay,
  signWebhook,
} from "./webhook-security";

const SWEEP_INTERVAL_MS = 30_000;
const DELIVERY_TIMEOUT_MS = 10_000;
const PAUSE_AFTER_FAILURES = 10;
/** Finished orders older than this are not scanned again. */
const SCAN_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SCAN_BATCH = 200;
const DELIVERY_BATCH = 20;

type SendResult = { ok: boolean; status: number | null; error: string | null };

function serializeEndpoint(endpoint: WebhookEndpoint | null) {
  if (!endpoint) return null;
  return {
    url: endpoint.url,
    isActive: endpoint.isActive,
    failureCount: endpoint.failureCount,
    lastStatus: endpoint.lastStatus,
    lastDeliveryAt: endpoint.lastDeliveryAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt.toISOString(),
  };
}

@Injectable()
export class WebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async get(userId: string) {
    return serializeEndpoint(
      await this.prisma.webhookEndpoint.findUnique({ where: { userId } }),
    );
  }

  /** Creates or updates the endpoint. A new endpoint returns its secret once. */
  async save(userId: string, input: { url?: string; isActive?: boolean }) {
    const existing = await this.prisma.webhookEndpoint.findUnique({ where: { userId } });
    const url = input.url?.trim();
    if (!existing && !url) throw new BadRequestException("URL webhook wajib diisi.");
    if (url) {
      const check = await checkWebhookUrl(url);
      if (!check.ok) throw new BadRequestException(check.reason);
    }
    const reactivate = input.isActive === true && existing && !existing.isActive;
    if (!existing) {
      const secret = generateWebhookSecret();
      const created = await this.prisma.webhookEndpoint.create({
        data: { userId, url: url!, secret, isActive: input.isActive ?? true },
      });
      return { endpoint: serializeEndpoint(created), secret };
    }
    const updated = await this.prisma.webhookEndpoint.update({
      where: { userId },
      data: {
        ...(url ? { url } : {}),
        ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
        ...(reactivate ? { failureCount: 0 } : {}),
      },
    });
    return { endpoint: serializeEndpoint(updated), secret: null };
  }

  async rotateSecret(userId: string) {
    const existing = await this.prisma.webhookEndpoint.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException("Webhook belum diatur.");
    const secret = generateWebhookSecret();
    await this.prisma.webhookEndpoint.update({ where: { userId }, data: { secret } });
    return { secret };
  }

  async deliveries(userId: string) {
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { endpoint: { userId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { order: { select: { orderId: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order.orderId,
      event: row.event,
      status: row.status,
      attempts: row.attempts,
      responseCode: row.responseCode,
      lastError: row.lastError,
      nextAttemptAt: row.status === "pending" ? row.nextAttemptAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /** Sends a `ping` right away; does not touch delivery history or the failure count. */
  async test(userId: string): Promise<SendResult> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { userId } });
    if (!endpoint) throw new NotFoundException("Webhook belum diatur.");
    return this.send(endpoint, `ping-${Date.now()}`, {
      event: "ping",
      sentAt: new Date().toISOString(),
    });
  }

  private async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      await this.enqueueFinishedOrders();
      await this.deliverDue();
    } catch (err) {
      this.logger.warn(
        `Webhook sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Final states are written from several places (Telegram operators,
   * Roamercheck, the admin panel, cancel), so finished API orders are found by
   * scanning instead of hooking each one. The unique key makes this idempotent.
   */
  async enqueueFinishedOrders() {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { isActive: true, user: { apiEnabled: true } },
    });
    const windowStart = new Date(Date.now() - SCAN_WINDOW_MS);
    for (const endpoint of endpoints) {
      const since = endpoint.createdAt > windowStart ? endpoint.createdAt : windowStart;
      const orders = await this.prisma.order.findMany({
        where: {
          userId: endpoint.userId,
          channel: "api",
          status: { in: ["done", "rejected", "cancel"] },
          updatedAt: { gte: since },
        },
        orderBy: { updatedAt: "desc" },
        take: SCAN_BATCH,
        include: {
          service: { select: { code: true, name: true } },
          result: { select: { resultStatus: true, resultNote: true } },
          webhookDeliveries: { where: { endpointId: endpoint.id }, select: { event: true } },
        },
      });
      const data: Prisma.WebhookDeliveryCreateManyInput[] = [];
      for (const order of orders) {
        const event = webhookEventFor(order);
        if (!event || order.webhookDeliveries.some((d) => d.event === event)) continue;
        const view = describeOrder(order);
        data.push({
          endpointId: endpoint.id,
          orderId: order.id,
          event,
          payload: {
            event,
            referenceId: order.orderId,
            imei: order.imei,
            service: { id: order.service.code, name: order.service.name },
            status: view.status,
            code: view.code,
            comments: view.comments,
            message: view.message,
            completedAt: (order.completedAt ?? order.updatedAt).toISOString(),
          },
        });
      }
      if (data.length) {
        await this.prisma.webhookDelivery.createMany({ data, skipDuplicates: true });
      }
    }
  }

  async deliverDue() {
    const due = await this.prisma.webhookDelivery.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: new Date() },
        endpoint: { isActive: true },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: DELIVERY_BATCH,
      include: { endpoint: true },
    });
    const paused = new Set<string>();
    for (const delivery of due) {
      if (paused.has(delivery.endpointId)) continue;
      const result = await this.send(
        delivery.endpoint,
        delivery.id,
        delivery.payload as Record<string, unknown>,
      );
      const attempts = delivery.attempts + 1;
      const retryIn = result.ok ? null : nextRetryDelay(attempts);
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          responseCode: result.status,
          lastError: result.error,
          status: result.ok ? "success" : retryIn === null ? "failed" : "pending",
          ...(retryIn !== null ? { nextAttemptAt: new Date(Date.now() + retryIn) } : {}),
        },
      });
      const endpoint = await this.prisma.webhookEndpoint.update({
        where: { id: delivery.endpoint.id },
        data: {
          failureCount: result.ok ? 0 : { increment: 1 },
          lastStatus: result.ok ? "success" : "failed",
          lastDeliveryAt: new Date(),
        },
      });
      if (endpoint.isActive && endpoint.failureCount >= PAUSE_AFTER_FAILURES) {
        await this.prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { isActive: false },
        });
        paused.add(endpoint.id);
        this.logger.warn(
          `Webhook endpoint ${endpoint.id} paused after ${endpoint.failureCount} failures`,
        );
      }
    }
  }

  private async send(
    endpoint: Pick<WebhookEndpoint, "url" | "secret">,
    deliveryId: string,
    payload: Record<string, unknown>,
  ): Promise<SendResult> {
    const check = await checkWebhookUrl(endpoint.url);
    if (!check.ok) return { ok: false, status: null, error: check.reason };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const res = await fetch(check.url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ZittoSite-Webhook/1.0",
          "X-Webhook-Id": deliveryId,
          "X-Webhook-Event": String(payload.event ?? ""),
          "X-Timestamp": String(timestamp),
          "X-Signature": signWebhook(endpoint.secret, timestamp, body),
        },
        body,
      });
      await res.body?.cancel().catch(() => undefined);
      const ok = res.status >= 200 && res.status < 300;
      return { ok, status: res.status, error: ok ? null : `HTTP ${res.status}` };
    } catch (err) {
      const message =
        err instanceof Error && err.name === "TimeoutError"
          ? "Timeout 10 detik"
          : err instanceof Error
            ? err.message
            : String(err);
      return { ok: false, status: null, error: message.slice(0, 300) };
    }
  }
}
