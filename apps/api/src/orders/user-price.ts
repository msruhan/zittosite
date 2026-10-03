/** Priority: the user's own price, then their group's price, then the service default. */
export function resolveUserPrice(input: {
  defaultPrice: number;
  groupId: string | null;
  groupPrice?: number | null;
  userPrice?: number | null;
}): number {
  if (input.userPrice != null) return input.userPrice;
  if (input.groupId) return input.groupPrice ?? input.defaultPrice;
  return input.defaultPrice;
}
