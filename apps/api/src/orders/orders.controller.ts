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

@Controller("orders")
@UseGuards(UserAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query("q") q?: string) {
    return this.orders.listOrders(req.user.sub, q);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { serviceId?: string; imei?: string; notes?: string },
  ) {
    return this.orders.createOrder(req.user.sub, body);
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
