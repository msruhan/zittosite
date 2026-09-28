import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import { sayabayarWebhookSecret } from "../config/env";
import { OrdersService } from "../orders/orders.service";

function signatureValid(rawBody: Buffer, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(
    signature.trim().replace(/^sha256=/i, ""),
    "hex",
  );
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

function str(value: unknown, max = 128): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

@Controller("payments/sayabayar")
@SkipThrottle()
export class SayabayarWebhookController {
  private readonly logger = new Logger(SayabayarWebhookController.name);

  constructor(private readonly orders: OrdersService) {}

  @Post("webhook")
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-signature") signature?: string,
  ) {
    const secret = sayabayarWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException("SayaBayar webhook not configured");
    }
    if (!req.rawBody || !signature || !signatureValid(req.rawBody, signature, secret)) {
      throw new UnauthorizedException("Invalid signature");
    }

    const body = req.body as { event?: unknown; data?: Record<string, unknown> };
    const event = str(body?.event, 64);
    const data = body?.data;
    if (!event || !data || typeof data !== "object") {
      throw new BadRequestException("Malformed payload");
    }

    const ref = {
      gatewayInvoiceId: str(data.invoice_id),
      invoiceNumber: str(data.invoice_number),
    };
    const label = ref.invoiceNumber ?? ref.gatewayInvoiceId ?? "?";

    if (event === "invoice.paid") {
      const amount = Number(data.amount);
      if (!Number.isInteger(amount)) {
        throw new BadRequestException("Malformed amount");
      }
      const paidAt = new Date(String(data.paid_at ?? ""));
      const outcome = await this.orders.confirmGatewayPayment({
        ...ref,
        amount,
        channel: str(data.payment_channel, 40),
        paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
        payload: data as Prisma.InputJsonValue,
      });
      if (outcome === "paid" || outcome === "duplicate") {
        this.logger.log(`invoice.paid ${label}: ${outcome}`);
      } else {
        this.logger.warn(`invoice.paid ${label}: ${outcome} (amount ${amount})`);
      }
      return { received: true };
    }

    if (event === "invoice.expired" || event === "invoice.cancelled") {
      const outcome = await this.orders.closeGatewayInvoice(
        ref,
        event === "invoice.expired" ? "expired" : "cancelled",
      );
      this.logger.log(`${event} ${label}: ${outcome}`);
      return { received: true };
    }

    this.logger.log(`Ignored SayaBayar event ${event}`);
    return { received: true };
  }
}
