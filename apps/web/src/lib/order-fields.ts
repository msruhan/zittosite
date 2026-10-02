import { INPUT_TYPE_LABEL } from "@/lib/imei-list";
import type { Order, Service } from "@/lib/types";

/** Label of the device value, or null when the service takes none. */
export function deviceLabel(inputType: Service["inputType"]): string | null {
  return inputType === "none" ? null : INPUT_TYPE_LABEL[inputType ?? "imei"];
}

/** Layanan Spesial extra fields that were filled on this order. */
export function orderExtraRows(
  order: Pick<Order, "quantity" | "email" | "username">,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (order.quantity != null) rows.push({ label: "Qnt", value: String(order.quantity) });
  if (order.username) rows.push({ label: "Username", value: order.username });
  if (order.email) rows.push({ label: "Email", value: order.email });
  return rows;
}
