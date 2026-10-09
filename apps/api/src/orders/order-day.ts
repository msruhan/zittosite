import type { Prisma } from "@prisma/client";

/**
 * Orders that belong to a recap day: the day they were taken, or — for orders closed
 * straight from the queue — the day they were closed. Each order lands in exactly one day,
 * so an order taken yesterday and finished today is not recapped again today.
 */
export function orderDayWhere(range: { gte: Date; lt: Date }): Prisma.OrderWhereInput {
  return {
    OR: [
      { startedAt: range },
      { startedAt: null, status: "done", completedAt: range },
      { startedAt: null, status: { in: ["rejected", "cancel"] }, updatedAt: range },
    ],
  };
}
