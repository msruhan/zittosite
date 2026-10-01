import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { TopupService } from "./topup.service";

@Controller("topups")
@UseGuards(UserAuthGuard)
export class TopupController {
  constructor(private readonly topups: TopupService) {}

  @Get()
  list(@Req() req: any) {
    return this.topups.list(req.user.sub);
  }

  @Post()
  async create(@Req() req: any, @Body() body: Record<string, unknown>) {
    const { topup } = await this.topups.create(req.user.sub, body.amount, "web");
    return topup;
  }

  @Get(":invoiceId")
  get(@Req() req: any, @Param("invoiceId") invoiceId: string) {
    return this.topups.get(req.user.sub, invoiceId);
  }

  @Post(":invoiceId/check")
  check(@Req() req: any, @Param("invoiceId") invoiceId: string) {
    return this.topups.check(req.user.sub, invoiceId);
  }

  @Post(":invoiceId/cancel")
  cancel(@Req() req: any, @Param("invoiceId") invoiceId: string) {
    return this.topups.cancel(req.user.sub, invoiceId);
  }
}
