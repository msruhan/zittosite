import { BadRequestException } from "@nestjs/common";
import { normalizeWhatsappNumber } from "../whatsapp-inbound/admin-reaction-parser";

/** undefined = unchanged, null = cleared; throws on a malformed number. */
export function parseWhatsappNumber(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || !raw.trim()) return null;
  const number = normalizeWhatsappNumber(raw);
  if (!/^62\d{8,13}$/.test(number)) {
    throw new BadRequestException("Nomor WhatsApp tidak valid. Contoh: 6281234567890.");
  }
  return number;
}

/** Private-chat JID WAHA uses for a phone number. */
export function whatsappChatId(number: string): string {
  return `${number}@c.us`;
}
