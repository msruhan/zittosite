import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { AuditLogService } from "../security/audit-log.service";
import { optBoolean, optString } from "../security/input";
import { SENSITIVE_THROTTLE } from "../security/throttle";
import { ApiKeysService } from "./api-keys.service";
import { WebhookService } from "./webhook.service";

type UserReq = { user: { sub: string } };
type Json = Record<string, unknown>;

@Controller()
@UseGuards(UserAuthGuard)
export class ApiPortalController {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly webhooks: WebhookService,
    private readonly audit: AuditLogService,
  ) {}

  @Get("api-keys")
  listKeys(@Req() req: UserReq) {
    return this.keys.list(req.user.sub);
  }

  @Post("api-keys")
  @Throttle(SENSITIVE_THROTTLE)
  async createKey(@Req() req: UserReq, @Body() body: Json) {
    const key = await this.keys.create(req.user.sub, optString(body.name, "Nama key", 60));
    this.audit.record("api.key.created", {
      actorUserId: req.user.sub,
      keyName: key.name,
      keyPrefix: key.prefix,
    });
    return key;
  }

  @Delete("api-keys/:id")
  async revokeKey(@Req() req: UserReq, @Param("id") id: string) {
    const key = await this.keys.revoke(req.user.sub, id);
    this.audit.record("api.key.revoked", {
      actorUserId: req.user.sub,
      keyName: key.name,
      keyPrefix: key.prefix,
    });
    return key;
  }

  @Get("webhook")
  async getWebhook(@Req() req: UserReq) {
    await this.keys.assertApiEnabled(req.user.sub);
    return { endpoint: await this.webhooks.get(req.user.sub) };
  }

  @Put("webhook")
  @Throttle(SENSITIVE_THROTTLE)
  async saveWebhook(@Req() req: UserReq, @Body() body: Json) {
    await this.keys.assertApiEnabled(req.user.sub);
    const input = {
      url: optString(body.url, "URL webhook", 500),
      isActive: optBoolean(body.isActive, "Aktif"),
    };
    const saved = await this.webhooks.save(req.user.sub, input);
    this.audit.record("api.webhook.updated", {
      actorUserId: req.user.sub,
      url: saved.endpoint?.url,
      active: saved.endpoint?.isActive,
    });
    return saved;
  }

  @Post("webhook/secret")
  @Throttle(SENSITIVE_THROTTLE)
  async rotateSecret(@Req() req: UserReq) {
    await this.keys.assertApiEnabled(req.user.sub);
    const result = await this.webhooks.rotateSecret(req.user.sub);
    this.audit.record("api.webhook.updated", {
      actorUserId: req.user.sub,
      secretRotated: true,
    });
    return result;
  }

  @Post("webhook/test")
  @Throttle(SENSITIVE_THROTTLE)
  async testWebhook(@Req() req: UserReq) {
    await this.keys.assertApiEnabled(req.user.sub);
    return this.webhooks.test(req.user.sub);
  }

  @Get("webhook/deliveries")
  async deliveries(@Req() req: UserReq) {
    await this.keys.assertApiEnabled(req.user.sub);
    return this.webhooks.deliveries(req.user.sub);
  }
}
