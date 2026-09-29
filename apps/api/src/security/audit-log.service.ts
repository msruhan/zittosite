import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVITY_EVENTS, type AuditEvent } from "./activity-events";

export type { AuditEvent } from "./activity-events";

type Fields = Record<string, string | number | boolean | null | undefined>;

type Actor = {
  type: "user" | "admin" | "system" | "guest";
  id: string | null;
  name: string | null;
  role: string | null;
};

/**
 * Security and activity trail: one JSON line per event on stdout for the log
 * pipeline, plus a row in activity_logs for the Super Admin panel.
 * Never pass passwords, tokens, or codes.
 *
 * Actor resolution: `actorId` is an admin, `actorUserId` is a user; auth events
 * fall back to their own `adminId` / `userId`; anything else is the system.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger("Audit");

  constructor(private readonly prisma: PrismaService) {}

  record(event: AuditEvent, fields: Fields = {}) {
    this.logger.log(
      JSON.stringify({ event, at: new Date().toISOString(), ...fields }),
    );
    void this.persist(event, fields).catch((err) =>
      this.logger.warn(
        `activity log write failed (${event}): ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  private async persist(event: AuditEvent, fields: Fields) {
    const info = ACTIVITY_EVENTS[event];
    const actor = await this.resolveActor(event, fields);
    const target = await this.resolveTarget(actor, fields);
    const { ip, userAgent, ...rest } = fields;
    const meta = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    await this.prisma.activityLog.create({
      data: {
        event,
        category: info.category,
        actorType: actor.type,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetLabel: target,
        orderId: typeof fields.orderId === "string" ? fields.orderId : null,
        summary: info.summary({ fields, target }).slice(0, 500),
        ip: typeof ip === "string" ? ip.slice(0, 64) : null,
        meta: meta as Prisma.InputJsonValue,
      },
    });
  }

  private async adminActor(id: string): Promise<Actor> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: { fullName: true, username: true, role: true },
    });
    return {
      type: "admin",
      id,
      name: admin ? `${admin.fullName} (@${admin.username})` : null,
      role: admin?.role ?? "admin",
    };
  }

  private async userActor(id: string): Promise<Actor> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { fullName: true, username: true },
    });
    return {
      type: "user",
      id,
      name: user ? `${user.fullName} (@${user.username})` : null,
      role: "user",
    };
  }

  private async resolveActor(event: AuditEvent, f: Fields): Promise<Actor> {
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    const actorId = str(f.actorId);
    if (actorId) return this.adminActor(actorId);
    const actorUserId = str(f.actorUserId);
    if (actorUserId) return this.userActor(actorUserId);
    if (event.startsWith("auth.admin.") || event === "admin.telegram.invite_claimed") {
      const adminId = str(f.adminId);
      if (adminId) return this.adminActor(adminId);
    }
    if (event.startsWith("auth.user.")) {
      const userId = str(f.userId);
      if (userId) return this.userActor(userId);
    }
    const username = str(f.username);
    if (username) return { type: "guest", id: null, name: username, role: null };
    return { type: "system", id: null, name: "Sistem", role: null };
  }

  /** The user or admin an action was performed on, when that isn't the actor. */
  private async resolveTarget(actor: Actor, f: Fields): Promise<string | null> {
    const userId = typeof f.userId === "string" ? f.userId : null;
    if (userId && !(actor.type === "user" && actor.id === userId)) {
      return (await this.userActor(userId)).name;
    }
    const adminId = typeof f.adminId === "string" ? f.adminId : null;
    if (adminId && !(actor.type === "admin" && actor.id === adminId)) {
      return (await this.adminActor(adminId)).name;
    }
    return null;
  }

  async list(query: {
    category?: string;
    q?: string;
    from?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 10), 100);
    const page = Math.max(query.page ?? 1, 1);
    const q = query.q?.trim();
    const where: Prisma.ActivityLogWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.from ? { createdAt: { gte: query.from } } : {}),
      ...(q
        ? {
            OR: [
              { summary: { contains: q, mode: "insensitive" } },
              { actorName: { contains: q, mode: "insensitive" } },
              { targetLabel: { contains: q, mode: "insensitive" } },
              { orderId: { contains: q, mode: "insensitive" } },
              { ip: { contains: q } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        id: row.id,
        event: row.event,
        label: ACTIVITY_EVENTS[row.event as AuditEvent]?.label ?? row.event,
        category: row.category,
        actorType: row.actorType,
        actorName: row.actorName,
        actorRole: row.actorRole,
        targetLabel: row.targetLabel,
        orderId: row.orderId,
        summary: row.summary,
        ip: row.ip,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
