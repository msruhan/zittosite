import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModeService } from "./payment-mode.service";

@Module({
  imports: [PrismaModule],
  providers: [PaymentModeService],
  exports: [PaymentModeService],
})
export class PaymentModeModule {}
