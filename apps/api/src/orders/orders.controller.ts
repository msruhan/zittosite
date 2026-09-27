import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { OrdersService } from "./orders.service";
import { optString } from "../security/input";

@Controller("orders")
@UseGuards(UserAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query("q") q?: string) {
    return this.orders.listOrders(req.user.sub, q);
  }

  @Post()
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.orders.createOrder(req.user.sub, {
      serviceId: optString(body.serviceId, "Layanan", 64),
      imei: optString(body.imei, "IMEI", 32),
      notes: optString(body.notes, "Catatan", 500),
      channel: "web",
    });
  }

  @Get(":orderId")
  get(@Req() req: any, @Param("orderId") orderId: string) {
    return this.orders.getOrder(req.user.sub, orderId);
  }

  @Post(":orderId/cancel")
  cancel(@Req() req: any, @Param("orderId") orderId: string) {
    return this.orders.cancelOrder(req.user.sub, orderId);
  }

  @Post(":orderId/mark-paid")
  markPaid(@Req() req: any, @Param("orderId") orderId: string) {
    return this.orders.markPaid(req.user.sub, orderId);
  }
}
