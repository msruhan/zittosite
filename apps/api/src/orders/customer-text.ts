/**
 * Customers must never learn that an order went to a Supplier API, nor which
 * supplier. These rewrite stored activity notes, reasons, and actors (including
 * ones written before the wording changed) for anything a customer sees.
 */
export function customerText(text: string): string;
export function customerText(text: string | null): string | null;
export function customerText(text: string | null): string | null {
  if (!text) return text;
  if (/^Ditahan, tidak diteruskan ke supplier/i.test(text)) return "Order sedang ditinjau admin.";
  if (/^Supplier tidak dapat memproses order/i.test(text)) {
    return "Order tidak dapat diproses saat ini.";
  }
  return text
    .replace(/^Ditolak supplier\b/i, "Ditolak")
    .replace(/^Diterima Supplier API,\s*/i, "")
    .replace(/diteruskan otomatis ke Supplier API/gi, "diproses otomatis")
    .replace(/\b(?:API\s+)?supplier(?:\s+API)?\b/gi, "sistem")
    .replace(/^./, (c) => c.toUpperCase());
}

export function customerActor(actor: string): string {
  return /^supplier\b/i.test(actor) ? "Sistem" : actor;
}
