import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminTelegramLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async notificationDestinations(): Promise<
    { adminId: string; chatId: string; username: string }[]
  > {
    const admins = await this.prisma.admin.findMany({
      where: {
        status: "active",
        telegramUserId: { not: null },
        telegramChatId: { not: null },
        telegramLinkedAt: { not: null },
      },
      select: {
        id: true,
        username: true,
        telegramChatId: true,
      },
    });
    return admins.flatMap((admin) =>
      admin.telegramChatId
        ? [
            {
              adminId: admin.id,
              chatId: admin.telegramChatId,
              username: admin.username,
            },
          ]
        : [],
    );
  }

  async notificationChatIds(): Promise<string[]> {
    const destinations = await this.notificationDestinations();
    return destinations.map((d) => d.chatId);
  }
}
