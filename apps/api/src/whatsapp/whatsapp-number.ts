import { BadRequestException } from "@nestjs/common";
import { normalizeWhatsappNumber } from "../whatsapp-inbound/admin-reaction-parser";

/** undefined = unchanged, null = cleared; throws on a malformed number. */
export function parseWhatsappNumber(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || !raw.trim()) return null;
  const number = normalizeWhatsappNumber(raw);
  // E.164: 8–15 digits, no leading zero. +62 and other country codes are both valid.
  if (!/^[1-9]\d{7,14}$/.test(number)) {
    throw new BadRequestException(
      "Nomor WhatsApp tidak valid. Contoh: 6281234567890 atau +60123456789.",
    );
  }
  return number;
}

/** Private-chat JID WAHA uses for a phone number. */
export function whatsappChatId(number: string): string {
  return `${number}@c.us`;
}
