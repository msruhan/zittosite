import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ServicePriceInput } from "../security/input";

const groupInclude = {
  prices: { select: { serviceId: true, price: true } },
  users: {
    select: { id: true, username: true, fullName: true },
    orderBy: { fullName: "asc" as const },
  },
} satisfies Prisma.UserGroupInclude;

type GroupRow = Prisma.UserGroupGetPayload<{ include: typeof groupInclude }>;

function serializeGroup(group: GroupRow) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    prices: group.prices,
    members: group.users,
    createdAt: group.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.userGroup.findMany({
      include: groupInclude,
      orderBy: { name: "asc" },
    });
    return groups.map(serializeGroup);
  }

  async create(input: { name?: string; description?: string; prices?: ServicePriceInput[] }) {
    const name = (input.name ?? "").trim();
    if (!name) throw new BadRequestException("Nama group wajib diisi.");
    await this.assertServicesExist(input.prices);
    try {
      const group = await this.prisma.userGroup.create({
        data: {
          name,
          description: (input.description ?? "").trim(),
          prices: input.prices?.length ? { createMany: { data: input.prices } } : undefined,
        },
        include: groupInclude,
      });
      return serializeGroup(group);
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  async update(
    id: string,
    input: { name?: string; description?: string; prices?: ServicePriceInput[] },
  ) {
    await this.findOrThrow(id);
    const name = input.name === undefined ? undefined : input.name.trim();
    if (name === "") throw new BadRequestException("Nama group wajib diisi.");
    await this.assertServicesExist(input.prices);
    try {
      const group = await this.prisma.$transaction(async (tx) => {
        await tx.userGroup.update({
          where: { id },
          data: {
            name,
            description: input.description === undefined ? undefined : input.description.trim(),
          },
        });
        if (input.prices !== undefined) {
          await tx.userGroupPrice.deleteMany({ where: { groupId: id } });
          if (input.prices.length) {
            await tx.userGroupPrice.createMany({
              data: input.prices.map((p) => ({ ...p, groupId: id })),
            });
          }
        }
        return tx.userGroup.findUniqueOrThrow({ where: { id }, include: groupInclude });
      });
      return serializeGroup(group);
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  /** Replaces the member list; joining users lose their personal prices. */
  async setMembers(id: string, userIds: string[]) {
    await this.findOrThrow(id);
    const unique = [...new Set(userIds)];
    const found = await this.prisma.user.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw new BadRequestException("User tidak ditemukan.");
    const group = await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { groupId: id, id: { notIn: unique } },
        data: { groupId: null },
      });
      if (unique.length) {
        await tx.user.updateMany({ where: { id: { in: unique } }, data: { groupId: id } });
        await tx.userServicePrice.deleteMany({ where: { userId: { in: unique } } });
      }
      return tx.userGroup.findUniqueOrThrow({ where: { id }, include: groupInclude });
    });
    return serializeGroup(group);
  }

  async remove(id: string) {
    const group = await this.findOrThrow(id);
    await this.prisma.userGroup.delete({ where: { id } });
    return group;
  }

  private async findOrThrow(id: string) {
    const group = await this.prisma.userGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException("Group tidak ditemukan.");
    return group;
  }

  private async assertServicesExist(prices?: ServicePriceInput[]) {
    if (!prices?.length) return;
    const found = await this.prisma.service.count({
      where: { id: { in: prices.map((p) => p.serviceId) } },
    });
    if (found !== prices.length) {
      throw new BadRequestException("Layanan pada harga group tidak ditemukan.");
    }
  }

  private mapUniqueError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException("Nama group sudah dipakai.");
    }
    return err;
  }
}
