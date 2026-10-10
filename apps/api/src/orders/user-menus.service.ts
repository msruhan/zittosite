import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MENU_SELECT, type MenuInfo } from "./supplier-routed";
import {
  MAX_MENUS,
  USER_MENUS_KEY,
  normalizeOrderMenu,
  type MenuUpdate,
  type NewMenuInput,
  type UserMenu,
  type UserMenus,
} from "./user-menus";

@Injectable()
export class UserMenusService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<UserMenus> {
    const [row, menus] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: USER_MENUS_KEY } }),
      this.listMenus(),
    ]);
    return { order: normalizeOrderMenu(row?.value), menus };
  }

  listMenus(): Promise<MenuInfo[]> {
    return this.prisma.serviceMenu.findMany({
      select: MENU_SELECT,
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  /** Saves the Order menu and every service menu's name, switch and position. */
  async set(input: { order: UserMenu; menus: MenuUpdate[] }, actorId: string): Promise<UserMenus> {
    const existing = await this.prisma.serviceMenu.findMany({ select: { id: true } });
    const known = new Set(existing.map((menu) => menu.id));
    if (input.menus.length !== known.size || input.menus.some((menu) => !known.has(menu.id))) {
      throw new BadRequestException("Daftar menu sudah berubah. Muat ulang halaman.");
    }
    const value = { order: input.order } as Prisma.InputJsonObject;
    await this.prisma.$transaction([
      this.prisma.systemSetting.upsert({
        where: { key: USER_MENUS_KEY },
        create: { key: USER_MENUS_KEY, value, updatedBy: actorId },
        update: { value, updatedBy: actorId },
      }),
      ...input.menus.map((menu, index) =>
        this.prisma.serviceMenu.update({
          where: { id: menu.id },
          data: { label: menu.label, enabled: menu.enabled, sortOrder: (index + 1) * 10 },
        }),
      ),
    ]);
    return this.get();
  }

  async create(input: NewMenuInput): Promise<MenuInfo> {
    const count = await this.prisma.serviceMenu.count();
    if (count >= MAX_MENUS) throw new BadRequestException(`Maksimal ${MAX_MENUS} menu.`);
    const last = await this.prisma.serviceMenu.aggregate({ _max: { sortOrder: true } });
    try {
      return await this.prisma.serviceMenu.create({
        data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 10 },
        select: MENU_SELECT,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Alamat menu "${input.slug}" sudah dipakai.`);
      }
      throw err;
    }
  }

  /** Only empty menus can go; a menu with services is switched off instead. */
  async remove(id: string): Promise<MenuInfo> {
    const menu = await this.prisma.serviceMenu.findUnique({ where: { id }, select: MENU_SELECT });
    if (!menu) throw new NotFoundException("Menu tidak ditemukan.");
    const inUse = await this.prisma.service.count({ where: { menuId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `Menu ${menu.label} masih dipakai ${inUse} layanan. Pindahkan layanannya atau nonaktifkan menu.`,
      );
    }
    await this.prisma.serviceMenu.delete({ where: { id } });
    return menu;
  }
}
