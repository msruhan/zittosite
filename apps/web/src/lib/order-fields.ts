import { INPUT_TYPE_LABEL } from "@/lib/imei-list";
import type { Order, Service } from "@/lib/types";

/** Layanan Spesial extra fields an admin can require; keys match the Service flags. */
export const EXTRA_FIELD_OPTIONS = [
  { key: "requireQnt", label: "Qnt" },
  { key: "requireEmail", label: "Email" },
  { key: "requireUsername", label: "Username" },
  { key: "requirePassword", label: "Password" },
  { key: "requireKeyLock", label: "Key Lock" },
  { key: "requireNotes", label: "Notes" },
] as const satisfies ReadonlyArray<{ key: keyof Service; label: string }>;

export type ExtraFieldKey = (typeof EXTRA_FIELD_OPTIONS)[number]["key"];
export type ExtraFieldFlags = Record<ExtraFieldKey, boolean>;

export const NO_EXTRA_FIELDS: ExtraFieldFlags = {
  requireQnt: false,
  requireEmail: false,
  requireUsername: false,
  requireNotes: false,
  requirePassword: false,
  requireKeyLock: false,
};

export function hasExtraFields(flags: Partial<ExtraFieldFlags>): boolean {
  return EXTRA_FIELD_OPTIONS.some((option) => flags[option.key]);
}

/** Label of the device value, or null when the service takes none. */
export function deviceLabel(inputType: Service["inputType"]): string | null {
  return inputType === "none" ? null : INPUT_TYPE_LABEL[inputType ?? "imei"];
}

/** Layanan Spesial extra fields that were filled on this order. */
export function orderExtraRows(
  order: Pick<Order, "quantity" | "email" | "username" | "hasPassword" | "password" | "keyLock">,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (order.quantity != null) rows.push({ label: "Qnt", value: String(order.quantity) });
  if (order.username) rows.push({ label: "Username", value: order.username });
  // Admins get the real value; customers only see that one was given.
  if (order.password) rows.push({ label: "Password", value: order.password });
  else if (order.hasPassword) rows.push({ label: "Password", value: "••••••••" });
  if (order.keyLock) rows.push({ label: "Key Lock", value: order.keyLock });
  if (order.email) rows.push({ label: "Email", value: order.email });
  return rows;
}
