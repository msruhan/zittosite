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
import { optString, optStringList } from "../security/input";
import { parseVia } from "./supplier-routed";

@Controller("orders")
@UseGuards(UserAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query("q") q?: string, @Query("via") via?: string) {
    return this.orders.listOrders(req.user.sub, q, parseVia(via));
  }

  @Post()
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.orders.createOrder(req.user.sub, {
      serviceId: optString(body.serviceId, "Layanan", 64),
      imei: optString(body.imei, "IMEI", 32),
      imeis: optStringList(body.imeis, "IMEI", 20, 32),
      notes: optString(body.notes, "Catatan", 500),
      qnt: typeof body.qnt === "number" ? body.qnt : optString(body.qnt, "Qnt", 12),
      email: optString(body.email, "Email", 254),
      username: optString(body.username, "Username", 100),
      password: optString(body.password, "Password", 128),
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
