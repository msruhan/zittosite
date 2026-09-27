import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { LoginAttemptService } from "./login-attempt.service";

@Global()
@Module({
  providers: [AuditLogService, LoginAttemptService],
  exports: [AuditLogService, LoginAttemptService],
})
export class SecurityModule {}
