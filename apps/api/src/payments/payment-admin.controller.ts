import { BadRequestException, Body, Controller, Get, HttpCode, Put, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { SuperAdminGuard } from "../admin/super-admin.guard";
import { sayabayarConfig } from "../config/env";
import { GobizPollerWorker } from "./gobiz-poller.worker";
import { GobizSessionService } from "./gobiz-session.service";
import { PaymentModeService, type PaymentGateway } from "./payment-mode.service";
import { qrisMerchantName } from "./qris";

type AdminReq = { admin: { sub: string } };

@Controller("admin/payments")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
export class PaymentAdminController {
  constructor(
    private readonly mode: PaymentModeService,
    private readonly session: GobizSessionService,
    private readonly poller: GobizPollerWorker,
  ) {}

  @Get()
  async status() {
    const [gateway, qris] = await Promise.all([this.mode.gateway(), this.mode.staticQris()]);
    return {
      gateway,
      sayabayar: { configured: sayabayarConfig() !== null },
      listener: {
        qrisConfigured: Boolean(qris),
        qris,
        merchantName: qris ? qrisMerchantName(qris) : null,
        session: await this.session.status(),
        poller: this.poller.status(),
      },
    };
  }

  @Put("gateway")
  async setGateway(@Req() req: AdminReq, @Body() body: { gateway?: string }) {
    const gateway = body.gateway;
    if (gateway !== "sayabayar" && gateway !== "listener") {
      throw new BadRequestException("Pilih Saya Bayar atau Listener VPS.");
    }
    await this.mode.setGateway(gateway as PaymentGateway, req.admin.sub);
    return { gateway };
  }

  @Put("qris")
  async setQris(@Req() req: AdminReq, @Body() body: { payload?: string }) {
    const payload = typeof body.payload === "string" ? body.payload : "";
    if (!payload.trim()) throw new BadRequestException("Tempel QRIS statis dari aplikasi GoBiz.");
    const saved = await this.mode.setStaticQris(payload, req.admin.sub);
    return { ok: true, ...saved };
  }

  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post("gobiz/otp")
  @HttpCode(200)
  requestOtp(@Req() req: AdminReq, @Body() body: { phone?: string }) {
    return this.session.startOtpLogin(String(body.phone ?? ""), req.admin.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Post("gobiz/verify")
  @HttpCode(200)
  verifyOtp(@Req() req: AdminReq, @Body() body: { otp?: string }) {
    return this.session.completeOtpLogin(String(body.otp ?? ""), req.admin.sub);
  }

  @Post("gobiz/disconnect")
  @HttpCode(200)
  async disconnect() {
    await this.session.disconnect();
    return { ok: true };
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post("gobiz/poll")
  @HttpCode(200)
  async pollNow() {
    const result = await this.poller.tick();
    return { ok: result !== null, processed: result?.processed ?? 0, poller: this.poller.status() };
  }
}
