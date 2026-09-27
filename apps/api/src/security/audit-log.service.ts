import { Injectable, Logger } from "@nestjs/common";

export type AuditEvent =
  | "auth.user.login_success"
  | "auth.user.login_failed"
  | "auth.user.locked"
  | "auth.user.password_changed"
  | "auth.admin.login_success"
  | "auth.admin.login_failed"
  | "auth.admin.login_denied_operator"
  | "auth.admin.totp_failed"
  | "auth.admin.locked"
  | "auth.admin.password_changed"
  | "auth.admin.totp_enabled"
  | "auth.admin.totp_disabled"
  | "admin.user.created"
  | "admin.user.updated"
  | "admin.user.deleted"
  | "admin.admin.created"
  | "admin.admin.updated"
  | "admin.admin.deleted"
  | "admin.service.created"
  | "admin.service.updated"
  | "admin.order.status_override"
  | "admin.telegram.invite_created"
  | "admin.telegram.invite_revoked"
  | "admin.telegram.invite_claimed"
  | "admin.telegram.invite_approved"
  | "admin.telegram.invite_rejected"
  | "admin.telegram.unlinked";

/**
 * Security audit trail as one JSON line per event on stdout, so the container
 * log pipeline can ship and alert on it. Never pass passwords, tokens, or codes.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger("Audit");

  record(
    event: AuditEvent,
    fields: Record<string, string | number | boolean | null | undefined> = {},
  ) {
    this.logger.log(
      JSON.stringify({ event, at: new Date().toISOString(), ...fields }),
    );
  }
}
