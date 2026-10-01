/**
 * A user in a group pays the group's price (service default when the group has
 * none); otherwise their personal price, else the service default. Personal
 * prices are ignored while a group is set.
 */
export function resolveUserPrice(input: {
  defaultPrice: number;
  groupId: string | null;
  groupPrice?: number | null;
  personalPrice?: number | null;
}): number {
  if (input.groupId) return input.groupPrice ?? input.defaultPrice;
  return input.personalPrice ?? input.defaultPrice;
}
