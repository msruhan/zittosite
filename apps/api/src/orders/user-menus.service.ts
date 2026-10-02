import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { USER_MENUS_KEY, normalizeUserMenus, type UserMenus } from "./user-menus";

@Injectable()
export class UserMenusService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<UserMenus> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: USER_MENUS_KEY } });
    return normalizeUserMenus(row?.value);
  }

  async set(menus: UserMenus, actorId: string): Promise<UserMenus> {
    await this.prisma.systemSetting.upsert({
      where: { key: USER_MENUS_KEY },
      create: { key: USER_MENUS_KEY, value: menus, updatedBy: actorId },
      update: { value: menus, updatedBy: actorId },
    });
    return menus;
  }
}
