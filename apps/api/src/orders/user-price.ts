/** A user in a group pays the group's price when it has one; everyone else pays the service default. */
export function resolveUserPrice(input: {
  defaultPrice: number;
  groupId: string | null;
  groupPrice?: number | null;
}): number {
  if (input.groupId) return input.groupPrice ?? input.defaultPrice;
  return input.defaultPrice;
}
