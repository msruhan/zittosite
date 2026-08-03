import { Module } from "@nestjs/common";
import { UserAuthService } from "./user-auth.service";
import { UserAuthController } from "./user-auth.controller";
import { UserAuthGuard } from "./user-auth.guard";

@Module({
  controllers: [UserAuthController],
  providers: [UserAuthService, UserAuthGuard],
  exports: [UserAuthService, UserAuthGuard],
})
export class AuthModule {}
