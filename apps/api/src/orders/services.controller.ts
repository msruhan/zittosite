import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { OrdersService } from "./orders.service";
import { parseVia } from "./supplier-routed";

@Controller("services")
@UseGuards(UserAuthGuard)
export class ServicesController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query("via") via?: string) {
    return this.orders.listServices(req.user.sub, parseVia(via), { includeOffline: true });
  }
}
