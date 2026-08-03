import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { OrdersService } from "./orders.service";

@Controller("services")
@UseGuards(UserAuthGuard)
export class ServicesController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any) {
    return this.orders.listServices(req.user.sub);
  }
}
