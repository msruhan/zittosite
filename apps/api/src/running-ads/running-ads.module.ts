import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { AdminRunningAdsController, RunningAdsController } from "./running-ads.controller";
import { RunningAdsService } from "./running-ads.service";

@Module({
  imports: [PrismaModule, AuthModule, AdminModule],
  controllers: [RunningAdsController, AdminRunningAdsController],
  providers: [RunningAdsService],
})
export class RunningAdsModule {}
